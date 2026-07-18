/**
 * Mock estrutural do "módulo do servidor" (T-003 · Infra de testes).
 *
 * `features/server` ainda não tem código de produção — a máquina de estados (T-201) e o
 * `ServerService` (T-203) entram depois, na Fase 2. Este arquivo define um contrato
 * PROVISÓRIO de baixo nível: o "driver" HTTP injetável que o futuro `ServerService` vai
 * envolver, conforme a Constituição (Princípio III — "dependências de rede/filesystem/
 * relógio sempre injetadas") e a própria T-201 ("Sem I/O real — o serviço HTTP é injetado").
 *
 * Baseado em HU-01 (iniciar servidor) e HU-02 (parar servidor) de `transferir.md`:
 * - iniciar sobe um servidor HTTP em porta livre (padrão 8080, fallback incremental) e
 *   resolve em menos de 2 s, retornando o IP local (rede Wi-Fi OU interface do hotspot —
 *   ver `networkMode`);
 * - parar libera a porta imediatamente e encerra conexões ativas.
 *
 * Este mock existe para que as próximas tarefas (T-201, T-203, T-204...) já possam escrever
 * testes com uma dependência injetável e determinística, sem I/O real, antes mesmo do módulo
 * real existir. A interface definitiva de `ServerService`/`ServerInfo`/`ServerStatus`/
 * `ServerErrorCode` será definida em T-201 e T-203 — tratem `ServerModule` abaixo como ponto
 * de partida, não como contrato final; ajustem ou substituam livremente.
 */

export type ServerNetworkMode = 'wifi' | 'ownNetwork';

export interface ServerModuleStartOptions {
  /** Porta preferida para subir o servidor (padrão 8080, com fallback incremental). */
  preferredPort?: number;
  networkMode?: ServerNetworkMode;
}

export interface ServerModuleStartResult {
  port: number;
  ipAddress: string;
  networkMode: ServerNetworkMode;
}

/** Códigos de erro previstos pela spec para o fluxo de iniciar servidor (HU-01). */
export type ServerModuleErrorCode = 'NO_NETWORK' | 'PORT_UNAVAILABLE' | 'UNKNOWN';

export class ServerModuleError extends Error {
  readonly code: ServerModuleErrorCode;

  constructor(code: ServerModuleErrorCode, message?: string) {
    super(message ?? code);
    this.name = 'ServerModuleError';
    this.code = code;
  }
}

/** Contrato de baixo nível que o `ServerService` (T-203) deve injetar/implementar. */
export interface ServerModule {
  start: (options?: ServerModuleStartOptions) => Promise<ServerModuleStartResult>;
  stop: () => Promise<void>;
  isRunning: () => boolean;
}

/**
 * Cria um `ServerModule` mockado, determinístico e sem I/O real, pronto para injeção em
 * testes de `features/server`. Sobrescreva `start`/`stop`/`isRunning` via `overrides` para
 * simular cenários de erro (ex.: rejeitar `start` com `new ServerModuleError('NO_NETWORK')`).
 */
export function createMockServerModule(
  overrides: Partial<ServerModule> = {}
): jest.Mocked<ServerModule> {
  let running = false;

  const start = jest.fn(
    async (options: ServerModuleStartOptions = {}): Promise<ServerModuleStartResult> => {
      running = true;
      return {
        port: options.preferredPort ?? 8080,
        ipAddress: '192.168.1.42',
        networkMode: options.networkMode ?? 'wifi',
      };
    }
  );

  const stop = jest.fn(async (): Promise<void> => {
    running = false;
  });

  const isRunning = jest.fn((): boolean => running);

  return {
    start,
    stop,
    isRunning,
    ...overrides,
  } as jest.Mocked<ServerModule>;
}
