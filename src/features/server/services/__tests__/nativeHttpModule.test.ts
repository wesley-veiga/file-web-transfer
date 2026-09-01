/**
 * Testes unitários para `createDefaultHttpModule()` (T-405): a implementação real de
 * `HttpModule` sobre `react-native-tcp-socket`, incluindo o parser de HTTP/1.1 feito à mão
 * sobre eventos `data` de socket cru.
 *
 * `react-native-tcp-socket` é mockado via `testUtils/tcpSocketMock.ts` (fake baseado em
 * `EventEmitter`), permitindo simular conexões, chunks de bytes chegando e inspecionar o que
 * foi escrito de volta no socket — sem nenhum I/O real.
 */

import { Buffer } from 'buffer';
import { createDefaultHttpModule } from '../nativeHttpModule';
import type {
  HttpServerRequest,
  HttpServerResponse,
  HttpStreamedBody,
  HttpUploadChunk,
  HttpModule,
} from '../httpModule';
import {
  MockServer,
  MockSocket,
  createdServers,
  resetTcpSocketMock,
} from '../testing/tcpSocketMock';

jest.mock('react-native-tcp-socket', () =>
  require('../testing/tcpSocketMock').createTcpSocketModule(),
);

const PORT = 8080;

/** Aguarda o esvaziamento completo da fila de microtasks (todas as promises pendentes). */
async function flush(): Promise<void> {
  await new Promise<void>((resolve) => setImmediate(resolve));
}

function lastServer(): MockServer {
  const server = createdServers[createdServers.length - 1];
  if (!server) {
    throw new Error('nenhum servidor foi criado — start() não foi chamado?');
  }
  return server;
}

function connect(server: MockServer = lastServer()): MockSocket {
  const socket = new MockSocket();
  if (!server.connectionListener) {
    throw new Error('servidor fake sem connectionListener');
  }
  server.connectionListener(socket);
  return socket;
}

/** Emite um evento `data` no socket fake e aguarda o processamento assíncrono terminar. */
async function send(socket: MockSocket, data: string | Buffer): Promise<void> {
  socket.emit('data', data);
  await flush();
}

/** Monta uma request-line + headers HTTP/1.1 crua (sem corpo). */
function buildHead(method: string, path: string, headers: Record<string, string> = {}): string {
  const lines = [`${method} ${path} HTTP/1.1`];
  for (const [key, value] of Object.entries(headers)) {
    lines.push(`${key}: ${value}`);
  }
  return lines.join('\r\n') + '\r\n\r\n';
}

async function startModule(module: HttpModule): Promise<void> {
  const startPromise = module.start(PORT);
  lastServer().triggerListening();
  await startPromise;
}

const jsonHandler =
  (response: HttpServerResponse): ((request: HttpServerRequest) => Promise<HttpServerResponse>) =>
  async () =>
    response;

/**
 * Cria um `AsyncIterable<Buffer>` (T-804) a partir de uma lista de chunks, registrando em
 * `pulls` a ordem em que cada chunk foi de fato produzido pelo generator (ou seja, quando o
 * consumidor — `writeStreamedBody` em `nativeHttpModule.ts` — de fato pediu o próximo valor).
 * Usado para provar que os chunks são pedidos um de cada vez, nunca adiantados.
 */
function trackedChunkSource(chunksData: Buffer[]): {
  chunks: AsyncIterable<Buffer>;
  pulls: number[];
} {
  const pulls: number[] = [];
  async function* generator(): AsyncGenerator<Buffer> {
    for (let i = 0; i < chunksData.length; i++) {
      pulls.push(i);
      yield chunksData[i];
    }
  }
  return { chunks: generator(), pulls };
}

describe('createDefaultHttpModule', () => {
  let module: HttpModule;

  beforeEach(() => {
    resetTcpSocketMock();
    module = createDefaultHttpModule();
  });

  describe('registro de listeners', () => {
    it('roteia para o handler "plain" cujo path registrado é o prefixo mais longo do pathname', async () => {
      const genericHandler = jest.fn(jsonHandler({ statusCode: 200, body: 'generic' }));
      const specificHandler = jest.fn(jsonHandler({ statusCode: 200, body: 'specific' }));
      module.addListener('/api', genericHandler);
      module.addListener('/api/files', specificHandler);

      await startModule(module);
      const socket = connect();
      await send(socket, buildHead('GET', '/api/files/123'));

      expect(specificHandler).toHaveBeenCalledTimes(1);
      expect(genericHandler).not.toHaveBeenCalled();
    });

    it('roteia para o handler "plain" genérico quando só o prefixo curto bate', async () => {
      const genericHandler = jest.fn(jsonHandler({ statusCode: 200, body: 'generic' }));
      const specificHandler = jest.fn(jsonHandler({ statusCode: 200, body: 'specific' }));
      module.addListener('/api', genericHandler);
      module.addListener('/api/files', specificHandler);

      await startModule(module);
      const socket = connect();
      await send(socket, buildHead('GET', '/api/session'));

      expect(genericHandler).toHaveBeenCalledTimes(1);
      expect(specificHandler).not.toHaveBeenCalled();
    });

    it('roteia uploads para o handler de upload cujo path registrado é o prefixo mais longo', async () => {
      const uploadV1 = jest.fn(async (chunk: HttpUploadChunk) =>
        chunk.isLast ? { statusCode: 200, body: 'v1' } : undefined,
      );
      const uploadV2 = jest.fn(async (chunk: HttpUploadChunk) =>
        chunk.isLast ? { statusCode: 200, body: 'v2' } : undefined,
      );
      module.addUploadListener('/api/upload', uploadV1);
      module.addUploadListener('/api/upload/v2', uploadV2);

      await startModule(module);
      const socket = connect();
      await send(socket, buildHead('POST', '/api/upload/v2/big', { 'Content-Length': '0' }));

      expect(uploadV2).toHaveBeenCalledTimes(1);
      expect(uploadV1).not.toHaveBeenCalled();
    });

    it('mantém o prefixo mais longo já encontrado mesmo se um path mais curto for avaliado depois (ordem de registro invertida)', async () => {
      const uploadV2 = jest.fn(async (chunk: HttpUploadChunk) =>
        chunk.isLast ? { statusCode: 200, body: 'v2' } : undefined,
      );
      const uploadV1 = jest.fn(async (chunk: HttpUploadChunk) =>
        chunk.isLast ? { statusCode: 200, body: 'v1' } : undefined,
      );
      // Registrado em ordem inversa da anterior: o path mais longo entra primeiro no Map.
      module.addUploadListener('/api/upload/v2', uploadV2);
      module.addUploadListener('/api/upload', uploadV1);

      await startModule(module);
      const socket = connect();
      await send(socket, buildHead('POST', '/api/upload/v2/big', { 'Content-Length': '0' }));

      expect(uploadV2).toHaveBeenCalledTimes(1);
      expect(uploadV1).not.toHaveBeenCalled();
    });

    it('extrai o pathname ignorando a query string ao rotear', async () => {
      const handler = jest.fn(jsonHandler({ statusCode: 200, body: 'ok' }));
      module.addListener('/api/files', handler);

      await startModule(module);
      const socket = connect();
      await send(socket, buildHead('GET', '/api/files?origin=shared&sort=name'));

      expect(handler).toHaveBeenCalledTimes(1);
      const [request] = handler.mock.calls[0] as [HttpServerRequest];
      expect(request.path).toBe('/api/files?origin=shared&sort=name');
    });

    it('upload vence sobre "plain" quando os dois batem no mesmo path', async () => {
      const plainHandler = jest.fn(jsonHandler({ statusCode: 200, body: 'plain' }));
      const uploadHandler = jest.fn(async (chunk: HttpUploadChunk) =>
        chunk.isLast ? { statusCode: 200, body: 'upload' } : undefined,
      );
      module.addListener('/api/upload', plainHandler);
      module.addUploadListener('/api/upload', uploadHandler);

      await startModule(module);
      const socket = connect();
      await send(socket, buildHead('POST', '/api/upload', { 'Content-Length': '0' }));

      expect(uploadHandler).toHaveBeenCalledTimes(1);
      expect(plainHandler).not.toHaveBeenCalled();
    });

    it('removeListener faz com que requests futuras ao path resultem em 404', async () => {
      const handler = jest.fn(jsonHandler({ statusCode: 200, body: 'ok' }));
      module.addListener('/api', handler);
      module.removeListener('/api');

      await startModule(module);
      const socket = connect();
      await send(socket, buildHead('GET', '/api/session'));

      expect(handler).not.toHaveBeenCalled();
      expect(socket.writtenText()).toContain('404 Not Found');
    });

    it('removeUploadListener faz com que requests futuras ao path resultem em 404', async () => {
      const handler = jest.fn(async () => ({ statusCode: 200, body: 'ok' }));
      module.addUploadListener('/api/upload', handler);
      module.removeUploadListener('/api/upload');

      await startModule(module);
      const socket = connect();
      await send(socket, buildHead('POST', '/api/upload', { 'Content-Length': '0' }));

      expect(handler).not.toHaveBeenCalled();
      expect(socket.writtenText()).toContain('404 Not Found');
    });
  });

  describe('start()', () => {
    it('resolve quando o bind da porta é bem-sucedido', async () => {
      const startPromise = module.start(PORT);
      expect(module.isRunning()).toBe(false);

      lastServer().triggerListening();
      await expect(startPromise).resolves.toBeUndefined();
      expect(module.isRunning()).toBe(true);
    });

    it('rejeita com mensagem contendo EADDRINUSE quando o servidor emite "error"', async () => {
      const startPromise = module.start(PORT);
      lastServer().emit('error', new Error('address already in use'));

      await expect(startPromise).rejects.toThrow(/EADDRINUSE/);
      expect(module.isRunning()).toBe(false);
    });
  });

  describe('stop()', () => {
    it('resolve imediatamente quando start() nunca foi chamado', async () => {
      await expect(module.stop()).resolves.toBeUndefined();
      expect(module.isRunning()).toBe(false);
    });

    it('destrói todos os sockets abertos rastreados e só resolve no close() do server', async () => {
      await startModule(module);
      const socketA = connect();
      const socketB = connect();

      expect(socketA.destroyed).toBe(false);
      expect(socketB.destroyed).toBe(false);

      await module.stop();

      expect(socketA.destroyed).toBe(true);
      expect(socketB.destroyed).toBe(true);
      expect(lastServer().closed).toBe(true);
      expect(module.isRunning()).toBe(false);
    });

    it('não tenta destruir de novo um socket que já fechou por conta própria (evento "error")', async () => {
      await startModule(module);
      const socket = connect();
      const destroySpy = jest.spyOn(socket, 'destroy');

      socket.emit('error', new Error('ECONNRESET'));
      expect(destroySpy).not.toHaveBeenCalled();

      await module.stop();

      // O socket já foi removido do rastreamento pelo handler de 'error' (cleanup()); stop()
      // não deveria tentar destruí-lo de novo.
      expect(destroySpy).not.toHaveBeenCalled();
    });
  });

  describe('requests "plain" completas', () => {
    it('entrega headers e corpo ao handler quando chegam no mesmo chunk', async () => {
      const handler = jest.fn(jsonHandler({ statusCode: 200, body: 'ok' }));
      module.addListener('/api', handler);
      await startModule(module);
      const socket = connect();

      const body = '{"foo":"bar"}';
      await send(
        socket,
        buildHead('POST', '/api/session', { 'Content-Length': String(Buffer.byteLength(body)) }) +
          body,
      );

      expect(handler).toHaveBeenCalledTimes(1);
      const [request] = handler.mock.calls[0] as [HttpServerRequest];
      expect(request.method).toBe('POST');
      expect(request.path).toBe('/api/session');
      expect(request.headers['content-length']).toBe(String(Buffer.byteLength(body)));
      expect(request.body).toBe(body);
    });

    it('GET sem Content-Length é finalizado imediatamente com body undefined', async () => {
      const handler = jest.fn(jsonHandler({ statusCode: 200, body: 'ok' }));
      module.addListener('/api', handler);
      await startModule(module);
      const socket = connect();

      await send(socket, buildHead('GET', '/api/session'));

      expect(handler).toHaveBeenCalledTimes(1);
      const [request] = handler.mock.calls[0] as [HttpServerRequest];
      expect(request.body).toBeUndefined();
    });

    it('trata Content-Length não numérico como 0', async () => {
      const handler = jest.fn(jsonHandler({ statusCode: 200, body: 'ok' }));
      module.addListener('/api', handler);
      await startModule(module);
      const socket = connect();

      await send(socket, buildHead('GET', '/api/session', { 'Content-Length': 'not-a-number' }));

      expect(handler).toHaveBeenCalledTimes(1);
      const [request] = handler.mock.calls[0] as [HttpServerRequest];
      expect(request.body).toBeUndefined();
    });

    it('acumula headers partidos em múltiplos chunks, inclusive no meio da request-line', async () => {
      const handler = jest.fn(jsonHandler({ statusCode: 200, body: 'ok' }));
      module.addListener('/api', handler);
      await startModule(module);
      const socket = connect();

      await send(socket, 'GET /api/sess');
      expect(handler).not.toHaveBeenCalled();
      await send(socket, 'ion HTTP/1.1\r\nHost: 127.0.0.1\r\n\r\n');

      expect(handler).toHaveBeenCalledTimes(1);
      const [request] = handler.mock.calls[0] as [HttpServerRequest];
      expect(request.path).toBe('/api/session');
      expect(request.headers.host).toBe('127.0.0.1');
    });

    it('ignora silenciosamente uma linha de header sem dois-pontos, preservando os demais headers', async () => {
      const handler = jest.fn(jsonHandler({ statusCode: 200, body: 'ok' }));
      module.addListener('/api', handler);
      await startModule(module);
      const socket = connect();

      await send(
        socket,
        'GET /api/session HTTP/1.1\r\nLinhaSemDoisPontos\r\nHost: 127.0.0.1\r\n\r\n',
      );

      expect(handler).toHaveBeenCalledTimes(1);
      const [request] = handler.mock.calls[0] as [HttpServerRequest];
      expect(request.headers.host).toBe('127.0.0.1');
    });

    it('entrega o corpo mesmo quando chega em chunks separados dos headers', async () => {
      const handler = jest.fn(jsonHandler({ statusCode: 200, body: 'ok' }));
      module.addListener('/api', handler);
      await startModule(module);
      const socket = connect();

      const bodyPart1 = 'abcde';
      const bodyPart2 = 'fghij';
      const fullBody = bodyPart1 + bodyPart2;

      await send(
        socket,
        buildHead('POST', '/api/upload-ish', { 'Content-Length': String(fullBody.length) }),
      );
      expect(handler).not.toHaveBeenCalled();

      await send(socket, bodyPart1);
      expect(handler).not.toHaveBeenCalled();

      await send(socket, bodyPart2);
      expect(handler).toHaveBeenCalledTimes(1);
      const [request] = handler.mock.calls[0] as [HttpServerRequest];
      expect(request.body).toBe(fullBody);
    });
  });

  describe('uploads em streaming', () => {
    it('entrega múltiplos chunks de corpo com requestId estável e isLast só no último', async () => {
      const received: HttpUploadChunk[] = [];
      const handler = jest.fn(async (chunk: HttpUploadChunk) => {
        received.push(chunk);
        return chunk.isLast ? { statusCode: 200, body: 'done' } : undefined;
      });
      module.addUploadListener('/api/upload', handler);
      await startModule(module);
      const socket = connect();

      const part1 = 'AAAAA';
      const part2 = 'BBBBB';
      const part3 = 'CCCCC';
      const total = part1.length + part2.length + part3.length;

      await send(
        socket,
        buildHead('POST', '/api/upload', { 'Content-Length': String(total) }) + part1,
      );
      await send(socket, part2);
      await send(socket, part3);

      expect(handler).toHaveBeenCalledTimes(3);
      expect(received.map((c) => c.data)).toEqual([part1, part2, part3]);
      expect(received.map((c) => c.isLast)).toEqual([false, false, true]);

      const requestIds = new Set(received.map((c) => c.requestId));
      expect(requestIds.size).toBe(1);
      expect(received[0].requestId).toEqual(expect.any(String));
      expect(received[0].requestId.length).toBeGreaterThan(0);
    });

    it('upload com Content-Length: 0 entrega um único chunk final com data vazio', async () => {
      const handler = jest.fn(async (chunk: HttpUploadChunk) =>
        chunk.isLast ? { statusCode: 200, body: 'done' } : undefined,
      );
      module.addUploadListener('/api/upload', handler);
      await startModule(module);
      const socket = connect();

      await send(socket, buildHead('POST', '/api/upload', { 'Content-Length': '0' }));

      expect(handler).toHaveBeenCalledTimes(1);
      const [chunk] = handler.mock.calls[0] as [HttpUploadChunk];
      expect(chunk.data).toBe('');
      expect(chunk.isLast).toBe(true);
    });

    it('processa um corpo grande simulado em muitos chunks pequenos de forma incremental (streaming real, não bufferizado)', async () => {
      const chunkSize = 37;
      const chunkCount = 50;
      const pieces = Array.from({ length: chunkCount }, (_unused, i) =>
        String(i % 10).repeat(chunkSize),
      );
      const total = pieces.join('');

      const received: HttpUploadChunk[] = [];
      const handler = jest.fn(async (chunk: HttpUploadChunk) => {
        received.push(chunk);
        return chunk.isLast ? { statusCode: 200, body: 'done' } : undefined;
      });
      module.addUploadListener('/api/upload', handler);
      await startModule(module);
      const socket = connect();

      await send(
        socket,
        buildHead('POST', '/api/upload', { 'Content-Length': String(total.length) }),
      );
      for (const piece of pieces) {
        await send(socket, piece);
      }

      // O handler foi chamado uma vez por chunk recebido (entrega incremental de verdade),
      // não uma única vez no final com tudo bufferizado.
      expect(handler).toHaveBeenCalledTimes(chunkCount);
      expect(received.map((c) => c.isLast)).toEqual([...Array(chunkCount - 1).fill(false), true]);
      expect(received.map((c) => c.data).join('')).toBe(total);
    });

    it('responde 500 internal_error por padrão se o handler não retornar resposta no chunk final', async () => {
      const handler = jest.fn(async () => undefined);
      module.addUploadListener('/api/upload', handler);
      await startModule(module);
      const socket = connect();

      await send(socket, buildHead('POST', '/api/upload', { 'Content-Length': '0' }));

      expect(socket.writtenText()).toContain('500 Internal Server Error');
      expect(socket.writtenText()).toContain('internal_error');
    });
  });

  describe('robustez da conexão', () => {
    it('não escreve nem destrói de novo se o socket já foi destruído externamente enquanto o handler processava', async () => {
      let resolveHandler: (value: HttpServerResponse) => void = () => undefined;
      const handler = jest.fn(
        () =>
          new Promise<HttpServerResponse>((resolve) => {
            resolveHandler = resolve;
          }),
      );
      module.addListener('/api', handler);
      await startModule(module);
      const socket = connect();
      const destroySpy = jest.spyOn(socket, 'destroy');

      await send(socket, buildHead('GET', '/api/session'));
      expect(handler).toHaveBeenCalledTimes(1);

      // Cliente desconecta (ex.: fecha o app) enquanto o handler ainda está processando.
      socket.destroy();
      expect(destroySpy).toHaveBeenCalledTimes(1);

      resolveHandler({ statusCode: 200, body: 'tarde demais' });
      await flush();

      expect(socket.written).toHaveLength(0);
      expect(destroySpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('erros de transporte', () => {
    it('responde 404 quando nenhuma rota casa com o path', async () => {
      await startModule(module);
      const socket = connect();

      await send(socket, buildHead('GET', '/api/nao-existe'));

      const text = socket.writtenText();
      expect(text).toContain('HTTP/1.1 404 Not Found');
      expect(text).toContain('not_found');
      expect(socket.destroyed).toBe(true);
    });

    it('responde 400 quando a request-line não tem exatamente 3 partes', async () => {
      await startModule(module);
      const socket = connect();

      await send(socket, 'REQUEST_LINE_INVALIDA\r\nHost: x\r\n\r\n');

      const text = socket.writtenText();
      expect(text).toContain('HTTP/1.1 400 Bad Request');
      expect(text).toContain('bad_request');
      expect(socket.destroyed).toBe(true);
    });

    it('responde 400 quando o header Transfer-Encoding está presente', async () => {
      const handler = jest.fn(jsonHandler({ statusCode: 200, body: 'ok' }));
      module.addListener('/api', handler);
      await startModule(module);
      const socket = connect();

      await send(
        socket,
        buildHead('POST', '/api/session', {
          'Transfer-Encoding': 'chunked',
          'Content-Length': '0',
        }),
      );

      const text = socket.writtenText();
      expect(text).toContain('HTTP/1.1 400 Bad Request');
      expect(text).toContain('transfer_encoding_not_supported');
      expect(handler).not.toHaveBeenCalled();
    });

    it('responde 431 quando o bloco de headers passa de 16KB sem terminador \\r\\n\\r\\n', async () => {
      await startModule(module);
      const socket = connect();

      const oversizedHeaderBlock = 'X'.repeat(16385);
      await send(socket, oversizedHeaderBlock);

      const text = socket.writtenText();
      expect(text).toContain('HTTP/1.1 431 Request Header Fields Too Large');
      expect(text).toContain('headers_too_large');
      expect(socket.destroyed).toBe(true);
    });

    it('responde 500 com a mensagem do erro quando o handler "plain" lança uma Error', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
      const handler = jest.fn(async () => {
        throw new Error('falha ao ler disco');
      });
      module.addListener('/api', handler);
      await startModule(module);
      const socket = connect();

      await send(socket, buildHead('GET', '/api/session'));

      const text = socket.writtenText();
      expect(text).toContain('HTTP/1.1 500 Internal Server Error');
      expect(text).toContain('falha ao ler disco');

      consoleErrorSpy.mockRestore();
    });

    it('responde 500 com internal_error quando o handler rejeita com algo que não é Error', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
      const handler = jest.fn(() => Promise.reject('string qualquer'));
      module.addListener('/api', handler);
      await startModule(module);
      const socket = connect();

      await send(socket, buildHead('GET', '/api/session'));

      const text = socket.writtenText();
      expect(text).toContain('HTTP/1.1 500 Internal Server Error');
      expect(text).toContain('internal_error');

      consoleErrorSpy.mockRestore();
    });
  });

  describe('escrita de resposta', () => {
    it('recalcula Content-Length a partir do corpo real, ignorando o que o handler mandou em headers', async () => {
      const handler = jest.fn(
        jsonHandler({
          statusCode: 200,
          headers: { 'Content-Length': '9999', 'X-Custom': 'abc' },
          body: 'ok',
        }),
      );
      module.addListener('/api', handler);
      await startModule(module);
      const socket = connect();

      await send(socket, buildHead('GET', '/api/session'));

      const text = socket.writtenText();
      expect(text).toContain('Content-Length: 2');
      expect(text).not.toContain('Content-Length: 9999');
      expect(text).toContain('X-Custom: abc');
    });

    it('sempre inclui Connection: close na resposta', async () => {
      const handler = jest.fn(jsonHandler({ statusCode: 200, body: 'ok' }));
      module.addListener('/api', handler);
      await startModule(module);
      const socket = connect();

      await send(socket, buildHead('GET', '/api/session'));

      expect(socket.writtenText()).toContain('Connection: close');
    });

    it('corpo undefined vira Content-Length: 0 e nenhum byte de corpo é escrito', async () => {
      const handler = jest.fn(jsonHandler({ statusCode: 204, headers: {} }));
      module.addListener('/api', handler);
      await startModule(module);
      const socket = connect();

      await send(socket, buildHead('GET', '/api/session'));

      const text = socket.writtenText();
      expect(text).toContain('Content-Length: 0');
      expect(text.endsWith('\r\n\r\n')).toBe(true);
    });

    it('aceita corpo como ArrayBuffer e calcula Content-Length a partir dos bytes reais', async () => {
      const payload = new Uint8Array([1, 2, 3, 4, 5]);
      const handler = jest.fn(jsonHandler({ statusCode: 200, body: payload.buffer }));
      module.addListener('/api', handler);
      await startModule(module);
      const socket = connect();

      await send(socket, buildHead('GET', '/api/session'));

      const text = socket.writtenText();
      expect(text).toContain('Content-Length: 5');
      const buffer = socket.writtenBuffer();
      const bodyStart = buffer.indexOf('\r\n\r\n') + 4;
      const bodyBytes = buffer.subarray(bodyStart);
      expect(Array.from(bodyBytes)).toEqual([1, 2, 3, 4, 5]);
    });

    it('aceita corpo como Buffer (fora do contrato de tipos, checagem defensiva em runtime) e calcula Content-Length a partir dos bytes', async () => {
      const payload = Buffer.from([9, 8, 7]);
      // `HttpServerResponse.body` só permite `string | ArrayBuffer` no contrato de tipos, mas
      // `writeResponse` também trata `Buffer` defensivamente em runtime — forçamos o cast para
      // exercitar esse caminho.
      const handler = jest.fn(
        async () => ({ statusCode: 200, body: payload }) as unknown as HttpServerResponse,
      );
      module.addListener('/api', handler);
      await startModule(module);
      const socket = connect();

      await send(socket, buildHead('GET', '/api/session'));

      const text = socket.writtenText();
      expect(text).toContain('Content-Length: 3');
      const buffer = socket.writtenBuffer();
      const bodyStart = buffer.indexOf('\r\n\r\n') + 4;
      expect(Array.from(buffer.subarray(bodyStart))).toEqual([9, 8, 7]);
    });
  });

  describe('corpo de resposta em streaming (T-804)', () => {
    it('escreve múltiplos chunks em sequência, nunca pedindo/escrevendo o próximo antes do write() anterior confirmar', async () => {
      const chunk1 = Buffer.from('AAAA');
      const chunk2 = Buffer.from('BBBB');
      const chunk3 = Buffer.from('CCCC');
      const { chunks, pulls } = trackedChunkSource([chunk1, chunk2, chunk3]);
      const totalBytes = chunk1.length + chunk2.length + chunk3.length;

      const streamedBody: HttpStreamedBody = { kind: 'stream', totalBytes, chunks };
      const handler = jest.fn(
        jsonHandler({
          statusCode: 200,
          headers: { 'Content-Type': 'application/octet-stream' },
          body: streamedBody,
        }),
      );
      module.addListener('/api', handler);
      await startModule(module);
      const socket = connect();
      socket.deferWriteCallbacks = true;

      await send(socket, buildHead('GET', '/api/session'));

      // Só o head foi escrito até agora — a confirmação do head ainda não foi
      // disparada, então writeStreamedBody nem começou a puxar chunks.
      expect(socket.written).toHaveLength(1);
      expect(socket.pendingWriteCount).toBe(1);
      expect(pulls).toEqual([]);
      const headText = Buffer.isBuffer(socket.written[0].data)
        ? socket.written[0].data.toString('utf8')
        : socket.written[0].data;
      expect(headText).toContain(`Content-Length: ${totalBytes}`);

      // Confirma o head -> writeStreamedBody pede e escreve o 1º chunk (mas sua
      // confirmação também fica pendente).
      socket.flushNextWrite();
      await flush();
      expect(pulls).toEqual([0]);
      expect(socket.written).toHaveLength(2);
      expect(socket.pendingWriteCount).toBe(1);

      // Confirma o chunk 1 -> só agora o chunk 2 é pedido/escrito.
      socket.flushNextWrite();
      await flush();
      expect(pulls).toEqual([0, 1]);
      expect(socket.written).toHaveLength(3);
      expect(socket.pendingWriteCount).toBe(1);

      // Confirma o chunk 2 -> só agora o chunk 3 é pedido/escrito.
      socket.flushNextWrite();
      await flush();
      expect(pulls).toEqual([0, 1, 2]);
      expect(socket.written).toHaveLength(4);
      expect(socket.pendingWriteCount).toBe(1);

      // Confirma o chunk 3 -> loop termina, onFlushed() destrói a conexão.
      expect(socket.destroyed).toBe(false);
      socket.flushNextWrite();
      await flush();

      expect(socket.destroyed).toBe(true);
      const fullBuffer = socket.writtenBuffer();
      const bodyStart = fullBuffer.indexOf(Buffer.from('\r\n\r\n')) + 4;
      const bodyBytes = fullBuffer.subarray(bodyStart);
      expect(bodyBytes.equals(Buffer.concat([chunk1, chunk2, chunk3]))).toBe(true);
    });

    it('para de puxar chunks e não escreve mais nada se o socket for destruído no meio do streaming', async () => {
      const chunk1 = Buffer.from('AAAA');
      const chunk2 = Buffer.from('BBBB');
      const { chunks, pulls } = trackedChunkSource([chunk1, chunk2]);
      const streamedBody: HttpStreamedBody = { kind: 'stream', totalBytes: 8, chunks };

      module.addListener('/api', jest.fn(jsonHandler({ statusCode: 200, body: streamedBody })));
      await startModule(module);
      const socket = connect();
      socket.deferWriteCallbacks = true;

      await send(socket, buildHead('GET', '/api/session'));
      socket.flushNextWrite(); // confirma o head -> pede/escreve chunk1
      await flush();

      expect(pulls).toEqual([0]);
      expect(socket.written).toHaveLength(2); // head + chunk1

      // Cliente cai no meio do streaming, antes do chunk1 ser confirmado.
      socket.destroy();
      await flush();

      // writeStreamedBody nunca deveria continuar puxando/escrevendo chunk2 para um
      // socket morto.
      expect(pulls).toEqual([0]);
      expect(socket.written).toHaveLength(2);
    });

    it('se o socket for destruído enquanto o próximo chunk ainda está sendo lido, descarta o chunk (libera o iterator) sem escrevê-lo nem chamar onFlushed de novo', async () => {
      const chunk1 = Buffer.from('AAAA');
      const chunk2 = Buffer.from('BBBB');
      const returnSpy = jest.fn(async () => ({ value: undefined, done: true }) as const);
      // Objeto-holder (em vez de `let` capturado diretamente) para evitar que o
      // TypeScript estreite `releaseChunk2Read` para `null` no ponto de leitura —
      // a única atribuição visível fica dentro do closure assíncrono abaixo.
      const gate: { release: (() => void) | null } = { release: null };
      let step = 0;

      // Iterable manual (em vez de `async function*`) para controlar com precisão
      // quando a leitura do 2º chunk "termina" — simula uma leitura de disco lenta
      // (ex.: bloco grande) que ainda está em andamento quando o cliente cai.
      const chunks: AsyncIterable<Buffer> = {
        [Symbol.asyncIterator]() {
          return {
            async next() {
              if (step === 0) {
                step = 1;
                return { value: chunk1, done: false };
              }
              if (step === 1) {
                step = 2;
                await new Promise<void>((resolve) => {
                  gate.release = resolve;
                });
                return { value: chunk2, done: false };
              }
              return { value: undefined, done: true };
            },
            return: returnSpy,
          };
        },
      };
      const streamedBody: HttpStreamedBody = { kind: 'stream', totalBytes: 8, chunks };

      module.addListener('/api', jest.fn(jsonHandler({ statusCode: 200, body: streamedBody })));
      await startModule(module);
      const socket = connect();
      const destroySpy = jest.spyOn(socket, 'destroy');

      await send(socket, buildHead('GET', '/api/session'));
      await flush();

      // chunk1 já foi escrito e confirmado (write síncrono do mock); a leitura do
      // chunk2 está em andamento (presa no gate controlado acima).
      expect(socket.written).toHaveLength(2); // head + chunk1
      expect(destroySpy).not.toHaveBeenCalled();

      // Cliente cai enquanto a leitura do chunk2 ainda está pendente.
      socket.destroy();
      expect(destroySpy).toHaveBeenCalledTimes(1);

      // A leitura "lenta" do chunk2 finalmente termina — mas o socket já está
      // destruído nesse momento.
      gate.release?.();
      await flush();

      // O chunk2, mesmo já lido, nunca é escrito num socket morto; o iterator é
      // liberado corretamente (return()); e destroy() não é chamado de novo.
      expect(socket.written).toHaveLength(2);
      expect(returnSpy).toHaveBeenCalledTimes(1);
      expect(destroySpy).toHaveBeenCalledTimes(1);
    });

    it('destrói a conexão sem nunca fingir sucesso quando o AsyncIterable de chunks falha no meio do streaming', async () => {
      const chunk1 = Buffer.from('OK--');
      const streamError = new Error('falha simulada de leitura no meio do stream');

      async function* failingChunks(): AsyncGenerator<Buffer> {
        yield chunk1;
        throw streamError;
      }

      // Content-Length anunciado (100) é bem maior do que o que de fato será
      // entregue — replica o cenário real: os headers 200 já foram escritos
      // anunciando o tamanho total antes da falha de leitura no meio do arquivo.
      const streamedBody: HttpStreamedBody = {
        kind: 'stream',
        totalBytes: 100,
        chunks: failingChunks(),
      };

      module.addListener('/api', jest.fn(jsonHandler({ statusCode: 200, body: streamedBody })));
      await startModule(module);
      const socket = connect();
      const destroySpy = jest.spyOn(socket, 'destroy');
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);

      await send(socket, buildHead('GET', '/api/session'));
      await flush();

      // A conexão é destruída (única opção correta sem chunked encoding), mas
      // nunca da forma "onFlushed" de sucesso normal — o catch de
      // writeStreamedBody chama socket.destroy() diretamente.
      expect(socket.destroyed).toBe(true);
      expect(destroySpy).toHaveBeenCalledTimes(1);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Erro ao ler/escrever corpo em streaming'),
        streamError,
      );

      const fullBuffer = socket.writtenBuffer();
      const bodyStart = fullBuffer.indexOf(Buffer.from('\r\n\r\n')) + 4;
      const bodyBytes = fullBuffer.subarray(bodyStart);
      // Só o chunk confirmado antes da falha chegou ao socket — nunca os 100
      // bytes anunciados em Content-Length, e nunca uma resposta completa "de
      // sucesso" com dado inventado/truncado silenciosamente.
      expect(bodyBytes.equals(chunk1)).toBe(true);
      expect(bodyBytes.length).toBeLessThan(100);

      consoleErrorSpy.mockRestore();
    });
  });

  describe('bytes binary-safe', () => {
    it('entrega bytes de upload que não formam UTF-8 válido intactos no chunk.data', async () => {
      const rawBytes = Buffer.from([0xff, 0x00, 0xfe, 0x80, 0x01, 0xc0, 0xaf]);

      const received: HttpUploadChunk[] = [];
      const handler = jest.fn(async (chunk: HttpUploadChunk) => {
        received.push(chunk);
        return chunk.isLast ? { statusCode: 200, body: 'done' } : undefined;
      });
      module.addUploadListener('/api/upload', handler);
      await startModule(module);
      const socket = connect();

      const headHex = Buffer.from(
        buildHead('POST', '/api/upload', { 'Content-Length': String(rawBytes.length) }),
        'utf8',
      );
      await send(socket, Buffer.concat([headHex, rawBytes]));

      expect(received).toHaveLength(1);
      const roundTripped = Buffer.from(received[0].data, 'binary');
      expect(roundTripped.equals(rawBytes)).toBe(true);
    });

    it('entrega bytes binários intactos mesmo quando chegam como Buffer em chunk separado dos headers', async () => {
      const rawBytes = Buffer.from([0x00, 0xff, 0x81, 0x7f, 0xc3, 0x28]);

      const received: HttpUploadChunk[] = [];
      const handler = jest.fn(async (chunk: HttpUploadChunk) => {
        received.push(chunk);
        return chunk.isLast ? { statusCode: 200, body: 'done' } : undefined;
      });
      module.addUploadListener('/api/upload', handler);
      await startModule(module);
      const socket = connect();

      await send(
        socket,
        buildHead('POST', '/api/upload', { 'Content-Length': String(rawBytes.length) }),
      );
      await send(socket, rawBytes);

      expect(received).toHaveLength(1);
      const roundTripped = Buffer.from(received[0].data, 'binary');
      expect(roundTripped.equals(rawBytes)).toBe(true);
      expect(received[0].isLast).toBe(true);
    });
  });

  describe('remoteAddress (T-602)', () => {
    it('propaga socket.remoteAddress na request "plain"', async () => {
      const handler = jest.fn(jsonHandler({ statusCode: 200, body: 'ok' }));
      module.addListener('/api', handler);
      await startModule(module);
      const socket = connect();
      socket.remoteAddress = '203.0.113.5';

      await send(socket, buildHead('GET', '/api/session'));

      expect(handler).toHaveBeenCalledTimes(1);
      const [request] = handler.mock.calls[0] as [HttpServerRequest];
      expect(request.remoteAddress).toBe('203.0.113.5');
    });

    it('usa "desconhecido" quando o socket não tem remoteAddress (request "plain")', async () => {
      const handler = jest.fn(jsonHandler({ statusCode: 200, body: 'ok' }));
      module.addListener('/api', handler);
      await startModule(module);
      const socket = connect();

      await send(socket, buildHead('GET', '/api/session'));

      expect(handler).toHaveBeenCalledTimes(1);
      const [request] = handler.mock.calls[0] as [HttpServerRequest];
      expect(request.remoteAddress).toBe('desconhecido');
    });

    it('propaga socket.remoteAddress em cada chunk de upload em streaming', async () => {
      const receivedRequests: Omit<HttpServerRequest, 'body'>[] = [];
      const handler = jest.fn(
        async (chunk: HttpUploadChunk, request: Omit<HttpServerRequest, 'body'>) => {
          receivedRequests.push(request);
          return chunk.isLast ? { statusCode: 200, body: 'done' } : undefined;
        },
      );
      module.addUploadListener('/api/upload', handler);
      await startModule(module);
      const socket = connect();
      socket.remoteAddress = '198.51.100.7';

      await send(socket, buildHead('POST', '/api/upload', { 'Content-Length': '10' }) + 'AAAAA');
      await send(socket, 'BBBBB');

      expect(receivedRequests).toHaveLength(2);
      expect(receivedRequests.every((r) => r.remoteAddress === '198.51.100.7')).toBe(true);
    });

    it('usa "desconhecido" quando o socket não tem remoteAddress (upload em streaming)', async () => {
      const handler = jest.fn(
        async (chunk: HttpUploadChunk, _request: Omit<HttpServerRequest, 'body'>) =>
          chunk.isLast ? { statusCode: 200, body: 'done' } : undefined,
      );
      module.addUploadListener('/api/upload', handler);
      await startModule(module);
      const socket = connect();

      await send(socket, buildHead('POST', '/api/upload', { 'Content-Length': '0' }));

      expect(handler).toHaveBeenCalledTimes(1);
      const [, request] = handler.mock.calls[0];
      expect(request.remoteAddress).toBe('desconhecido');
    });
  });
});
