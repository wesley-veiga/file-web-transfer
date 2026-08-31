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
