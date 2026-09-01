/**
 * Testes unitários para folderSharingService (T-701 — compartilhar por pasta
 * sem duplicar).
 *
 * Testa:
 * - extractFileNameFromUri: decodificação de URI SAF real (percent-encoding, `:`/`/`)
 * - guessMimeTypeFromName: extensões conhecidas, desconhecidas e sem extensão
 * - requestFolderAccess: concedida/negada
 * - listFolderFiles: filtra subpastas, ignora item problemático, mapeia campos
 */

import {
  extractFileNameFromUri,
  guessMimeTypeFromName,
  requestFolderAccess,
  listFolderFiles,
  createDefaultFolderSharingModule,
  type FolderSharingModule,
} from '../folderSharingService';

describe('extractFileNameFromUri', () => {
  it('decodifica um document id SAF real (volume:caminho/arquivo)', () => {
    const uri =
      'content://com.android.externalstorage.documents/document/primary%3ADownload%2Ffoto.jpg';
    expect(extractFileNameFromUri(uri)).toBe('foto.jpg');
  });

  it('lida com nome contendo espaços/acentos percent-encoded', () => {
    const uri = 'content://.../document/primary%3ADownload%2Frelat%C3%B3rio%20final.pdf';
    expect(extractFileNameFromUri(uri)).toBe('relatório final.pdf');
  });

  it('retorna o próprio segmento quando não há separador de path no document id', () => {
    const uri = 'content://.../document/video.mov';
    expect(extractFileNameFromUri(uri)).toBe('video.mov');
  });

  it('não lança quando o segmento não é percent-encoding válido', () => {
    const uri = 'content://.../document/nome-invalido-%';
    expect(() => extractFileNameFromUri(uri)).not.toThrow();
  });

  it('usa o document id inteiro quando ele termina em "/" (parte final vazia)', () => {
    // primary%3APasta%2F decodifica para "primary:Pasta/" — a última parte do
    // split é "" (falsy), então cai no fallback (o próprio `decoded`).
    const uri = 'content://.../document/primary%3APasta%2F';
    expect(extractFileNameFromUri(uri)).toBe('primary:Pasta/');
  });
});

describe('guessMimeTypeFromName', () => {
  it.each([
    ['foto.jpg', 'image/jpeg'],
    ['foto.JPEG', 'image/jpeg'],
    ['video.mov', 'video/quicktime'],
    ['documento.pdf', 'application/pdf'],
    ['planilha.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
  ])('mapeia %s para %s', (name, expected) => {
    expect(guessMimeTypeFromName(name)).toBe(expected);
  });

  it('retorna application/octet-stream para extensão desconhecida', () => {
    expect(guessMimeTypeFromName('arquivo.xyz123')).toBe('application/octet-stream');
  });

  it('retorna application/octet-stream quando não há extensão', () => {
    expect(guessMimeTypeFromName('semextensao')).toBe('application/octet-stream');
  });
});

describe('requestFolderAccess', () => {
  it('retorna a directoryUri quando a permissão é concedida', async () => {
    const module = {
      requestDirectoryPermissionsAsync: jest
        .fn()
        .mockResolvedValue({ granted: true, directoryUri: 'content://tree/primary%3ADownload' }),
    };

    await expect(requestFolderAccess(module)).resolves.toBe('content://tree/primary%3ADownload');
  });

  it('retorna null quando o usuário nega/cancela', async () => {
    const module = {
      requestDirectoryPermissionsAsync: jest.fn().mockResolvedValue({ granted: false }),
    };

    await expect(requestFolderAccess(module)).resolves.toBeNull();
  });
});

describe('listFolderFiles', () => {
  function makeModule(
    overrides?: Partial<Pick<FolderSharingModule, 'readDirectoryAsync' | 'getInfoAsync'>>,
  ) {
    return {
      readDirectoryAsync: jest.fn(),
      getInfoAsync: jest.fn(),
      ...overrides,
    } as unknown as Pick<FolderSharingModule, 'readDirectoryAsync' | 'getInfoAsync'>;
  }

  /** `FileInfo` completo (campos que `listFolderFiles` ignora preenchidos com valor neutro). */
  function fakeFileInfo(overrides: { isDirectory: boolean; size: number }) {
    return { exists: true as const, uri: '', modificationTime: 0, ...overrides };
  }

  it('mapeia cada URI para nome/mimeType/sizeBytes', async () => {
    const module = makeModule({
      readDirectoryAsync: jest
        .fn()
        .mockResolvedValue(['content://.../document/primary%3ADownload%2Ffoto.jpg']),
      getInfoAsync: jest.fn().mockResolvedValue(fakeFileInfo({ isDirectory: false, size: 2048 })),
    });

    const files = await listFolderFiles(module, 'content://tree/primary%3ADownload');

    expect(files).toEqual([
      {
        uri: 'content://.../document/primary%3ADownload%2Ffoto.jpg',
        name: 'foto.jpg',
        mimeType: 'image/jpeg',
        sizeBytes: 2048,
      },
    ]);
  });

  it('filtra subpastas (isDirectory: true)', async () => {
    const module = makeModule({
      readDirectoryAsync: jest
        .fn()
        .mockResolvedValue(['content://.../subpasta', 'content://.../arquivo.txt']),
      getInfoAsync: jest.fn((uri: string) =>
        Promise.resolve(
          uri.includes('subpasta')
            ? fakeFileInfo({ isDirectory: true, size: 0 })
            : fakeFileInfo({ isDirectory: false, size: 10 }),
        ),
      ),
    });

    const files = await listFolderFiles(module, 'content://tree/x');

    expect(files).toHaveLength(1);
    expect(files[0].name).toBe('arquivo.txt');
  });

  it('ignora item cujo getInfoAsync rejeita, sem derrubar a listagem inteira', async () => {
    const module = makeModule({
      readDirectoryAsync: jest
        .fn()
        .mockResolvedValue(['content://.../quebrado.txt', 'content://.../ok.txt']),
      getInfoAsync: jest.fn((uri: string) =>
        uri.includes('quebrado')
          ? Promise.reject(new Error('falhou'))
          : Promise.resolve(fakeFileInfo({ isDirectory: false, size: 5 })),
      ),
    });

    const files = await listFolderFiles(module, 'content://tree/x');

    expect(files).toHaveLength(1);
    expect(files[0].name).toBe('ok.txt');
  });

  it('dispara getInfoAsync de todos os itens em paralelo — não espera um terminar antes do próximo (T-807)', async () => {
    // Prova de paralelismo real (não só que o resultado final bate): usa promises
    // controláveis manualmente para observar que as N chamadas de getInfoAsync já foram
    // TODAS disparadas (ficam pendentes ao mesmo tempo) antes de qualquer uma resolver. Um
    // `for...of` sequencial com `await` dentro do loop teria disparado só a primeira
    // chamada neste ponto — só chamaria a segunda depois da primeira resolver.
    const uris = ['content://.../a.txt', 'content://.../b.txt', 'content://.../c.txt'];
    const pendingResolvers: ((
      info: Awaited<ReturnType<FolderSharingModule['getInfoAsync']>>,
    ) => void)[] = [];
    const getInfoAsync = jest.fn(
      () =>
        new Promise<Awaited<ReturnType<FolderSharingModule['getInfoAsync']>>>((resolve) => {
          pendingResolvers.push(resolve);
        }),
    );
    const module = makeModule({
      readDirectoryAsync: jest.fn().mockResolvedValue(uris),
      getInfoAsync,
    });

    const resultPromise = listFolderFiles(module, 'content://tree/x');

    // Deixa todos os microtasks síncronos (resolução de readDirectoryAsync + o .map que
    // dispara cada getInfoAsync) rodarem, sem resolver nenhum getInfoAsync ainda.
    await new Promise<void>((resolve) => setImmediate(resolve));

    expect(getInfoAsync).toHaveBeenCalledTimes(3);
    expect(pendingResolvers).toHaveLength(3);

    // Resolve fora de ordem (b, depois c, depois a) — Promise.all preserva a ordem de
    // entrada no array de resultado final, independentemente da ordem de resolução.
    pendingResolvers[1](fakeFileInfo({ isDirectory: false, size: 20 })); // b.txt
    pendingResolvers[2](fakeFileInfo({ isDirectory: false, size: 30 })); // c.txt
    pendingResolvers[0](fakeFileInfo({ isDirectory: false, size: 10 })); // a.txt

    const files = await resultPromise;

    expect(files.map((f) => f.name)).toEqual(['a.txt', 'b.txt', 'c.txt']);
    expect(files.map((f) => f.sizeBytes)).toEqual([10, 20, 30]);
  });

  it('item que rejeita no meio de outros pendentes não derruba a listagem paralela inteira', async () => {
    // Complementa o teste de paralelismo acima: aqui a rejeição acontece enquanto as
    // outras chamadas ainda estão pendentes (não resolvidas), confirmando que
    // `Promise.all`/`resolveFolderFile` isola a falha de um item sem esperar (nem ser
    // afetado por) o estado dos demais — o mesmo comportamento que já existia na versão
    // sequencial, agora sob execução paralela real.
    const uris = ['content://.../ok1.txt', 'content://.../quebrado.txt', 'content://.../ok2.txt'];
    const pending: {
      resolve: (info: Awaited<ReturnType<FolderSharingModule['getInfoAsync']>>) => void;
      reject: (err: unknown) => void;
    }[] = [];
    const getInfoAsync = jest.fn(
      () =>
        new Promise<Awaited<ReturnType<FolderSharingModule['getInfoAsync']>>>((resolve, reject) => {
          pending.push({ resolve, reject });
        }),
    );
    const module = makeModule({
      readDirectoryAsync: jest.fn().mockResolvedValue(uris),
      getInfoAsync,
    });

    const resultPromise = listFolderFiles(module, 'content://tree/x');
    await new Promise<void>((resolve) => setImmediate(resolve));

    expect(pending).toHaveLength(3);

    // Rejeita o item do meio primeiro, antes dos outros dois pendentes resolverem.
    pending[1].reject(new Error('falhou'));
    pending[0].resolve(fakeFileInfo({ isDirectory: false, size: 1 }));
    pending[2].resolve(fakeFileInfo({ isDirectory: false, size: 2 }));

    const files = await resultPromise;

    expect(files.map((f) => f.name)).toEqual(['ok1.txt', 'ok2.txt']);
  });

  it('ignora item cujo getInfoAsync retorna exists: false', async () => {
    const module = makeModule({
      readDirectoryAsync: jest.fn().mockResolvedValue(['content://.../sumiu.txt']),
      getInfoAsync: jest.fn().mockResolvedValue({ exists: false, isDirectory: false }),
    });

    const files = await listFolderFiles(module, 'content://tree/x');

    expect(files).toHaveLength(0);
  });

  it('retorna lista vazia quando a pasta não tem arquivos', async () => {
    const module = makeModule({ readDirectoryAsync: jest.fn().mockResolvedValue([]) });

    await expect(listFolderFiles(module, 'content://tree/x')).resolves.toEqual([]);
  });
});

describe('createDefaultFolderSharingModule', () => {
  it('retorna um módulo com as três funções esperadas', () => {
    const module = createDefaultFolderSharingModule();

    expect(typeof module.requestDirectoryPermissionsAsync).toBe('function');
    expect(typeof module.readDirectoryAsync).toBe('function');
    expect(typeof module.getInfoAsync).toBe('function');
  });
});
