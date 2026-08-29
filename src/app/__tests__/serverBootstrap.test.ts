/**
 * Testes para `serverBootstrap.ts` (T-405): a fiação real do servidor HTTP embarcado.
 *
 * Diferente de `apiSetup.test.ts` (que testa `registerFileRoutes`/`registerUploadRoute`/
 * `registerEventsRoute` isoladamente, com um `ApiRouter`/`HttpModule` fake), esta suíte prova
 * a LIGAÇÃO real entre `nativeHttpModule.ts` (T-405) + `ApiRouterImpl` (T-203) + as rotas de
 * `apiSetup.ts`, através de `initServer()` de verdade — a única peça mockada é a fronteira de
 * I/O inevitável (`react-native-tcp-socket` via o fake de
 * `features/server/services/testing/tcpSocketMock.ts`, já usado por `nativeHttpModule.test.ts`
 * — reaproveitado aqui, não duplicado — e `expo-file-system`, que já tem mock automático
 * global do projeto em `__mocks__/expo-file-system.ts`).
 *
 * `createDefaultHttpModule`/`setHttpModule`/`createApiRouter`/`createFileRepository`/
 * `createFilesChangedAtTracker`/`registerFileRoutes`/`registerUploadRoute`/
 * `registerEventsRoute` são mockados via `jest.mock(path, () => ({ ...jest.requireActual(path),
 * fn: jest.fn(actual.fn) }))` — ou seja, o módulo inteiro continua sendo a implementação REAL
 * (`requireActual`), só que a função específica é envelopada por um `jest.fn()` que chama a
 * implementação real por baixo. Isso nos deixa contar quantas vezes cada uma roda (prova de
 * idempotência de `initServer()`) sem trocar nenhum comportamento — inclusive para os testes
 * de integração HTTP mais abaixo, que continuam batendo na pilha 100% real.
 *
 * Essa técnica de substituição em nível de módulo (em vez de `jest.spyOn` num namespace
 * importado) é usada de propósito: garante a interceptação independentemente de como o
 * `ts-jest` compila as chamadas internas de `serverBootstrap.ts` para os módulos importados.
 */

import type { HttpModule } from '../../features/server/services/httpModule';
import {
  MockServer,
  MockSocket,
  createdServers,
} from '../../features/server/services/testing/tcpSocketMock';
import { createDefaultHttpModule } from '../../features/server/services/nativeHttpModule';
import { setHttpModule } from '../../features/server/services/serverServiceFactory';
import { createApiRouter } from '../../features/server/services/apiRouterFactory';
import { createFileRepository } from '../../features/files/services/fileRepositoryFactory';
import { createFilesChangedAtTracker } from '../../shared/lib/filesChangedAtTracker';
import {
  registerFileRoutes,
  registerUploadRoute,
  registerEventsRoute,
  registerWebUiRoute,
} from '../apiSetup';
import { WEB_UI_HTML } from '../../web-ui/webUiHtml';
// Importado por último de propósito: `initServer()`/`getCurrentSessionId`/`setCurrentSessionId`
// têm estado de módulo (singleton) compartilhado por todo este arquivo — não há
// `jest.resetModules()` entre os testes, então a ordem de declaração importa (ver comentário
// no describe de idempotência).
import { initServer, getCurrentSessionId, setCurrentSessionId } from '../serverBootstrap';

// `jest.mock(...)` é hoistado pelo ts-jest para antes de todos os imports acima, então a
// ordem de escrita (mocks depois dos imports, aqui) não afeta o comportamento — só deixa o
// arquivo com os imports agrupados no topo (regra `import/first` do ESLint).
jest.mock('react-native-tcp-socket', () =>
  require('../../features/server/services/testing/tcpSocketMock').createTcpSocketModule(),
);

jest.mock('../../features/server/services/nativeHttpModule', () => {
  const actual = jest.requireActual('../../features/server/services/nativeHttpModule');
  return { ...actual, createDefaultHttpModule: jest.fn(actual.createDefaultHttpModule) };
});

jest.mock('../../features/server/services/serverServiceFactory', () => {
  const actual = jest.requireActual('../../features/server/services/serverServiceFactory');
  return { ...actual, setHttpModule: jest.fn(actual.setHttpModule) };
});

jest.mock('../../features/server/services/apiRouterFactory', () => {
  const actual = jest.requireActual('../../features/server/services/apiRouterFactory');
  return { ...actual, createApiRouter: jest.fn(actual.createApiRouter) };
});

jest.mock('../../features/files/services/fileRepositoryFactory', () => {
  const actual = jest.requireActual('../../features/files/services/fileRepositoryFactory');
  return { ...actual, createFileRepository: jest.fn(actual.createFileRepository) };
});

jest.mock('../../shared/lib/filesChangedAtTracker', () => {
  const actual = jest.requireActual('../../shared/lib/filesChangedAtTracker');
  return { ...actual, createFilesChangedAtTracker: jest.fn(actual.createFilesChangedAtTracker) };
});

jest.mock('../apiSetup', () => {
  const actual = jest.requireActual('../apiSetup');
  return {
    ...actual,
    registerFileRoutes: jest.fn(actual.registerFileRoutes),
    registerUploadRoute: jest.fn(actual.registerUploadRoute),
    registerEventsRoute: jest.fn(actual.registerEventsRoute),
    registerWebUiRoute: jest.fn(actual.registerWebUiRoute),
  };
});

const PORT = 8080;

/** Aguarda o esvaziamento completo da fila de microtasks (todas as promises pendentes). */
async function flush(): Promise<void> {
  await new Promise<void>((resolve) => setImmediate(resolve));
}

function connect(server: MockServer): MockSocket {
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

/** Extrai e faz parse do corpo JSON de tudo que foi escrito no socket. */
function jsonBody(socket: MockSocket): unknown {
  const text = socket.writtenText();
  const bodyStart = text.indexOf('\r\n\r\n') + 4;
  return JSON.parse(text.slice(bodyStart));
}

function statusLine(socket: MockSocket): string {
  return socket.writtenText().split('\r\n')[0];
}

describe('serverBootstrap', () => {
  describe('getCurrentSessionId / setCurrentSessionId', () => {
    it('reflete o valor setado por setCurrentSessionId', () => {
      setCurrentSessionId('sessao-abc-123');
      expect(getCurrentSessionId()).toBe('sessao-abc-123');
    });

    it('reflete atualizações sucessivas (não fica preso ao primeiro valor)', () => {
      setCurrentSessionId('primeira-sessao');
      expect(getCurrentSessionId()).toBe('primeira-sessao');

      setCurrentSessionId('segunda-sessao');
      expect(getCurrentSessionId()).toBe('segunda-sessao');
    });
  });

  describe('initServer()', () => {
    // `initServer()` tem uma flag `initialized` de módulo — a PRIMEIRA chamada em todo este
    // arquivo é a que importa para o teste de idempotência abaixo, e o `httpModule` real
    // resultante é reaproveitado pelos testes de integração HTTP mais abaixo (chamadas
    // adicionais a `initServer()` depois desta são, por design, no-ops).
    //
    // Importante: `jest.config.js` tem `clearMocks: true`, que zera `mock.calls`/`mock.results`
    // de TODO mock antes de CADA teste — inclusive antes do primeiro `it()` que roda depois de
    // um `beforeAll`. Por isso as chamadas a `initServer()` e as asserções de call-count
    // precisam estar no mesmo `it()` (não divididas entre `beforeAll` e `it()`), senão o
    // histórico de chamadas já teria sido limpo antes da asserção rodar.
    let httpModule: HttpModule;

    it('executa a fiação (HttpModule, ApiRouter, FileRepository, tracker e as 4 rotas) uma única vez, mesmo chamado 3x', () => {
      // Chamada 3x de propósito: só a primeira deve produzir efeito observável.
      initServer();
      initServer();
      initServer();

      httpModule = (createDefaultHttpModule as jest.Mock).mock.results[0].value as HttpModule;

      expect(createDefaultHttpModule).toHaveBeenCalledTimes(1);
      expect(setHttpModule).toHaveBeenCalledTimes(1);
      expect(setHttpModule).toHaveBeenCalledWith(httpModule);
      expect(createApiRouter).toHaveBeenCalledTimes(1);
      expect(createFileRepository).toHaveBeenCalledTimes(1);
      expect(createFilesChangedAtTracker).toHaveBeenCalledTimes(1);
      expect(registerFileRoutes).toHaveBeenCalledTimes(1);
      expect(registerUploadRoute).toHaveBeenCalledTimes(1);
      expect(registerEventsRoute).toHaveBeenCalledTimes(1);
      expect(registerWebUiRoute).toHaveBeenCalledTimes(1);
      expect(registerWebUiRoute).toHaveBeenCalledWith(httpModule);
    });

    describe('requisições HTTP reais contra a pilha completa (nativeHttpModule + ApiRouterImpl + rotas de apiSetup.ts)', () => {
      let server: MockServer;

      beforeAll(async () => {
        const startPromise = httpModule.start(PORT);
        // O fake registra o server assim que `TcpSocket.createServer(...)` é chamado
        // (dentro de `httpModule.start`), de forma síncrona.
        server = createdServers[createdServers.length - 1];
        server.triggerListening();
        await startPromise;
      });

      afterAll(async () => {
        await httpModule.stop();
      });

      it('GET /api/session → 200, com o sessionId real atualizado via setCurrentSessionId', async () => {
        setCurrentSessionId('e2e-session-xyz');
        const socket = connect(server);

        await send(socket, buildHead('GET', '/api/session'));

        expect(statusLine(socket)).toBe('HTTP/1.1 200 OK');
        const body = jsonBody(socket) as {
          sessionId: string;
          appVersion: string;
          maxUploadBytes: number;
        };
        expect(body.sessionId).toBe('e2e-session-xyz');
        expect(body.appVersion).toEqual(expect.any(String));
        expect(body.maxUploadBytes).toBe(4 * 1024 * 1024 * 1024);
      });

      it('GET /api/files → 200, com lista de arquivos (vazia — sem arquivos reais no ambiente de teste)', async () => {
        const socket = connect(server);

        await send(socket, buildHead('GET', '/api/files'));

        expect(statusLine(socket)).toBe('HTTP/1.1 200 OK');
        const body = jsonBody(socket) as { files: unknown[] };
        expect(Array.isArray(body.files)).toBe(true);
        expect(body.files).toEqual([]);
      });

      it('GET /api/files/:id/download com id inexistente → 404 FILE_NOT_FOUND', async () => {
        const socket = connect(server);

        await send(socket, buildHead('GET', '/api/files/id-que-nao-existe/download'));

        expect(statusLine(socket)).toBe('HTTP/1.1 404 Not Found');
        const body = jsonBody(socket) as { error: { code: string } };
        expect(body.error.code).toBe('FILE_NOT_FOUND');
      });

      it('POST /api/upload sem boundary multipart válido → 400 INVALID_MULTIPART (sem tocar disco)', async () => {
        // Content-Type sem "boundary=" faz `registerUploadRoute` responder 400 antes de
        // qualquer chamada a `fileRepository.beginStreamedWrite` — não depende de disco/fs
        // real, então dá para exercitar esse caminho de erro sem simular um upload completo.
        const socket = connect(server);

        await send(
          socket,
          buildHead('POST', '/api/upload', {
            'Content-Type': 'multipart/form-data',
            'Content-Length': '0',
          }),
        );

        expect(statusLine(socket)).toBe('HTTP/1.1 400 Bad Request');
        const body = jsonBody(socket) as { error: { code: string } };
        expect(body.error.code).toBe('INVALID_MULTIPART');
      });

      it('GET /api/events → 200, com filesChangedAt (epoch ms)', async () => {
        const socket = connect(server);

        await send(socket, buildHead('GET', '/api/events'));

        expect(statusLine(socket)).toBe('HTTP/1.1 200 OK');
        const body = jsonBody(socket) as { filesChangedAt: number };
        expect(typeof body.filesChangedAt).toBe('number');
        expect(body.filesChangedAt).toBeGreaterThan(0);
      });

      it('GET / → 200, com Content-Type text/html e o corpo WEB_UI_HTML (T-501, rota real)', async () => {
        const socket = connect(server);

        await send(socket, buildHead('GET', '/'));

        expect(statusLine(socket)).toBe('HTTP/1.1 200 OK');
        const text = socket.writtenText();
        expect(text).toContain('Content-Type: text/html; charset=utf-8');

        // O corpo tem acentos (UTF-8 multi-byte) — `writtenText()` decodifica tudo como
        // 'binary' (byte-a-byte, ver `tcpSocketMock.ts`), por isso comparamos via o
        // buffer bruto decodificado como utf8, em vez da string `text` já mangled.
        const buffer = socket.writtenBuffer();
        const headerEnd = buffer.indexOf('\r\n\r\n');
        const body = buffer.subarray(headerEnd + 4).toString('utf8');
        expect(body).toBe(WEB_UI_HTML);
      });
    });
  });
});
