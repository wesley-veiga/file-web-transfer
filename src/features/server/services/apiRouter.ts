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
 * - Suportar parâmetros de rota (ex.: `/api/files/:id/download`)
 * - Extrair e passar query strings aos handlers
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

  /**
   * Registra uma nova rota no roteador.
   * Suporta parâmetros de rota como `:id`.
   *
   * @param method - Método HTTP (GET, POST, etc.)
   * @param pattern - Path pattern (ex.: `/api/files/:id/download`)
   * @param handler - Handler que será chamado quando a rota bater
   */
  addRoute(method: string, pattern: string, handler: ApiHandler): void;
}

/**
 * Tipo de um handler de rota.
 * Recebe o request e os parâmetros extraídos da rota.
 */
export type ApiHandler = (
  request: HttpServerRequest,
  params: Record<string, string>,
  query: Record<string, string>,
) => Promise<HttpServerResponse>;

/**
 * Estrutura interna para armazenar rotas com patterns.
 */
interface RouteEntry {
  pattern: string;
  handler: ApiHandler;
}

/**
 * Implementação do roteador de API.
 *
 * Este é um roteador mínimo que:
 * - Implementa GET /api/session
 * - Captura erros não tratados (500)
 * - Trata 404 para rotas não encontradas
 * - Sempre retorna respostas JSON com Content-Type correto
 * - Suporta parâmetros de rota (ex.: `/api/files/:id`)
 * - Extrai query strings e passa aos handlers
 *
 * É extensível: futuras rotas (T-402, T-403, T-404) podem registrar handlers adicionais
 * sem necessidade de modificar esta classe, desde que sigam o padrão do roteador.
 */
export class ApiRouterImpl implements ApiRouter {
  private readonly config: ApiRouterConfig;
  private readonly routes: Map<string, RouteEntry[]> = new Map();

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

  addRoute(method: string, pattern: string, handler: ApiHandler): void {
    if (!this.routes.has(method)) {
      this.routes.set(method, []);
    }
    this.routes.get(method)!.push({ pattern, handler });
  }

  /**
   * Configura os handlers das rotas conhecidas.
   * Pode ser estendido para adicionar mais rotas.
   */
  private setupRoutes(): void {
    // GET /api/session - usa handler adaptado para nova assinatura
    this.addRoute('GET', '/api/session', () => this.handleGetSession());
  }

  /**
   * Parse query string from URL.
   * Ex.: "origin=shared&limit=10" → { origin: 'shared', limit: '10' }
   */
  private parseQueryString(queryStr: string): Record<string, string> {
    const query: Record<string, string> = {};
    if (!queryStr) {
      return query;
    }
    const params = new URLSearchParams(queryStr);
    params.forEach((value, key) => {
      query[key] = value;
    });
    return query;
  }

  /**
   * Extrai pathname e query string de um path.
   * Ex.: "/api/files?origin=shared" → { pathname: "/api/files", queryStr: "origin=shared" }
   */
  private splitPathAndQuery(path: string): { pathname: string; queryStr: string } {
    const idx = path.indexOf('?');
    if (idx === -1) {
      return { pathname: path, queryStr: '' };
    }
    return {
      pathname: path.substring(0, idx),
      queryStr: path.substring(idx + 1),
    };
  }

  /**
   * Tenta fazer matching de um pathname contra um pattern de rota.
   * Ex.: pattern="/api/files/:id" contra path="/api/files/abc-123" → { id: 'abc-123' }
   * Retorna null se não bater.
   */
  private matchPattern(pattern: string, pathname: string): Record<string, string> | null {
    const patternParts = pattern.split('/');
    const pathParts = pathname.split('/');

    // Deve ter o mesmo número de partes
    if (patternParts.length !== pathParts.length) {
      return null;
    }

    const params: Record<string, string> = {};

    for (let i = 0; i < patternParts.length; i++) {
      const patternPart = patternParts[i];
      const pathPart = pathParts[i];

      // Se a parte do pattern começa com ":", é um parâmetro
      if (patternPart.startsWith(':')) {
        const paramName = patternPart.substring(1);
        params[paramName] = pathPart;
      } else {
        // Caso contrário, deve fazer matching exato
        if (patternPart !== pathPart) {
          return null;
        }
      }
    }

    return params;
  }

  /**
   * Interceptor central que processa todos os requests.
   * Roteador → handler específico → envelope de resposta.
   */
  private async handleRequest(request: HttpServerRequest): Promise<HttpServerResponse> {
    try {
      // Separar pathname de query string
      const { pathname, queryStr } = this.splitPathAndQuery(request.path);
      const query = this.parseQueryString(queryStr);

      // Buscar rotas para este método
      const routeEntries = this.routes.get(request.method);
      if (!routeEntries) {
        return this.createErrorResponse(404, 'NOT_FOUND', 'Rota não encontrada');
      }

      // Tentar fazer matching contra os patterns registrados
      for (const entry of routeEntries) {
        const params = this.matchPattern(entry.pattern, pathname);
        if (params !== null) {
          // Encontrou matching; executar handler
          return await entry.handler(request, params, query);
        }
      }

      // Nenhum pattern bateu
      return this.createErrorResponse(404, 'NOT_FOUND', 'Rota não encontrada');
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
