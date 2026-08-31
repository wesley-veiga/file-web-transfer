/**
 * Fake mínimo de `react-native-tcp-socket` para testar `nativeHttpModule.ts` sem I/O real.
 *
 * A lib real não é mockada globalmente (só há stubs em `jest.setup.ts` para permitir a
 * importação sem crashar). Este arquivo fica fora de `__tests__/` (mesmo padrão de
 * `shared/lib/testing/resetExpoMocks.ts`) porque o `testMatch` padrão do Jest trata qualquer
 * arquivo dentro de uma pasta `__tests__/` como uma suíte de teste — colocar um helper aqui
 * faria o Jest reclamar de "suíte sem nenhum teste". Tem sua própria suíte dedicada em
 * `testing/__tests__/tcpSocketMock.test.ts` e é usado a partir de
 * `services/__tests__/nativeHttpModule.test.ts` via
 * `jest.mock('react-native-tcp-socket', () => require('../testing/tcpSocketMock').createTcpSocketModule())`
 * — o `require(...)` inline evita o erro de hoisting do Jest ("module factory não pode
 * referenciar variáveis fora do escopo"), já que não há nenhuma variável externa sendo
 * capturada pela factory.
 *
 * `MockServer`/`MockSocket` implementam apenas a fatia da API real usada por
 * `createDefaultHttpModule()`: `createServer(cb)`, `server.listen(opts, host?, cb?)`,
 * `server.close(cb?)`, `server.on('error', ...)`, e no socket: `on('data'|'error'|'close')`,
 * `write(data, encoding?, cb?)`, `pause()`, `resume()`, `destroy()`, `destroyed`.
 */

import { EventEmitter } from 'events';

export interface WrittenChunk {
  data: string | Buffer;
  encoding?: string;
}

/** Fake de `Socket` (react-native-tcp-socket) baseado em `EventEmitter` do Node. */
export class MockSocket extends EventEmitter {
  destroyed = false;
  written: WrittenChunk[] = [];
  pauseCalls = 0;
  resumeCalls = 0;
  /**
   * IP remoto do peer (T-602). Ausente por padrão (`undefined`), igual ao comportamento da
   * lib real quando o SO não consegue determinar o IP — `nativeHttpModule.ts` já tem
   * fallback para esse caso, então este mock não precisa simular nada além disso.
   */
  remoteAddress?: string;

  write(data: string | Buffer, encodingOrCb?: string | (() => void), cb?: () => void): boolean {
    const encoding = typeof encodingOrCb === 'string' ? encodingOrCb : undefined;
    const callback = typeof encodingOrCb === 'function' ? encodingOrCb : cb;
    this.written.push({ data, encoding });
    callback?.();
    return true;
  }

  pause(): void {
    this.pauseCalls += 1;
  }

  resume(): void {
    this.resumeCalls += 1;
  }

  destroy(): void {
    if (this.destroyed) {
      return;
    }
    this.destroyed = true;
    this.emit('close');
  }

  /** Reconstrói tudo que foi escrito no socket como um único Buffer (comparação binary-safe). */
  writtenBuffer(): Buffer {
    return Buffer.concat(
      this.written.map(({ data, encoding }) =>
        Buffer.isBuffer(data) ? data : Buffer.from(data, (encoding as BufferEncoding) ?? 'utf8'),
      ),
    );
  }

  writtenText(): string {
    return this.writtenBuffer().toString('binary');
  }
}

interface ListenOptions {
  port: number;
  host?: string;
}

/** Fake de `Server` (react-native-tcp-socket) baseado em `EventEmitter` do Node. */
export class MockServer extends EventEmitter {
  connectionListener: ((socket: MockSocket) => void) | null;
  listenOptions: ListenOptions | null = null;
  closed = false;
  private listenCallback: (() => void) | null = null;

  constructor(connectionListener: (socket: MockSocket) => void) {
    super();
    this.connectionListener = connectionListener;
  }

  /**
   * Assinatura e regra de resolução do callback fiéis à implementação REAL de
   * `Server.listen()` (node_modules/react-native-tcp-socket/src/Server.js,
   * método `listen`): quando `options` é um objeto (sempre o caso aqui — só
   * chamamos a variante `listen({port, host}, cb)`), a lib real só olha o 2º
   * argumento (`hostOrCallback`) como callback — o 3º é ignorado nesse overload.
   *
   * Antes desta correção (T-701), este mock era mais permissivo que a lib real
   * (caía para o 3º argumento se o 2º não fosse função), o que escondeu por
   * completo um bug real em `nativeHttpModule.ts`: o callback de sucesso do
   * `start()` era passado como 3º argumento e NUNCA era chamado em produção,
   * causando "loading infinito" ao iniciar o servidor — só descoberto em teste
   * manual em dispositivo real, porque nenhum teste unitário reproduzia a regra
   * real de resolução de argumentos da lib.
   */
  listen(options: ListenOptions, hostOrCallback?: string | (() => void)): void {
    this.listenOptions = options;
    this.listenCallback = typeof hostOrCallback === 'function' ? hostOrCallback : null;
  }

  /** Simula o sucesso do bind — equivalente ao callback nativo do `listen()` real. */
  triggerListening(): void {
    this.listenCallback?.();
  }

  close(callback?: () => void): void {
    this.closed = true;
    this.emit('close');
    callback?.();
  }
}

export const createdServers: MockServer[] = [];

export const createServerMock = jest.fn((connectionListener: (socket: MockSocket) => void) => {
  const server = new MockServer(connectionListener);
  createdServers.push(server);
  return server;
});

/** Reseta o estado compartilhado do fake entre testes (não é feito automaticamente pelo `clearMocks`). */
export function resetTcpSocketMock(): void {
  createdServers.length = 0;
  createServerMock.mockClear();
}

/** Objeto retornado pela factory de `jest.mock('react-native-tcp-socket', ...)`. */
export function createTcpSocketModule(): {
  __esModule: true;
  default: { createServer: typeof createServerMock };
} {
  return {
    __esModule: true,
    default: { createServer: createServerMock },
  };
}
