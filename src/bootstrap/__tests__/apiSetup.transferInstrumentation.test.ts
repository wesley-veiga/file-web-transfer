/**
 * Suíte completa para T-602 (instrumentação das rotas de upload/download com o
 * TransferStore, T-601). Cobre:
 *
 * - Throttle exaustivo de `reportProgress` no upload (500ms, inclusive no limite exato,
 *   e a emissão final que sempre ignora o throttle).
 * - Todos os códigos de erro do upload (400 em 4 variações, 413, 422, 507, 500 em 2
 *   variações) e a confirmação de que `transferStore.fail` só é chamado quando a
 *   transferência já havia sido enfileirada (após `fileStart`), nunca antes, e nunca
 *   duplicado em chunks subsequentes do mesmo upload já com erro.
 * - Sucesso completo de upload e download, incluindo `peerIp` (via `remoteAddress`,
 *   com fallback 'desconhecido').
 * - Isolamento de estado entre uploads concorrentes (requestIds diferentes).
 *
 * A suíte pré-existente `apiSetup.test.ts` (T-401/T-402/T-403) cobre o comportamento
 * "de negócio" das rotas (parsing multipart, sanitização, listagem etc.) e não é
 * duplicada aqui — o foco deste arquivo é exclusivamente a instrumentação T-602.
 */

import { registerFileRoutes, registerUploadRoute } from '../apiSetup';
import type { TransferStoreActions } from '../apiSetup';
import type { ApiRouter, ApiHandler } from '../../features/server/services/apiRouter';
import type {
  HttpUploadChunk,
  HttpServerRequest,
  HttpServerResponse,
} from '../../features/server/services/httpModule';
import type { FileRepository } from '../../features/files/services/fileRepository';
import type { FileEntry } from '../../features/files/types';
import { createFilesChangedAtTracker } from '../../shared/lib/filesChangedAtTracker';
import { createMockFileRepository, createMockHttpModule } from '../../__mocks__/testHelpers';

type UploadHandler = (
  chunk: HttpUploadChunk,
  request: Omit<HttpServerRequest, 'body'>,
) => Promise<HttpServerResponse | void>;

type WriteHandle = Awaited<ReturnType<FileRepository['beginStreamedWrite']>>;

function createMockTransferStore(): jest.Mocked<TransferStoreActions> {
  return {
    enqueue: jest.fn().mockReturnValue('transfer-id'),
    start: jest.fn(),
    reportProgress: jest.fn(),
    complete: jest.fn(),
    fail: jest.fn(),
  };
}

/** Registra `registerUploadRoute` num HttpModule mockado e captura o handler registrado. */
function setupUpload(
  options: {
    maxUploadBytes?: number;
    transferStore?: jest.Mocked<TransferStoreActions>;
    now?: () => number;
  } = {},
): {
  handler: UploadHandler;
  mockFileRepository: jest.Mocked<FileRepository>;
  mockTransferStore: jest.Mocked<TransferStoreActions>;
} {
  const mockHttpModule = createMockHttpModule();
  const mockFileRepository = createMockFileRepository();
  const tracker = createFilesChangedAtTracker();
  const mockTransferStore = options.transferStore ?? createMockTransferStore();

  let handler: UploadHandler = () => {
    throw new Error('Handler de upload não foi registrado');
  };
  mockHttpModule.addUploadListener.mockImplementation((_path, h) => {
    handler = h as UploadHandler;
  });

  registerUploadRoute(
    mockHttpModule,
    mockFileRepository,
    options.maxUploadBytes ?? 1_000_000,
    tracker,
    mockTransferStore,
    options.now ?? Date.now,
  );

  return { handler, mockFileRepository, mockTransferStore };
}

/** Registra `registerFileRoutes` num ApiRouter mockado e captura o handler de download. */
function setupDownload(
  transferStore: jest.Mocked<TransferStoreActions> = createMockTransferStore(),
): {
  handler: ApiHandler;
  mockFileRepository: jest.Mocked<FileRepository>;
  mockFsModule: jest.Mocked<{ readAsStringAsync: (uri: string) => Promise<string> }>;
  mockTransferStore: jest.Mocked<TransferStoreActions>;
} {
  const mockApiRouter: jest.Mocked<ApiRouter> = {
    register: jest.fn(),
    unregister: jest.fn(),
    addRoute: jest.fn(),
  };
  const mockFileRepository = createMockFileRepository();
  const mockFsModule = { readAsStringAsync: jest.fn() };

  const handlers: Record<string, ApiHandler> = {};
  mockApiRouter.addRoute.mockImplementation((method, pattern, h) => {
    handlers[`${method} ${pattern}`] = h;
  });

  registerFileRoutes(mockApiRouter, mockFileRepository, mockFsModule, transferStore);

  const handler = handlers['GET /api/files/:id/download'];
  if (!handler) {
    throw new Error('Handler de download não foi registrado');
  }

  return { handler, mockFileRepository, mockFsModule, mockTransferStore: transferStore };
}

const BOUNDARY = '----b';
const CONTENT_TYPE_HEADER = { 'content-type': `multipart/form-data; boundary=${BOUNDARY}` };
const MULTIPART_CLOSE = '\r\n------b--\r\n';

/** Monta os headers de um campo "file" multipart (sem fechar o boundary). */
function multipartHead(filename: string, contentType = 'application/octet-stream'): string {
  return (
    `------b\r\n` +
    `Content-Disposition: form-data; name="file"; filename="${filename}"\r\n` +
    `Content-Type: ${contentType}\r\n` +
    `\r\n`
  );
}

function baseRequest(remoteAddress?: string): Omit<HttpServerRequest, 'body'> {
  return {
    method: 'POST',
    path: '/api/upload',
    headers: CONTENT_TYPE_HEADER,
    ...(remoteAddress !== undefined ? { remoteAddress } : {}),
  };
}

/** Cria um write handle mockado, com `writeChunk`/`finish`/`abort` sobrescrevíveis. */
function makeWriteHandle(
  overrides: Partial<{
    id: string;
    finalName: string;
    sizeBytes: number;
    mimeType: string;
    writeChunkImpl: WriteHandle['writeChunk'];
    finishImpl: WriteHandle['finish'];
    abortImpl: WriteHandle['abort'];
  }> = {},
): WriteHandle {
  const id = overrides.id ?? '550e8400-e29b-41d4-a716-446655440000';
  const finalName = overrides.finalName ?? 'file.txt';
  const sizeBytes = overrides.sizeBytes ?? 0;
  const mimeType = overrides.mimeType ?? 'text/plain';

  return {
    id,
    finalName,
    writeChunk: overrides.writeChunkImpl ?? jest.fn().mockResolvedValue(undefined),
    finish:
      overrides.finishImpl ??
      jest.fn().mockResolvedValue({
        id,
        name: finalName,
        sizeBytes,
        mimeType,
        localUri: `file:///received/${finalName}`,
        origin: 'received' as const,
        createdAt: Date.now(),
      } satisfies FileEntry),
    abort: overrides.abortImpl ?? jest.fn().mockResolvedValue(undefined),
  };
}

function parseBody(response: HttpServerResponse | void): {
  error?: { code: string; message: string };
} {
  const body = response && typeof response.body === 'string' ? response.body : '';
  return body ? JSON.parse(body) : {};
}

describe('T-602 — upload: throttle de reportProgress (500ms)', () => {
  it(
    'emite a 1ª atualização imediatamente, ignora chamadas dentro dos 500ms, retoma após o ' +
      'throttle liberar e sempre emite o total final no último chunk mesmo dentro da janela',
    async () => {
      let currentTime = 10_000;
      const now = jest.fn(() => currentTime);
      const { handler, mockFileRepository, mockTransferStore } = setupUpload({ now });

      const receivedChunks: string[] = [];
      const writeHandle = makeWriteHandle({
        finalName: 'big.bin',
        writeChunkImpl: jest.fn(async (data: string) => {
          receivedChunks.push(data);
        }),
      });
      // `finish()` reflete o total real de bytes que passaram por `writeChunk`, em vez de
      // um valor fixo — assim a asserção final não depende de calcular manualmente quantos
      // bytes o parser retém internamente (cauda do boundary) a cada chunk.
      writeHandle.finish = jest.fn(async (totalBytes: number) => ({
        id: writeHandle.id,
        name: 'big.bin',
        sizeBytes: totalBytes,
        mimeType: 'application/octet-stream',
        localUri: 'file:///received/big.bin',
        origin: 'received' as const,
        createdAt: Date.now(),
      }));
      mockFileRepository.beginStreamedWrite.mockResolvedValue(writeHandle);

      const request = baseRequest('192.168.0.42');

      // Chunk 1 (t=10000): fileStart + 1ª fatia de dados — a 1ª emissão sempre acontece,
      // já que `lastProgressReportAt` começa em 0.
      await handler(
        {
          requestId: 'req-throttle',
          data: multipartHead('big.bin') + 'A'.repeat(30),
          isLast: false,
        },
        request,
      );
      expect(mockTransferStore.reportProgress).toHaveBeenCalledTimes(1);

      // Chunk 2 (t=10100, +100ms desde a emissão): dentro do throttle — não emite de novo,
      // mas o chunk em si é processado normalmente (writeChunk chamado).
      currentTime = 10_100;
      await handler({ requestId: 'req-throttle', data: 'B'.repeat(30), isLast: false }, request);
      expect(mockTransferStore.reportProgress).toHaveBeenCalledTimes(1);

      // Chunk 3 (t=10300, +300ms desde a emissão): ainda dentro do throttle.
      currentTime = 10_300;
      await handler({ requestId: 'req-throttle', data: 'C'.repeat(30), isLast: false }, request);
      expect(mockTransferStore.reportProgress).toHaveBeenCalledTimes(1);

      // Chunk 4 (t=10600, +600ms desde a emissão): throttle liberado — emite de novo.
      currentTime = 10_600;
      await handler({ requestId: 'req-throttle', data: 'D'.repeat(30), isLast: false }, request);
      expect(mockTransferStore.reportProgress).toHaveBeenCalledTimes(2);

      // Chunk 5 (t=10650, +50ms desde a 2ª emissão — dentro do throttle de novo, mas é o
      // ÚLTIMO chunk): a emissão final SEMPRE acontece, ignorando o throttle.
      currentTime = 10_650;
      const finalResponse = await handler(
        { requestId: 'req-throttle', data: 'E'.repeat(10) + MULTIPART_CLOSE, isLast: true },
        request,
      );

      expect(finalResponse?.statusCode).toBe(201);
      expect(mockTransferStore.reportProgress).toHaveBeenCalledTimes(3);
      // Não bloqueia o processamento do chunk em si: writeChunk foi chamado uma vez por
      // network chunk que carregou dados de arquivo, independente do throttle.
      expect(writeHandle.writeChunk).toHaveBeenCalledTimes(5);

      const expectedTotalBytes = receivedChunks.reduce((sum, chunk) => sum + chunk.length, 0);
      expect(mockTransferStore.reportProgress).toHaveBeenLastCalledWith(
        'transfer-id',
        expectedTotalBytes,
      );
      expect(mockTransferStore.complete).toHaveBeenCalledWith('transfer-id');
      expect(mockTransferStore.fail).not.toHaveBeenCalled();
    },
  );

  it('emite novamente exatamente ao completar 500ms desde a última emissão (limite inclusivo, >=)', async () => {
    let currentTime = 0;
    const now = jest.fn(() => currentTime);
    const { handler, mockFileRepository, mockTransferStore } = setupUpload({ now });
    mockFileRepository.beginStreamedWrite.mockResolvedValue(
      makeWriteHandle({ finalName: 'e.bin' }),
    );

    const request = baseRequest('9.9.9.9');

    currentTime = 1000;
    await handler(
      { requestId: 'req-edge', data: multipartHead('e.bin') + 'A'.repeat(30), isLast: false },
      request,
    );
    expect(mockTransferStore.reportProgress).toHaveBeenCalledTimes(1);

    currentTime = 1499; // 499ms depois — ainda dentro do throttle.
    await handler({ requestId: 'req-edge', data: 'B'.repeat(30), isLast: false }, request);
    expect(mockTransferStore.reportProgress).toHaveBeenCalledTimes(1);

    currentTime = 1500; // exatamente 500ms depois — limite inclusivo, deve emitir.
    await handler({ requestId: 'req-edge', data: 'C'.repeat(30), isLast: false }, request);
    expect(mockTransferStore.reportProgress).toHaveBeenCalledTimes(2);
  });
});

describe('T-602 — upload: sucesso completo', () => {
  it('enfileira (direction upload, sizeBytes null, peerIp do remoteAddress), inicia e conclui', async () => {
    const { handler, mockFileRepository, mockTransferStore } = setupUpload();
    mockFileRepository.beginStreamedWrite.mockResolvedValue(
      makeWriteHandle({ finalName: 'ok.txt' }),
    );

    const request = baseRequest('192.168.1.50');
    const response = await handler(
      {
        requestId: 'req-ok',
        data: multipartHead('ok.txt') + 'conteudo' + MULTIPART_CLOSE,
        isLast: true,
      },
      request,
    );

    expect(response?.statusCode).toBe(201);
    expect(mockTransferStore.enqueue).toHaveBeenCalledTimes(1);
    expect(mockTransferStore.enqueue).toHaveBeenCalledWith({
      direction: 'upload',
      fileName: 'ok.txt',
      sizeBytes: null,
      peerIp: '192.168.1.50',
    });
    expect(mockTransferStore.start).toHaveBeenCalledWith('transfer-id');
    expect(mockTransferStore.complete).toHaveBeenCalledWith('transfer-id');
    expect(mockTransferStore.fail).not.toHaveBeenCalled();

    // `start` é chamado logo após `enqueue`, antes de qualquer outra ação do TransferStore.
    const enqueueOrder = mockTransferStore.enqueue.mock.invocationCallOrder[0];
    const startOrder = mockTransferStore.start.mock.invocationCallOrder[0];
    expect(enqueueOrder).toBeLessThan(startOrder as number);
  });
});

describe('T-602 — upload: erros — 400 antes de fileStart (não enfileira, não reporta fail)', () => {
  it('Content-Type sem boundary', async () => {
    const { handler, mockTransferStore } = setupUpload();

    const response = await handler(
      { requestId: 'req-1', data: 'qualquer coisa', isLast: true },
      { method: 'POST', path: '/api/upload', headers: { 'content-type': 'multipart/form-data' } },
    );

    expect(response?.statusCode).toBe(400);
    expect(parseBody(response).error?.code).toBe('INVALID_MULTIPART');
    expect(mockTransferStore.enqueue).not.toHaveBeenCalled();
    expect(mockTransferStore.fail).not.toHaveBeenCalled();
  });

  it('corpo malformado detectado em pleno processamento (parser nunca viu Content-Disposition)', async () => {
    const { handler, mockTransferStore } = setupUpload();

    const response = await handler(
      {
        requestId: 'req-1',
        data: 'lixo aleatorio name="file" mais lixo sem cabecalho valido',
        isLast: false,
      },
      baseRequest(),
    );

    expect(response?.statusCode).toBe(400);
    expect(parseBody(response).error?.code).toBe('INVALID_MULTIPART');
    expect(mockTransferStore.enqueue).not.toHaveBeenCalled();
    expect(mockTransferStore.fail).not.toHaveBeenCalled();
  });

  it('corpo termina (isLast) sem nunca ter encontrado o campo "file" (malformed em finish())', async () => {
    const { handler, mockTransferStore } = setupUpload();

    const response = await handler(
      { requestId: 'req-1', data: 'corpo sem nenhum campo relevante', isLast: true },
      baseRequest(),
    );

    expect(response?.statusCode).toBe(400);
    expect(parseBody(response).error?.code).toBe('INVALID_MULTIPART');
    expect(mockTransferStore.enqueue).not.toHaveBeenCalled();
    expect(mockTransferStore.fail).not.toHaveBeenCalled();
  });
});

describe('T-602 — upload: erros — 400 depois de fileStart (enfileirado, reporta fail)', () => {
  it('fileData chega sem fileStart concluído (writeHandle ainda não atribuído — corrida controlada)', async () => {
    const { handler, mockFileRepository, mockTransferStore } = setupUpload();

    // `beginStreamedWrite` fica deliberadamente pendente: simula um `fileData` que chega
    // fisicamente antes do handle de escrita estar pronto (ex.: I/O lento no dispositivo).
    let resolveBegin: (handle: WriteHandle) => void = () => {};
    const beginPromise = new Promise<WriteHandle>((resolve) => {
      resolveBegin = resolve;
    });
    mockFileRepository.beginStreamedWrite.mockReturnValue(beginPromise);

    const request = baseRequest('1.2.3.4');

    // Chunk 1: só os headers do multipart (fileStart) — a chamada fica pendurada no
    // `await fileRepository.beginStreamedWrite(...)` interno; não é aguardada aqui de
    // propósito, para permitir que o chunk 2 chegue "antes" dela resolver.
    const pending = handler(
      { requestId: 'req-race', data: multipartHead('a.txt'), isLast: false },
      request,
    );

    // Chunk 2 (ainda não-last): o parser já está "dentro do arquivo" (fileStart já
    // processado sincronamente pelo parser), então este chunk produz um evento `fileData`
    // que encontra `state.writeHandle === null`.
    const response2 = await handler(
      { requestId: 'req-race', data: 'X'.repeat(30), isLast: false },
      request,
    );

    expect(response2?.statusCode).toBe(400);
    expect(parseBody(response2).error?.code).toBe('INVALID_MULTIPART');
    // `enqueue`/`start` já tinham sido chamados no fileStart (síncronos, antes do await),
    // então o `fail` DEVE ser reportado aqui — diferente dos casos 400 anteriores.
    expect(mockTransferStore.enqueue).toHaveBeenCalledTimes(1);
    expect(mockTransferStore.fail).toHaveBeenCalledTimes(1);
    expect(mockTransferStore.fail).toHaveBeenCalledWith('transfer-id', expect.any(String));

    // Limpeza: resolve o handle pendente para não deixar nenhuma promise pendurada.
    resolveBegin(makeWriteHandle({ finalName: 'a.txt' }));
    await pending;
  });

  it('corpo termina sem boundary de fechamento com writeHandle já existente (malformed em finish())', async () => {
    const { handler, mockFileRepository, mockTransferStore } = setupUpload();
    const writeHandle = makeWriteHandle({ finalName: 'a.txt' });
    mockFileRepository.beginStreamedWrite.mockResolvedValue(writeHandle);
    const request = baseRequest('7.7.7.7');

    await handler(
      { requestId: 'req-mid', data: multipartHead('a.txt') + 'dados parciais', isLast: false },
      request,
    );
    expect(writeHandle.abort).not.toHaveBeenCalled();

    const response = await handler(
      { requestId: 'req-mid', data: 'mais dados, mas nunca fecha o boundary', isLast: true },
      request,
    );

    expect(response?.statusCode).toBe(400);
    expect(parseBody(response).error?.code).toBe('INVALID_MULTIPART');
    expect(writeHandle.abort).toHaveBeenCalledTimes(1);
    expect(mockTransferStore.fail).toHaveBeenCalledTimes(1);
    expect(mockTransferStore.fail).toHaveBeenCalledWith('transfer-id', expect.any(String));
  });
});

describe('T-602 — upload: erro 413 — FILE_TOO_LARGE', () => {
  it('aborta a escrita e reporta fail() quando o upload excede maxUploadBytes', async () => {
    const { handler, mockFileRepository, mockTransferStore } = setupUpload({ maxUploadBytes: 20 });
    const writeHandle = makeWriteHandle({ finalName: 'large.bin' });
    mockFileRepository.beginStreamedWrite.mockResolvedValue(writeHandle);
    const request = baseRequest('7.7.7.7');

    const response = await handler(
      {
        requestId: 'req-big',
        data: multipartHead('large.bin') + 'X'.repeat(50) + MULTIPART_CLOSE,
        isLast: true,
      },
      request,
    );

    expect(response?.statusCode).toBe(413);
    expect(parseBody(response).error?.code).toBe('FILE_TOO_LARGE');
    expect(writeHandle.abort).toHaveBeenCalledTimes(1);
    expect(mockTransferStore.fail).toHaveBeenCalledTimes(1);
    expect(mockTransferStore.fail).toHaveBeenCalledWith(
      'transfer-id',
      'Arquivo excede tamanho máximo permitido',
    );
  });

  it('não duplica fail() em chunks subsequentes do mesmo upload após o erro (short-circuit)', async () => {
    const { handler, mockFileRepository, mockTransferStore } = setupUpload({ maxUploadBytes: 20 });
    const writeHandle = makeWriteHandle({ finalName: 'large.bin' });
    mockFileRepository.beginStreamedWrite.mockResolvedValue(writeHandle);
    const request = baseRequest();

    const response1 = await handler(
      { requestId: 'req-retry', data: multipartHead('large.bin') + 'X'.repeat(50), isLast: false },
      request,
    );
    expect(response1?.statusCode).toBe(413);
    expect(mockTransferStore.fail).toHaveBeenCalledTimes(1);

    const response2 = await handler(
      { requestId: 'req-retry', data: 'mais dados irrelevantes', isLast: true },
      request,
    );
    expect(response2?.statusCode).toBe(413);
    expect(mockTransferStore.fail).toHaveBeenCalledTimes(1); // continua 1, não duplicou
  });
});

describe('T-602 — upload: erro 422 — INVALID_FILENAME', () => {
  it('reporta fail() quando beginStreamedWrite rejeita por nome inválido', async () => {
    const { handler, mockFileRepository, mockTransferStore } = setupUpload();
    mockFileRepository.beginStreamedWrite.mockRejectedValue(
      new Error('Nome sanitizado vazio (INVALID_FILENAME)'),
    );
    const request = baseRequest('7.7.7.7');

    const response = await handler(
      { requestId: 'req-422', data: multipartHead('..') + 'x' + MULTIPART_CLOSE, isLast: true },
      request,
    );

    expect(response?.statusCode).toBe(422);
    expect(parseBody(response).error?.code).toBe('INVALID_FILENAME');
    expect(mockTransferStore.fail).toHaveBeenCalledTimes(1);
    expect(mockTransferStore.fail).toHaveBeenCalledWith('transfer-id', 'Nome de arquivo inválido');
  });
});

describe('T-602 — upload: erro 507 — INSUFFICIENT_STORAGE', () => {
  it.each([['No space left on device (ENOSPC)'], ['Storage quota exceeded'], ['out of SPACE']])(
    'reporta fail() quando writeChunk rejeita com "%s"',
    async (errorMessage) => {
      const { handler, mockFileRepository, mockTransferStore } = setupUpload();
      const writeHandle = makeWriteHandle({
        finalName: 'f.bin',
        writeChunkImpl: jest.fn().mockRejectedValue(new Error(errorMessage)),
      });
      mockFileRepository.beginStreamedWrite.mockResolvedValue(writeHandle);
      const request = baseRequest('7.7.7.7');

      const response = await handler(
        {
          requestId: 'req-507',
          data: multipartHead('f.bin') + 'dados' + MULTIPART_CLOSE,
          isLast: true,
        },
        request,
      );

      expect(response?.statusCode).toBe(507);
      expect(parseBody(response).error?.code).toBe('INSUFFICIENT_STORAGE');
      expect(writeHandle.abort).toHaveBeenCalledTimes(1);
      expect(mockTransferStore.fail).toHaveBeenCalledTimes(1);
      expect(mockTransferStore.fail).toHaveBeenCalledWith(
        'transfer-id',
        'Sem espaço no dispositivo',
      );
    },
  );
});

describe('T-602 — upload: erros 500', () => {
  it('reporta fail() quando o FileEntryDto final falha na validação do schema Zod', async () => {
    const { handler, mockFileRepository, mockTransferStore } = setupUpload();
    const writeHandle = makeWriteHandle({ finalName: 'ok.bin' });
    mockFileRepository.beginStreamedWrite.mockResolvedValue(writeHandle);
    mockFileRepository.toDto.mockReturnValue({
      id: 'not-a-uuid',
      name: '',
      sizeBytes: -1,
      mimeType: 123 as unknown as string,
      createdAt: 0,
    });
    const request = baseRequest('7.7.7.7');

    const response = await handler(
      {
        requestId: 'req-dto',
        data: multipartHead('ok.bin') + 'dados' + MULTIPART_CLOSE,
        isLast: true,
      },
      request,
    );

    expect(response?.statusCode).toBe(500);
    expect(parseBody(response).error?.code).toBe('INTERNAL_ERROR');
    expect(writeHandle.abort).toHaveBeenCalledTimes(1);
    expect(mockTransferStore.fail).toHaveBeenCalledTimes(1);
    expect(mockTransferStore.fail).toHaveBeenCalledWith('transfer-id', 'Erro ao processar arquivo');
  });

  it('reporta fail() quando ocorre uma exceção não tratada durante o processamento', async () => {
    const { handler, mockFileRepository, mockTransferStore } = setupUpload();
    const writeHandle = makeWriteHandle({
      finalName: 'oops.bin',
      writeChunkImpl: jest.fn().mockRejectedValue(new Error('Falha inesperada de I/O')),
    });
    mockFileRepository.beginStreamedWrite.mockResolvedValue(writeHandle);
    const request = baseRequest('7.7.7.7');

    const response = await handler(
      {
        requestId: 'req-boom',
        data: multipartHead('oops.bin') + 'dados' + MULTIPART_CLOSE,
        isLast: true,
      },
      request,
    );

    expect(response?.statusCode).toBe(500);
    const body = parseBody(response);
    expect(body.error?.code).toBe('INTERNAL_ERROR');
    expect(body.error?.message).toBe('Falha inesperada de I/O');
    expect(writeHandle.abort).toHaveBeenCalledTimes(1);
    expect(mockTransferStore.fail).toHaveBeenCalledTimes(1);
    expect(mockTransferStore.fail).toHaveBeenCalledWith('transfer-id', 'Falha inesperada de I/O');
  });
});

describe('T-602 — upload: concorrência não cruza estado entre requestIds', () => {
  it('mantém transferId e throttle isolados por requestId (activeUploads é um Map por requestId)', async () => {
    let currentTime = 1000;
    const now = jest.fn(() => currentTime);
    const mockTransferStore = createMockTransferStore();
    mockTransferStore.enqueue.mockReturnValueOnce('transfer-A').mockReturnValueOnce('transfer-B');

    const { handler, mockFileRepository } = setupUpload({ now, transferStore: mockTransferStore });

    const handleA = makeWriteHandle({
      id: '550e8400-e29b-41d4-a716-446655440001',
      finalName: 'a.bin',
    });
    const handleB = makeWriteHandle({
      id: '550e8400-e29b-41d4-a716-446655440002',
      finalName: 'b.bin',
    });
    mockFileRepository.beginStreamedWrite.mockImplementation(async (filename: string) =>
      filename === 'a.bin' ? handleA : handleB,
    );

    const requestA = baseRequest('1.1.1.1');
    const requestB = baseRequest('2.2.2.2');

    // t=1000: fileStart de A — 1ª emissão de A.
    await handler(
      { requestId: 'req-A', data: multipartHead('a.bin') + 'A'.repeat(30), isLast: false },
      requestA,
    );
    // t=1000 ainda: fileStart de B — throttle de B é independente do de A (também emite).
    await handler(
      { requestId: 'req-B', data: multipartHead('b.bin') + 'B'.repeat(30), isLast: false },
      requestB,
    );

    expect(mockTransferStore.reportProgress).toHaveBeenCalledWith('transfer-A', expect.any(Number));
    expect(mockTransferStore.reportProgress).toHaveBeenCalledWith('transfer-B', expect.any(Number));

    // t=1100: mais dados só para A — dentro do throttle de A (que emitiu por último em
    // t=1000); não deve gerar nova emissão para A nem afetar o estado de B.
    currentTime = 1100;
    const callsForABefore = mockTransferStore.reportProgress.mock.calls.filter(
      (c) => c[0] === 'transfer-A',
    ).length;
    await handler({ requestId: 'req-A', data: 'C'.repeat(30), isLast: false }, requestA);
    const callsForAAfter = mockTransferStore.reportProgress.mock.calls.filter(
      (c) => c[0] === 'transfer-A',
    ).length;
    expect(callsForAAfter).toBe(callsForABefore);

    // Finaliza os dois — cada um deve completar com seu próprio id, sem cruzar.
    const responseA = await handler(
      { requestId: 'req-A', data: MULTIPART_CLOSE, isLast: true },
      requestA,
    );
    const responseB = await handler(
      { requestId: 'req-B', data: MULTIPART_CLOSE, isLast: true },
      requestB,
    );

    expect(responseA?.statusCode).toBe(201);
    expect(responseB?.statusCode).toBe(201);
    expect(mockTransferStore.complete).toHaveBeenCalledWith('transfer-A');
    expect(mockTransferStore.complete).toHaveBeenCalledWith('transfer-B');
    expect(mockTransferStore.fail).not.toHaveBeenCalled();
  });
});

describe('T-602 — download: instrumentação', () => {
  it('enfileira, inicia, reporta progresso com o total e conclui no sucesso', async () => {
    const { handler, mockFileRepository, mockFsModule, mockTransferStore } = setupDownload();
    const entry: FileEntry = {
      id: '550e8400-e29b-41d4-a716-446655440000',
      name: 'doc.pdf',
      sizeBytes: 42,
      mimeType: 'application/pdf',
      localUri: 'file:///doc.pdf',
      origin: 'shared',
      createdAt: Date.now(),
    };
    mockFileRepository.list.mockResolvedValue([entry]);
    mockFsModule.readAsStringAsync.mockResolvedValue('conteudo');

    const response = await handler(
      { method: 'GET', path: '/api/files/x/download', headers: {}, remoteAddress: '10.0.0.1' },
      { id: entry.id },
      {},
    );

    expect(response.statusCode).toBe(200);
    expect(mockTransferStore.enqueue).toHaveBeenCalledWith({
      direction: 'download',
      fileName: 'doc.pdf',
      sizeBytes: 42,
      peerIp: '10.0.0.1',
    });
    expect(mockTransferStore.start).toHaveBeenCalledWith('transfer-id');
    expect(mockTransferStore.reportProgress).toHaveBeenCalledWith('transfer-id', 42);
    expect(mockTransferStore.complete).toHaveBeenCalledWith('transfer-id');
    expect(mockTransferStore.fail).not.toHaveBeenCalled();
  });

  it('reporta fail() e NÃO reporta progresso/conclui quando a leitura do arquivo falha', async () => {
    const { handler, mockFileRepository, mockFsModule, mockTransferStore } = setupDownload();
    const entry: FileEntry = {
      id: '550e8400-e29b-41d4-a716-446655440001',
      name: 'broken.pdf',
      sizeBytes: 10,
      mimeType: 'application/pdf',
      localUri: 'file:///broken.pdf',
      origin: 'shared',
      createdAt: Date.now(),
    };
    mockFileRepository.list.mockResolvedValue([entry]);
    mockFsModule.readAsStringAsync.mockRejectedValue(new Error('Permissão negada'));

    const response = await handler(
      { method: 'GET', path: '/api/files/x/download', headers: {} },
      { id: entry.id },
      {},
    );

    expect(response.statusCode).toBe(500);
    expect(mockTransferStore.fail).toHaveBeenCalledTimes(1);
    expect(mockTransferStore.fail).toHaveBeenCalledWith('transfer-id', 'Permissão negada');
    expect(mockTransferStore.reportProgress).not.toHaveBeenCalled();
    expect(mockTransferStore.complete).not.toHaveBeenCalled();
  });

  it('não enfileira nada quando o arquivo não é encontrado (404) — instrumentação só começa após localizar o arquivo', async () => {
    const { handler, mockFileRepository, mockTransferStore } = setupDownload();
    mockFileRepository.list.mockResolvedValue([]);

    const response = await handler(
      { method: 'GET', path: '/api/files/x/download', headers: {} },
      { id: 'nao-existe' },
      {},
    );

    expect(response.statusCode).toBe(404);
    expect(mockTransferStore.enqueue).not.toHaveBeenCalled();
    expect(mockTransferStore.start).not.toHaveBeenCalled();
    expect(mockTransferStore.fail).not.toHaveBeenCalled();
  });
});

describe('T-602 — peerIp cai para "desconhecido" quando remoteAddress está ausente', () => {
  it('upload: usa "desconhecido" quando request.remoteAddress é undefined', async () => {
    const { handler, mockFileRepository, mockTransferStore } = setupUpload();
    mockFileRepository.beginStreamedWrite.mockRejectedValue(
      new Error('Nome sanitizado vazio (INVALID_FILENAME)'),
    );

    const response = await handler(
      { requestId: 'req-1', data: multipartHead('..') + 'x' + MULTIPART_CLOSE, isLast: true },
      baseRequest(undefined),
    );

    expect(response?.statusCode).toBe(422);
    expect(mockTransferStore.enqueue).toHaveBeenCalledWith(
      expect.objectContaining({ peerIp: 'desconhecido' }),
    );
  });

  it('download: usa "desconhecido" quando request.remoteAddress é undefined', async () => {
    const { handler, mockFileRepository, mockFsModule, mockTransferStore } = setupDownload();
    const entry: FileEntry = {
      id: '550e8400-e29b-41d4-a716-446655440002',
      name: 'no-ip.pdf',
      sizeBytes: 1,
      mimeType: 'application/pdf',
      localUri: 'file:///no-ip.pdf',
      origin: 'shared',
      createdAt: Date.now(),
    };
    mockFileRepository.list.mockResolvedValue([entry]);
    mockFsModule.readAsStringAsync.mockResolvedValue('x');

    await handler(
      { method: 'GET', path: '/api/files/x/download', headers: {} },
      { id: entry.id },
      {},
    );

    expect(mockTransferStore.enqueue).toHaveBeenCalledWith(
      expect.objectContaining({ peerIp: 'desconhecido' }),
    );
  });
});
