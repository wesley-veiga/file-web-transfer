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
  /**
   * IP remoto do cliente (peer) que originou a requisição, usado por T-602 para
   * popular `Transfer.peerIp`. Vem de `socket.remoteAddress` na implementação real
   * (`nativeHttpModule.ts`).
   *
   * Opcional (em vez de obrigatório) de propósito: dezenas de testes de T-401/T-402/
   * T-403 já existentes constroem `HttpServerRequest` literalmente sem esse campo, e
   * reescrever essas suítes está fora do escopo de T-602. Quem consome este campo
   * (T-602, `apiSetup.ts`) trata a ausência com o fallback `'desconhecido'` em vez de
   * quebrar a rota.
   */
  remoteAddress?: string;
}

export interface HttpServerResponse {
  statusCode: number;
  headers?: Record<string, string>;
  body?: string | ArrayBuffer;
}

export type HttpServerRequestHandler = (request: HttpServerRequest) => Promise<HttpServerResponse>;

/**
 * Um pedaço do corpo de um upload em andamento (streaming).
 *
 * Usado para processar uploads em chunks sem bufferizar o corpo inteiro em memória.
 * O módulo nativo processa o request chunk-by-chunk; a camada JS recebe eventos via `HttpUploadChunkHandler`.
 */
export interface HttpUploadChunk {
  /**
   * Identificador único da requisição de upload, estável entre todos os
   * chunks de um mesmo upload (gerado pelo módulo nativo, uma conexão =
   * um requestId). Necessário para correlacionar chunks entre si — não é
   * seguro inferir isso a partir de IP/headers, já que múltiplos uploads
   * concorrentes podem vir do mesmo cliente.
   */
  requestId: string;
  /** Bytes do chunk (string — o módulo nativo real entrega como base64 ou binary-safe string). */
  data: string;
  /** true apenas no último chunk do corpo. */
  isLast: boolean;
}

/**
 * Handler invocado uma vez por chunk recebido durante um upload em streaming.
 *
 * Deve retornar a HttpServerResponse final quando `chunk.isLast === true`;
 * nos chunks intermediários, o retorno é ignorado (pode ser void/undefined).
 *
 * Esta é a interface crítica que permite processar uploads de arquivo grande
 * sem bufferizar o corpo inteiro em memória.
 */
export type HttpUploadChunkHandler = (
  chunk: HttpUploadChunk,
  request: Omit<HttpServerRequest, 'body'>,
) => Promise<HttpServerResponse | void>;

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
   * Registra um listener para uploads em streaming.
   * Invocado uma vez por chunk recebido; o handler recebe eventos incremental.
   *
   * Usado para rotas POST que processam uploads multipart sem bufferizar
   * o corpo inteiro em memória.
   *
   * @param path - Caminho para registrar (ex.: '/api/upload')
   * @param handler - Handler que recebe chunks incremental
   */
  addUploadListener: (path: string, handler: HttpUploadChunkHandler) => void;

  /**
   * Remove um listener de upload registrado.
   */
  removeUploadListener: (path: string) => void;

  /**
   * Verifica se o servidor está rodando.
   */
  isRunning: () => boolean;
}
