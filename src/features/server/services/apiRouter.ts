import type { HttpServerRequest, HttpServerResponse, HttpModule } from './httpModule';
import type { SessionInfo, ApiError } from '../../../shared/types/api';
import { sessionInfoSchema, apiErrorSchema } from '../../../shared/types/api';

/**
 * Configuração do roteador de API.
 */
export interface ApiRouterConfig {
  /** Identificador da sessão (gerado pelo ServerService) */
  sessionId: string;
  /** Versão do app para exibir na API */
  appVersion: string;
  /** Tamanho máximo de upload em bytes */
  maxUploadBytes: number;
}

/**
 * Interface do roteador de API.
 *
 * Responsabilidades:
 * - Registrar rotas (método + path) com handlers
 * - Capturar erros não tratados e convertê-los para respostas 5xx no envelope apiErrorSchema
 * - Tratar 404 (rota não encontrada) no envelope apiErrorSchema
 * - Toda resposta JSON com Content-Type correto
 * - Implementar GET /api/session
 */
export interface ApiRouter {
  /**
   * Registra o roteador com o HttpModule.
   * Isso registra listeners para os paths que o roteador atende.
   */
  register(httpModule: HttpModule): void;

  /**
   * Remove todos os listeners registrados do HttpModule.
   */
  unregister(httpModule: HttpModule): void;
}

/**
 * Implementação do roteador de API.
 *
 * Este é um roteador mínimo que:
 * - Implementa GET /api/session
 * - Captura erros não tratados (500)
 * - Trata 404 para rotas não encontradas
 * - Sempre retorna respostas JSON com Content-Type correto
 *
 * É extensível: futuras rotas (T-402, T-403, T-404) podem registrar handlers adicionais
 * sem necessidade de modificar esta classe, desde que sigam o padrão do roteador.
 */
export class ApiRouterImpl implements ApiRouter {
  private readonly config: ApiRouterConfig;
  private readonly handlers: Map<string, Map<string, ApiHandler>> = new Map();

  constructor(config: ApiRouterConfig) {
    this.config = config;
    this.setupRoutes();
  }

  register(httpModule: HttpModule): void {
    // Registra um listener catchall que intercepta todas as rotas /api/*
    httpModule.addListener('/api', (request) => this.handleRequest(request));
  }

  unregister(httpModule: HttpModule): void {
    httpModule.removeListener('/api');
  }

  /**
   * Configura os handlers das rotas conhecidas.
   * Pode ser estendido para adicionar mais rotas.
   */
  private setupRoutes(): void {
    // GET /api/session
    this.registerRoute('GET', '/api/session', () => this.handleGetSession());
  }

  /**
   * Registra um handler para um método e path específicos.
   * Usado internamente para adicionar rotas.
   */
  private registerRoute(method: string, path: string, handler: ApiHandler): void {
    if (!this.handlers.has(path)) {
      this.handlers.set(path, new Map());
    }
    this.handlers.get(path)!.set(method, handler);
  }

  /**
   * Interceptor central que processa todos os requests.
   * Roteador → handler específico → envelope de resposta.
   */
  private async handleRequest(request: HttpServerRequest): Promise<HttpServerResponse> {
    try {
      const methodHandlers = this.handlers.get(request.path);
      const handler = methodHandlers?.get(request.method);

      if (!handler) {
        // Rota/método não encontrado
        return this.createErrorResponse(404, 'NOT_FOUND', 'Rota não encontrada');
      }

      // Executa o handler específico
      return await handler();
    } catch (error) {
      // Captura qualquer erro não tratado no handler
      const message = error instanceof Error ? error.message : 'Erro desconhecido';
      console.error('[ApiRouter] Erro não tratado:', error);
      return this.createErrorResponse(500, 'INTERNAL_ERROR', message);
    }
  }

  /**
   * Handler para GET /api/session.
   * Retorna informações da sessão.
   */
  private async handleGetSession(): Promise<HttpServerResponse> {
    const sessionInfo: SessionInfo = {
      sessionId: this.config.sessionId,
      appVersion: this.config.appVersion,
      maxUploadBytes: this.config.maxUploadBytes,
    };

    // Valida o payload contra o schema Zod
    const parsed = sessionInfoSchema.safeParse(sessionInfo);
    if (!parsed.success) {
      // Se a validação falhar, é bug do código, não do cliente
      console.error('[ApiRouter] SessionInfo falhou validação:', parsed.error);
      return this.createErrorResponse(500, 'INTERNAL_ERROR', 'Erro ao serializar sessão');
    }

    return this.createSuccessResponse(200, sessionInfo);
  }

  /**
   * Cria uma resposta de sucesso (JSON).
   */
  private createSuccessResponse(statusCode: number, data: unknown): HttpServerResponse {
    return {
      statusCode,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
      },
      body: JSON.stringify(data),
    };
  }

  /**
   * Cria uma resposta de erro no envelope apiErrorSchema.
   */
  private createErrorResponse(
    statusCode: number,
    code: string,
    message: string,
  ): HttpServerResponse {
    const error: ApiError = {
      error: {
        code,
        message,
      },
    };

    // Valida o envelope contra o schema Zod
    const parsed = apiErrorSchema.safeParse(error);
    if (!parsed.success) {
      // Se a validação falhar, é bug do código
      console.error('[ApiRouter] ApiError falhou validação:', parsed.error);
      // Fallback: retorna um envelope simples sem validação
      return {
        statusCode: 500,
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
        },
        body: JSON.stringify({
          error: { code: 'INTERNAL_ERROR', message: 'Erro ao serializar erro' },
        }),
      };
    }

    return {
      statusCode,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
      },
      body: JSON.stringify(error),
    };
  }
}

/**
 * Tipo de um handler de rota.
 * Não recebe o request como parâmetro porque os parâmetros
 * são injetados via closure no momento do registro da rota.
 */
type ApiHandler = () => Promise<HttpServerResponse>;
