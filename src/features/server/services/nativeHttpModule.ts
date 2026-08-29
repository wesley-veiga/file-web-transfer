/**
 * Implementação nativa do `HttpModule` sobre `react-native-tcp-socket`.
 *
 * ## Por que não uma lib HTTP pronta?
 * A lib originalmente escolhida em T-202 (`react-native-http-bridge-refurbished`) bufferiza
 * o corpo inteiro do request/response nativamente antes de entregar um único evento JS — o
 * que torna impossível fazer upload/download em streaming sem carregar o arquivo inteiro em
 * memória. Decisão revertida (ADR-001 §8, emenda v1.2) para a Alternativa 2.2 do ADR:
 * implementar um servidor HTTP/1.1 mínimo por cima de um socket TCP cru
 * (`react-native-tcp-socket`), processando o corpo do request incrementalmente conforme os
 * eventos `data` do socket chegam.
 *
 * ## Escopo deliberadamente reduzido
 * Este não é um servidor HTTP completo — é o mínimo necessário para atender as rotas de
 * `src/app/apiSetup.ts`:
 * - Sem suporte a `Transfer-Encoding: chunked` (os clientes desta API sempre mandam
 *   `Content-Length`, seja no upload multipart, seja nos requests GET sem corpo).
 * - Sem keep-alive/pipelining: cada conexão atende exatamente um request e a resposta
 *   sempre inclui `Connection: close`.
 * - Sem HTTP/1.0.
 * - Sem requests sem `Content-Length` quando um corpo é esperado.
 *
 * ## Roteamento
 * `addListener`/`addUploadListener` apenas guardam handlers por path (prefixo). O
 * `ApiRouter` (T-401) registra um único catch-all em `/api` via `addListener`; rotas de
 * upload (ex.: `/api/upload`) são registradas separadamente via `addUploadListener` porque
 * seu corpo precisa ser entregue em chunks (streaming), nunca bufferizado inteiro.
 *
 * ## Parsing por conexão
 * Cada socket aceito acumula bytes até encontrar o fim dos headers (`\r\n\r\n`). A partir
 * daí, o restante dos bytes recebidos (nesse mesmo chunk + chunks seguintes) é o corpo:
 * entregue de uma vez ao handler "plain" (rotas sem streaming) ou incrementalmente ao
 * handler de upload. Backpressure é respeitado pausando o socket enquanto o chunk atual
 * está sendo processado (o handler pode ser assíncrono — ex.: escrita em disco).
 */

import TcpSocket from 'react-native-tcp-socket';
import { Buffer } from 'buffer';
import type Socket from 'react-native-tcp-socket/lib/types/Socket';
import type Server from 'react-native-tcp-socket/lib/types/Server';
import type {
  HttpModule,
  HttpServerRequest,
  HttpServerResponse,
  HttpServerRequestHandler,
  HttpUploadChunk,
  HttpUploadChunkHandler,
} from './httpModule';

/** Tamanho máximo permitido para o bloco de headers antes de responder 431. */
const MAX_HEADER_BYTES = 16384;

/** Mapa de status HTTP → texto, usado na linha de status da resposta. */
const STATUS_TEXTS: Record<number, string> = {
  200: 'OK',
  201: 'Created',
  400: 'Bad Request',
  404: 'Not Found',
  413: 'Payload Too Large',
  422: 'Unprocessable Entity',
  431: 'Request Header Fields Too Large',
  500: 'Internal Server Error',
  507: 'Insufficient Storage',
};

type MatchedRoute =
  | { kind: 'plain'; handler: HttpServerRequestHandler }
  | { kind: 'upload'; handler: HttpUploadChunkHandler };

/**
 * Extrai o pathname (sem query string) de um path de request.
 * Ex.: "/api/files?origin=shared" → "/api/files"
 */
function extractPathname(path: string): string {
  const idx = path.indexOf('?');
  return idx === -1 ? path : path.substring(0, idx);
}

/**
 * Cria um corpo JSON simples de erro, usado apenas para erros de transporte
 * (antes de qualquer handler de negócio ser chamado) — não usa o schema
 * `apiErrorSchema` de propósito, para não acoplar esta camada de transporte
 * ao contrato de API definido em `shared/types/api`.
 */
function transportErrorResponse(statusCode: number, error: string): HttpServerResponse {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ error }),
  };
}

/**
 * Cria a implementação padrão de `HttpModule` sobre `react-native-tcp-socket`.
 */
export function createDefaultHttpModule(): HttpModule {
  const listeners = new Map<string, HttpServerRequestHandler>();
  const uploadListeners = new Map<string, HttpUploadChunkHandler>();

  let server: Server | null = null;
  let running = false;
  const openSockets = new Set<Socket>();

  /**
   * Encontra o handler cujo path registrado é o prefixo mais longo do pathname.
   * Uploads têm prioridade sobre rotas "plain": se um path bater em ambos os
   * mapas (não deveria acontecer na prática, mas é uma regra determinística),
   * upload vence.
   */
  function findHandler(pathname: string): MatchedRoute | null {
    let bestUpload: { path: string; handler: HttpUploadChunkHandler } | null = null;
    for (const [path, handler] of uploadListeners) {
      if (pathname.startsWith(path) && (!bestUpload || path.length > bestUpload.path.length)) {
        bestUpload = { path, handler };
      }
    }
    if (bestUpload) {
      return { kind: 'upload', handler: bestUpload.handler };
    }

    let bestPlain: { path: string; handler: HttpServerRequestHandler } | null = null;
    for (const [path, handler] of listeners) {
      if (pathname.startsWith(path) && (!bestPlain || path.length > bestPlain.path.length)) {
        bestPlain = { path, handler };
      }
    }
    if (bestPlain) {
      return { kind: 'plain', handler: bestPlain.handler };
    }

    return null;
  }

  /**
   * Serializa e escreve uma HttpServerResponse no socket.
   * Recalcula sempre o Content-Length a partir do corpo real (nunca confia
   * no que o handler informou em `response.headers`).
   */
  function writeResponse(socket: Socket, response: HttpServerResponse): void {
    const statusText = STATUS_TEXTS[response.statusCode] ?? 'Unknown';

    let bodyBuffer: Buffer;
    if (response.body === undefined) {
      bodyBuffer = Buffer.alloc(0);
    } else if (Buffer.isBuffer(response.body)) {
      bodyBuffer = response.body as unknown as Buffer;
    } else if (response.body instanceof ArrayBuffer) {
      bodyBuffer = Buffer.from(response.body);
    } else {
      bodyBuffer = Buffer.from(String(response.body), 'utf8');
    }

    const headerLines = [`HTTP/1.1 ${response.statusCode} ${statusText}`];
    for (const [key, value] of Object.entries(response.headers ?? {})) {
      if (key.toLowerCase() === 'content-length') {
        continue;
      }
      headerLines.push(`${key}: ${value}`);
    }
    headerLines.push(`Content-Length: ${bodyBuffer.length}`);
    headerLines.push('Connection: close');

    const head = headerLines.join('\r\n') + '\r\n\r\n';

    if (!socket.destroyed) {
      socket.write(head, 'utf8');
      socket.write(bodyBuffer);
    }
  }

  /**
   * Trata uma única conexão TCP aceita pelo servidor: parseia a linha de
   * status + headers, encontra a rota, e entrega o corpo (plain ou upload).
   */
  function handleConnection(socket: Socket): void {
    openSockets.add(socket);

    let headerBuffer = '';
    let headersParsed = false;
    let responded = false;

    let method = '';
    let pathname = '';
    let fullPath = '';
    let headersMap: Record<string, string> = {};
    let contentLength = 0;

    let bodyReceived = 0;
    let requestId = '';
    let matched: MatchedRoute | null = null;
    const plainBodyChunks: string[] = [];

    function cleanup(): void {
      openSockets.delete(socket);
    }

    function respondAndDestroy(response: HttpServerResponse): void {
      if (!responded && !socket.destroyed) {
        responded = true;
        writeResponse(socket, response);
      }
      if (!socket.destroyed) {
        socket.destroy();
      }
    }

    function parseHeadPart(headPart: string): boolean {
      const lines = headPart.split('\r\n');
      const requestLine = lines[0] ?? '';
      const requestLineParts = requestLine.split(' ');
      if (requestLineParts.length !== 3) {
        return false;
      }
      method = requestLineParts[0];
      fullPath = requestLineParts[1];
      pathname = extractPathname(fullPath);

      const map: Record<string, string> = {};
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i];
        if (!line) {
          continue;
        }
        const colonIdx = line.indexOf(':');
        if (colonIdx === -1) {
          continue;
        }
        const key = line.substring(0, colonIdx).trim().toLowerCase();
        const value = line.substring(colonIdx + 1).trim();
        map[key] = value;
      }
      headersMap = map;
      return true;
    }

    async function deliverUploadChunk(data: string, isLast: boolean): Promise<void> {
      if (matched === null || matched.kind !== 'upload') {
        return;
      }
      const chunk: HttpUploadChunk = { requestId, data, isLast };
      const request: Omit<HttpServerRequest, 'body'> = {
        method,
        path: fullPath,
        headers: headersMap,
      };
      const result = await matched.handler(chunk, request);
      if (isLast) {
        respondAndDestroy(
          result ?? {
            statusCode: 500,
            headers: {},
            body: JSON.stringify({ error: 'internal_error' }),
          },
        );
      }
    }

    async function finalizePlain(): Promise<void> {
      if (matched === null || matched.kind !== 'plain') {
        return;
      }
      const request: HttpServerRequest = {
        method,
        path: fullPath,
        headers: headersMap,
        body: plainBodyChunks.join('') || undefined,
      };
      const result = await matched.handler(request);
      respondAndDestroy(result);
    }

    async function processChunk(str: string): Promise<void> {
      if (!headersParsed) {
        headerBuffer += str;
        const idx = headerBuffer.indexOf('\r\n\r\n');
        if (idx === -1) {
          if (headerBuffer.length > MAX_HEADER_BYTES) {
            respondAndDestroy(transportErrorResponse(431, 'headers_too_large'));
          }
          return;
        }

        const headPart = headerBuffer.slice(0, idx);
        const rest = headerBuffer.slice(idx + 4);

        if (!parseHeadPart(headPart)) {
          respondAndDestroy(transportErrorResponse(400, 'bad_request'));
          return;
        }

        if ('transfer-encoding' in headersMap) {
          respondAndDestroy(transportErrorResponse(400, 'transfer_encoding_not_supported'));
          return;
        }

        contentLength = parseInt(headersMap['content-length'] ?? '0', 10) || 0;

        const found = findHandler(pathname);
        if (!found) {
          respondAndDestroy(transportErrorResponse(404, 'not_found'));
          return;
        }

        requestId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
        headersParsed = true;
        matched = found;

        if (matched.kind === 'upload') {
          if (rest.length > 0) {
            bodyReceived += rest.length;
            await deliverUploadChunk(rest, bodyReceived >= contentLength);
          } else if (contentLength === 0) {
            await deliverUploadChunk('', true);
          }
        } else {
          plainBodyChunks.push(rest);
          bodyReceived += rest.length;
          if (bodyReceived >= contentLength) {
            await finalizePlain();
          }
        }
        return;
      }

      // Headers já processados: este chunk é corpo puro.
      bodyReceived += str.length;
      if (matched?.kind === 'upload') {
        await deliverUploadChunk(str, bodyReceived >= contentLength);
      } else if (matched?.kind === 'plain') {
        plainBodyChunks.push(str);
        if (bodyReceived >= contentLength) {
          await finalizePlain();
        }
      }
    }

    socket.on('data', (chunk: Buffer | string) => {
      socket.pause();
      const str = Buffer.isBuffer(chunk)
        ? chunk.toString('binary')
        : Buffer.from(chunk, 'utf8').toString('binary');

      processChunk(str)
        .catch((error: unknown) => {
          console.error('[NativeHttpModule] Erro ao processar request:', error);
          const message = error instanceof Error ? error.message : 'internal_error';
          respondAndDestroy(transportErrorResponse(500, message));
        })
        .finally(() => {
          if (!socket.destroyed) {
            socket.resume();
          }
        });
    });

    socket.on('error', () => cleanup());
    socket.on('close', () => cleanup());
  }

  return {
    start(port: number): Promise<void> {
      return new Promise<void>((resolve, reject) => {
        const newServer = TcpSocket.createServer((socket) => handleConnection(socket));

        newServer.on('error', (err: Error) => {
          reject(new Error(`EADDRINUSE: ${err.message}`));
        });

        newServer.listen({ port, host: '0.0.0.0' }, undefined, () => {
          server = newServer;
          running = true;
          resolve();
        });
      });
    },

    stop(): Promise<void> {
      return new Promise<void>((resolve) => {
        for (const socket of openSockets) {
          socket.destroy();
        }
        openSockets.clear();

        const currentServer = server;
        if (!currentServer) {
          running = false;
          resolve();
          return;
        }

        currentServer.close(() => {
          server = null;
          running = false;
          resolve();
        });
      });
    },

    addListener(path: string, handler: HttpServerRequestHandler): void {
      listeners.set(path, handler);
    },

    removeListener(path: string): void {
      listeners.delete(path);
    },

    addUploadListener(path: string, handler: HttpUploadChunkHandler): void {
      uploadListeners.set(path, handler);
    },

    removeUploadListener(path: string): void {
      uploadListeners.delete(path);
    },

    isRunning(): boolean {
      return running;
    },
  };
}
