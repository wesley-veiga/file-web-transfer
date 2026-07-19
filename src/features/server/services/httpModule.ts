/**
 * Interface injetável para o módulo HTTP nativo (react-native-http-bridge-refurbished ou similar).
 *
 * Esta abstração permite que:
 * - O `ServerService` (T-203) dependa de uma interface, não de uma lib específica
 * - Testes mockarem o módulo nativo sem precisar de I/O real
 * - A lib de servidor possa ser trocada no futuro sem alterar a lógica de negócio
 *
 * Baseado no ADR 001 (Seção 4): uso de interface injetável para desacoplamento.
 */

export interface HttpServerRequest {
  method: string;
  path: string;
  headers: Record<string, string>;
  body?: unknown;
}

export interface HttpServerResponse {
  statusCode: number;
  headers?: Record<string, string>;
  body?: string | ArrayBuffer;
}

export type HttpServerRequestHandler = (request: HttpServerRequest) => Promise<HttpServerResponse>;

/**
 * Contrato de baixo nível para o módulo HTTP nativo injetável.
 *
 * O `ServerService` inicia o servidor chamando `start()`, registra handlers via `addListener`,
 * e para via `stop()`.
 */
export interface HttpModule {
  /**
   * Inicia o servidor HTTP na porta especificada.
   *
   * @throws Em caso de falha (porta ocupada, permissão negada, etc.), deve lançar erro
   *         com informação que permita o `ServerService` inferir o `ServerErrorCode`.
   */
  start: (port: number) => Promise<void>;

  /**
   * Para o servidor HTTP, liberando a porta.
   */
  stop: () => Promise<void>;

  /**
   * Registra um listener para requests em um caminho específico.
   * A lib entrega o request ao handler, que deve retornar uma resposta.
   */
  addListener: (path: string, handler: HttpServerRequestHandler) => void;

  /**
   * Remove um listener registrado.
   */
  removeListener: (path: string) => void;

  /**
   * Verifica se o servidor está rodando.
   */
  isRunning: () => boolean;
}
