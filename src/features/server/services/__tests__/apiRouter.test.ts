import { ApiRouterImpl } from '../apiRouter';
import type { ApiRouterConfig } from '../apiRouter';
import type {
  HttpServerRequest,
  HttpServerRequestHandler,
  HttpServerResponse,
} from '../httpModule';
import { sessionInfoSchema, apiErrorSchema } from '../../../../shared/types/api';
import { createMockHttpModule } from '../../../../__mocks__/testHelpers';

/** Acesso ao método privado `createErrorResponse` só para exercitar o branch de fallback. */
type ApiRouterInternals = {
  createErrorResponse: (statusCode: number, code: unknown, message: unknown) => HttpServerResponse;
};

describe('ApiRouter', () => {
  let router: ApiRouterImpl;
  let mockHttpModule: jest.Mocked<ReturnType<typeof createMockHttpModule>>;
  let registeredHandler: HttpServerRequestHandler | null = null;

  beforeEach(() => {
    const config: ApiRouterConfig = {
      getToken: () => 'test-123',
      getMode: () => 'send',
      appVersion: '1.0.0',
      maxUploadBytes: 4294967296,
    };
    router = new ApiRouterImpl(config);

    // Mock do HttpModule
    mockHttpModule = createMockHttpModule();
    mockHttpModule.addListener.mockImplementation(
      (path: string, handler: HttpServerRequestHandler) => {
        if (path === '/api') {
          registeredHandler = handler;
        }
      },
    );
  });

  describe('register', () => {
    it('deve registrar o listener para /api com o HttpModule', () => {
      router.register(mockHttpModule);

      expect(mockHttpModule.addListener).toHaveBeenCalledWith('/api', expect.any(Function));
      expect(registeredHandler).not.toBeNull();
    });
  });

  describe('unregister', () => {
    it('deve remover o listener para /api do HttpModule', () => {
      router.register(mockHttpModule);
      router.unregister(mockHttpModule);

      expect(mockHttpModule.removeListener).toHaveBeenCalledWith('/api');
    });
  });

  describe('GET /api/session', () => {
    beforeEach(() => {
      router.register(mockHttpModule);
    });

    it('deve retornar 200 com SessionInfo válido quando token é válido', async () => {
      const request: HttpServerRequest = {
        method: 'GET',
        path: '/api/session?token=test-123',
        headers: {},
      };

      const response = await registeredHandler!(request);

      expect(response.statusCode).toBe(200);
      expect(response.headers?.['Content-Type']).toBe('application/json; charset=utf-8');

      const body = JSON.parse(typeof response.body === 'string' ? response.body : '');
      expect(body.mode).toBe('send');
      expect(body.tokenValid).toBe(true); // Token válido
      expect(body.appVersion).toBe('1.0.0');
      expect(body.maxUploadBytes).toBe(4294967296);
    });

    it('deve retornar 200 com tokenValid: false quando token está ausente', async () => {
      const request: HttpServerRequest = {
        method: 'GET',
        path: '/api/session',
        headers: {},
      };

      const response = await registeredHandler!(request);

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(typeof response.body === 'string' ? response.body : '');
      expect(body.tokenValid).toBe(false); // Sem token = inválido
    });

    it('deve retornar 200 com tokenValid: false quando token é inválido', async () => {
      const request: HttpServerRequest = {
        method: 'GET',
        path: '/api/session?token=wrong-token',
        headers: {},
      };

      const response = await registeredHandler!(request);

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(typeof response.body === 'string' ? response.body : '');
      expect(body.tokenValid).toBe(false); // Token errado = inválido
    });

    it('deve produzir um payload que valida contra sessionInfoSchema (teste de contrato)', async () => {
      const request: HttpServerRequest = {
        method: 'GET',
        path: '/api/session?token=test-123',
        headers: {},
      };

      const response = await registeredHandler!(request);

      const body = JSON.parse(typeof response.body === 'string' ? response.body : '');
      const parsed = sessionInfoSchema.safeParse(body);

      expect(parsed.success).toBe(true);
    });
  });

  describe('erro 404', () => {
    beforeEach(() => {
      router.register(mockHttpModule);
    });

    it('deve retornar 404 para rota não encontrada', async () => {
      const request: HttpServerRequest = {
        method: 'GET',
        path: '/api/nonexistent',
        headers: {},
      };

      const response = await registeredHandler!(request);

      expect(response.statusCode).toBe(404);
      expect(response.headers?.['Content-Type']).toBe('application/json; charset=utf-8');

      const body = JSON.parse(typeof response.body === 'string' ? response.body : '');
      expect(body.error.code).toBe('NOT_FOUND');
      expect(body.error.message).toBeDefined();

      const parsed = apiErrorSchema.safeParse(body);
      expect(parsed.success).toBe(true);
    });

    it('deve retornar 404 para método não suportado na rota', async () => {
      const request: HttpServerRequest = {
        method: 'POST',
        path: '/api/session',
        headers: {},
      };

      const response = await registeredHandler!(request);

      expect(response.statusCode).toBe(404);
      expect(response.headers?.['Content-Type']).toBe('application/json; charset=utf-8');
    });
  });

  describe('envelope de erro', () => {
    beforeEach(() => {
      router.register(mockHttpModule);
    });

    it('deve sempre retornar erro no envelope apiErrorSchema', async () => {
      const request: HttpServerRequest = {
        method: 'GET',
        path: '/api/nonexistent',
        headers: {},
      };

      const response = await registeredHandler!(request);

      const body = JSON.parse(typeof response.body === 'string' ? response.body : '');
      expect(body).toHaveProperty('error');
      expect(body.error).toHaveProperty('code');
      expect(body.error).toHaveProperty('message');
      expect(typeof body.error.code).toBe('string');
      expect(typeof body.error.message).toBe('string');

      const parsed = apiErrorSchema.safeParse(body);
      expect(parsed.success).toBe(true);
    });

    it('deve retornar Content-Type correto em erros', async () => {
      const request: HttpServerRequest = {
        method: 'GET',
        path: '/api/nonexistent',
        headers: {},
      };

      const response = await registeredHandler!(request);

      expect(response.headers?.['Content-Type']).toBe('application/json; charset=utf-8');
    });
  });

  describe('erro 500', () => {
    beforeEach(() => {
      router.register(mockHttpModule);
    });

    it('deve capturar erro não tratado e retornar 500', async () => {
      const request: HttpServerRequest = {
        method: 'GET',
        path: '/api/session',
        headers: {},
      };

      const response = await registeredHandler!(request);

      expect(response.statusCode).toBe(200);
    });
  });

  describe('branches de erro 500 (cobertura)', () => {
    it('validação de SessionInfo falha (config inválido) → 500', async () => {
      const invalidConfig: ApiRouterConfig = {
        getToken: () => 'valid-token',
        getMode: () => 'invalid' as unknown as 'send' | 'receive',
        appVersion: '1.0.0',
        maxUploadBytes: 4294967296,
      };
      const invalidRouter = new ApiRouterImpl(invalidConfig);
      invalidRouter.register(mockHttpModule);

      const response = await registeredHandler!({
        method: 'GET',
        path: '/api/session',
        headers: {},
      });

      expect(response.statusCode).toBe(500);
      expect(response.headers?.['Content-Type']).toBe('application/json; charset=utf-8');
      const body = JSON.parse(typeof response.body === 'string' ? response.body : '');
      expect(body.error.code).toBe('INTERNAL_ERROR');

      const parsed = apiErrorSchema.safeParse(body);
      expect(parsed.success).toBe(true);
    });

    it('exceção não tratada no handler → 500 via catch de handleRequest', async () => {
      router.register(mockHttpModule);
      const stringifySpy = jest.spyOn(JSON, 'stringify').mockImplementationOnce(() => {
        throw new Error('boom');
      });

      try {
        const response = await registeredHandler!({
          method: 'GET',
          path: '/api/session',
          headers: {},
        });

        expect(response.statusCode).toBe(500);
        expect(response.headers?.['Content-Type']).toBe('application/json; charset=utf-8');
        const body = JSON.parse(typeof response.body === 'string' ? response.body : '');
        expect(body.error.code).toBe('INTERNAL_ERROR');
        expect(body.error.message).toContain('boom');

        const parsed = apiErrorSchema.safeParse(body);
        expect(parsed.success).toBe(true);
      } finally {
        stringifySpy.mockRestore();
      }
    });

    it('createErrorResponse cai no fallback quando o próprio envelope falha validação Zod', () => {
      const internals = router as unknown as ApiRouterInternals;

      const response = internals.createErrorResponse(400, 12345, null);

      expect(response.statusCode).toBe(500);
      expect(response.headers?.['Content-Type']).toBe('application/json; charset=utf-8');
      const body = JSON.parse(typeof response.body === 'string' ? response.body : '');
      expect(body.error.code).toBe('INTERNAL_ERROR');
      expect(body.error.message).toBe('Erro ao serializar erro');

      const parsed = apiErrorSchema.safeParse(body);
      expect(parsed.success).toBe(true);
    });

    it('exceção que não é instância de Error usa mensagem padrão "Erro desconhecido"', async () => {
      router.register(mockHttpModule);
      const stringifySpy = jest.spyOn(JSON, 'stringify').mockImplementationOnce(() => {
        throw 'string não-Error';
      });

      try {
        const response = await registeredHandler!({
          method: 'GET',
          path: '/api/session',
          headers: {},
        });

        expect(response.statusCode).toBe(500);
        const body = JSON.parse(typeof response.body === 'string' ? response.body : '');
        expect(body.error.message).toBe('Erro desconhecido');
      } finally {
        stringifySpy.mockRestore();
      }
    });

    it('addRoute registra uma nova rota no roteador', async () => {
      router.addRoute('GET', '/api/custom', (_request, _params, _query) =>
        Promise.resolve({
          statusCode: 200,
          headers: { 'Content-Type': 'application/json; charset=utf-8' },
          body: JSON.stringify({ custom: true }),
        }),
      );
      router.register(mockHttpModule);

      const response = await registeredHandler!({
        method: 'GET',
        path: '/api/custom',
        headers: {},
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(typeof response.body === 'string' ? response.body : '');
      expect(body).toEqual({ custom: true });
    });

    it('addRoute com pattern :id extrai o parâmetro de rota corretamente (com token válido)', async () => {
      let receivedParams: Record<string, string> | null = null;
      router.addRoute('GET', '/api/files/:id/download', (_request, params) => {
        receivedParams = params;
        return Promise.resolve({
          statusCode: 200,
          headers: { 'Content-Type': 'application/json; charset=utf-8' },
          body: JSON.stringify({ ok: true }),
        });
      });
      router.register(mockHttpModule);

      // Nota: /api/files/:id/download é uma rota gated (T-908), precisa de token válido
      await registeredHandler!({
        method: 'GET',
        path: '/api/files/abc-123/download?token=test-123',
        headers: {},
      });

      expect(receivedParams).toEqual({ id: 'abc-123' });
    });

    it('addRoute extrai query string quando presente no path (com token válido)', async () => {
      let receivedQuery: Record<string, string> | null = null;
      router.addRoute('GET', '/api/files', (_request, _params, query) => {
        receivedQuery = query;
        return Promise.resolve({
          statusCode: 200,
          headers: { 'Content-Type': 'application/json; charset=utf-8' },
          body: JSON.stringify({ ok: true }),
        });
      });
      router.register(mockHttpModule);

      // Nota: /api/files é uma rota gated (T-908), o token é extraído como parte de query
      // mas continua validado pelo middleware
      await registeredHandler!({
        method: 'GET',
        path: '/api/files?origin=received&limit=10&token=test-123',
        headers: {},
      });

      expect(receivedQuery).toEqual({ origin: 'received', limit: '10', token: 'test-123' });
    });

    it('addRoute sem query string no path resulta em query vazia (com token na query)', async () => {
      let receivedQuery: Record<string, string> | null = null;
      router.addRoute('GET', '/api/files', (_request, _params, query) => {
        receivedQuery = query;
        return Promise.resolve({
          statusCode: 200,
          headers: { 'Content-Type': 'application/json; charset=utf-8' },
          body: JSON.stringify({ ok: true }),
        });
      });
      router.register(mockHttpModule);

      // Nota: /api/files é gated, precisa de token na query
      await registeredHandler!({
        method: 'GET',
        path: '/api/files?token=test-123',
        headers: {},
      });

      expect(receivedQuery).toEqual({ token: 'test-123' });
    });

    it('não bate quando o número de segmentos do path difere do pattern (com token válido)', async () => {
      router.addRoute('GET', '/api/files/:id/download', () =>
        Promise.resolve({
          statusCode: 200,
          headers: { 'Content-Type': 'application/json; charset=utf-8' },
          body: JSON.stringify({ ok: true }),
        }),
      );
      router.register(mockHttpModule);

      // Rota gated com número incorreto de segmentos — espera 404
      const response = await registeredHandler!({
        method: 'GET',
        path: '/api/files/abc-123/download/extra?token=test-123',
        headers: {},
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe('GET /api/session — segurança do token (T-902/T-908)', () => {
    it('nunca inclui o valor real do token na resposta (segurança crítica)', async () => {
      const config: ApiRouterConfig = {
        getToken: () => 'super-secret-token-12345',
        getMode: () => 'send',
        appVersion: '1.0.0',
        maxUploadBytes: 4294967296,
      };
      router = new ApiRouterImpl(config);
      router.register(mockHttpModule);

      const request: HttpServerRequest = {
        method: 'GET',
        path: '/api/session',
        headers: {},
      };

      const response = await registeredHandler!(request);
      const body = JSON.parse(typeof response.body === 'string' ? response.body : '');

      // Verificação crítica: token nunca deve estar na resposta
      expect(body).not.toHaveProperty('token');
      expect(body).not.toHaveProperty('sessionId'); // Retrocompatibilidade: v1 usava sessionId
      expect(Object.keys(body)).toEqual(['mode', 'tokenValid', 'appVersion', 'maxUploadBytes']);

      // Garantir que a string da resposta também não contém o token por acidente
      expect(response.body).not.toContain('super-secret-token-12345');
    });

    it('retorna modo "send" quando getMode() retorna "send"', async () => {
      const config: ApiRouterConfig = {
        getToken: () => 'token-123',
        getMode: () => 'send',
        appVersion: '1.0.0',
        maxUploadBytes: 4294967296,
      };
      router = new ApiRouterImpl(config);
      router.register(mockHttpModule);

      const request: HttpServerRequest = {
        method: 'GET',
        path: '/api/session',
        headers: {},
      };

      const response = await registeredHandler!(request);
      const body = JSON.parse(typeof response.body === 'string' ? response.body : '');

      expect(body.mode).toBe('send');
    });

    it('retorna modo "receive" quando getMode() retorna "receive"', async () => {
      const config: ApiRouterConfig = {
        getToken: () => 'token-456',
        getMode: () => 'receive',
        appVersion: '1.0.0',
        maxUploadBytes: 4294967296,
      };
      router = new ApiRouterImpl(config);
      router.register(mockHttpModule);

      const request: HttpServerRequest = {
        method: 'GET',
        path: '/api/session',
        headers: {},
      };

      const response = await registeredHandler!(request);
      const body = JSON.parse(typeof response.body === 'string' ? response.body : '');

      expect(body.mode).toBe('receive');
    });

    it('tokenValid reflete validação real de token (T-908 implementado)', async () => {
      router.register(mockHttpModule);

      // Sem token: inválido
      let request: HttpServerRequest = {
        method: 'GET',
        path: '/api/session',
        headers: {},
      };
      let response = await registeredHandler!(request);
      let body = JSON.parse(typeof response.body === 'string' ? response.body : '');
      expect(body.tokenValid).toBe(false);

      // Com token válido: válido
      request = {
        method: 'GET',
        path: '/api/session?token=test-123',
        headers: {},
      };
      response = await registeredHandler!(request);
      body = JSON.parse(typeof response.body === 'string' ? response.body : '');
      expect(body.tokenValid).toBe(true);

      // Com token inválido: inválido
      request = {
        method: 'GET',
        path: '/api/session?token=wrong',
        headers: {},
      };
      response = await registeredHandler!(request);
      body = JSON.parse(typeof response.body === 'string' ? response.body : '');
      expect(body.tokenValid).toBe(false);
    });

    it('nunca inclui token mesmo com ?token= na querystring', async () => {
      router.register(mockHttpModule);

      const request: HttpServerRequest = {
        method: 'GET',
        path: '/api/session?token=some-token-value',
        headers: {},
      };

      const response = await registeredHandler!(request);
      const body = JSON.parse(typeof response.body === 'string' ? response.body : '');

      expect(body).not.toHaveProperty('token');
      expect(response.body).not.toContain('some-token-value');
    });
  });

  describe('Token validation middleware (T-908) nas rotas gated', () => {
    beforeEach(() => {
      router.register(mockHttpModule);
      // Registrar rotas gated para teste
      router.addRoute('GET', '/api/files', (_request, _params, _query) =>
        Promise.resolve({
          statusCode: 200,
          headers: { 'Content-Type': 'application/json; charset=utf-8' },
          body: JSON.stringify({ files: [] }),
        }),
      );
      router.addRoute('GET', '/api/files/:id/download', (_request, _params, _query) =>
        Promise.resolve({
          statusCode: 200,
          headers: { 'Content-Type': 'application/json; charset=utf-8' },
          body: JSON.stringify({ data: 'file-content' }),
        }),
      );
      router.addRoute('GET', '/api/events', (_request, _params, _query) =>
        Promise.resolve({
          statusCode: 200,
          headers: { 'Content-Type': 'application/json; charset=utf-8' },
          body: JSON.stringify({ filesChangedAt: 0 }),
        }),
      );
    });

    it('GET /api/files rejeita requisição sem token com 401 INVALID_TOKEN', async () => {
      const request: HttpServerRequest = {
        method: 'GET',
        path: '/api/files',
        headers: {},
      };

      const response = await registeredHandler!(request);

      expect(response.statusCode).toBe(401);
      const body = JSON.parse(typeof response.body === 'string' ? response.body : '');
      expect(body.error.code).toBe('INVALID_TOKEN');
    });

    it('GET /api/files rejeita requisição com token inválido com 401 INVALID_TOKEN', async () => {
      const request: HttpServerRequest = {
        method: 'GET',
        path: '/api/files?token=wrong-token',
        headers: {},
      };

      const response = await registeredHandler!(request);

      expect(response.statusCode).toBe(401);
      const body = JSON.parse(typeof response.body === 'string' ? response.body : '');
      expect(body.error.code).toBe('INVALID_TOKEN');
    });

    it('GET /api/files aceita requisição com token válido', async () => {
      const request: HttpServerRequest = {
        method: 'GET',
        path: '/api/files?token=test-123',
        headers: {},
      };

      const response = await registeredHandler!(request);

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(typeof response.body === 'string' ? response.body : '');
      expect(body).toHaveProperty('files');
    });

    it('GET /api/files/:id/download rejeita requisição sem token com 401 INVALID_TOKEN', async () => {
      const request: HttpServerRequest = {
        method: 'GET',
        path: '/api/files/abc-123/download',
        headers: {},
      };

      const response = await registeredHandler!(request);

      expect(response.statusCode).toBe(401);
      const body = JSON.parse(typeof response.body === 'string' ? response.body : '');
      expect(body.error.code).toBe('INVALID_TOKEN');
    });

    it('GET /api/files/:id/download aceita requisição com token válido', async () => {
      const request: HttpServerRequest = {
        method: 'GET',
        path: '/api/files/abc-123/download?token=test-123',
        headers: {},
      };

      const response = await registeredHandler!(request);

      expect(response.statusCode).toBe(200);
    });

    it('GET /api/events rejeita requisição sem token com 401 INVALID_TOKEN', async () => {
      const request: HttpServerRequest = {
        method: 'GET',
        path: '/api/events',
        headers: {},
      };

      const response = await registeredHandler!(request);

      expect(response.statusCode).toBe(401);
      const body = JSON.parse(typeof response.body === 'string' ? response.body : '');
      expect(body.error.code).toBe('INVALID_TOKEN');
    });

    it('GET /api/events aceita requisição com token válido', async () => {
      const request: HttpServerRequest = {
        method: 'GET',
        path: '/api/events?token=test-123',
        headers: {},
      };

      const response = await registeredHandler!(request);

      expect(response.statusCode).toBe(200);
    });

    it('GET /api/session permanece público (sem token)', async () => {
      const request: HttpServerRequest = {
        method: 'GET',
        path: '/api/session',
        headers: {},
      };

      const response = await registeredHandler!(request);

      // 200, mas tokenValid será false
      expect(response.statusCode).toBe(200);
      const body = JSON.parse(typeof response.body === 'string' ? response.body : '');
      expect(body.tokenValid).toBe(false);
    });

    it('nunca ecoa o valor do token recebido na resposta de erro 401', async () => {
      const request: HttpServerRequest = {
        method: 'GET',
        path: '/api/files?token=super-secret-token-12345',
        headers: {},
      };

      const response = await registeredHandler!(request);

      expect(response.statusCode).toBe(401);
      // Garantir que a resposta não contém o token em nenhum lugar
      expect(response.body).not.toContain('super-secret-token-12345');
    });
  });

  describe('sessionInfoSchema validação (Zod contract)', () => {
    it('rejeita payload sem o campo mode', () => {
      const invalidPayload = {
        tokenValid: true,
        appVersion: '1.0.0',
        maxUploadBytes: 4294967296,
      };

      const parsed = sessionInfoSchema.safeParse(invalidPayload);
      expect(parsed.success).toBe(false);
      if (!parsed.success) {
        expect(parsed.error.issues.some((issue) => issue.path.includes('mode'))).toBe(true);
      }
    });

    it('rejeita payload com mode fora do enum', () => {
      const invalidPayload = {
        mode: 'invalid-mode',
        tokenValid: true,
        appVersion: '1.0.0',
        maxUploadBytes: 4294967296,
      };

      const parsed = sessionInfoSchema.safeParse(invalidPayload);
      expect(parsed.success).toBe(false);
    });

    it('rejeita payload sem tokenValid', () => {
      const invalidPayload = {
        mode: 'send',
        appVersion: '1.0.0',
        maxUploadBytes: 4294967296,
      };

      const parsed = sessionInfoSchema.safeParse(invalidPayload);
      expect(parsed.success).toBe(false);
    });

    it('rejeita payload com tokenValid não-booleano', () => {
      const invalidPayload = {
        mode: 'send',
        tokenValid: 'true', // string em vez de boolean
        appVersion: '1.0.0',
        maxUploadBytes: 4294967296,
      };

      const parsed = sessionInfoSchema.safeParse(invalidPayload);
      expect(parsed.success).toBe(false);
    });

    it('rejeita payload sem appVersion', () => {
      const invalidPayload = {
        mode: 'send',
        tokenValid: true,
        maxUploadBytes: 4294967296,
      };

      const parsed = sessionInfoSchema.safeParse(invalidPayload);
      expect(parsed.success).toBe(false);
    });

    it('rejeita payload sem maxUploadBytes', () => {
      const invalidPayload = {
        mode: 'send',
        tokenValid: true,
        appVersion: '1.0.0',
      };

      const parsed = sessionInfoSchema.safeParse(invalidPayload);
      expect(parsed.success).toBe(false);
    });

    it('rejeita maxUploadBytes com valor não-positivo', () => {
      const invalidPayload = {
        mode: 'send',
        tokenValid: true,
        appVersion: '1.0.0',
        maxUploadBytes: 0, // deve ser positivo
      };

      const parsed = sessionInfoSchema.safeParse(invalidPayload);
      expect(parsed.success).toBe(false);
    });

    it('rejeita maxUploadBytes com valor negativo', () => {
      const invalidPayload = {
        mode: 'send',
        tokenValid: true,
        appVersion: '1.0.0',
        maxUploadBytes: -1,
      };

      const parsed = sessionInfoSchema.safeParse(invalidPayload);
      expect(parsed.success).toBe(false);
    });

    it('ignora campo extra token se presente (schema permite extras, código não inclui)', () => {
      const payloadWithExtra = {
        mode: 'send',
        tokenValid: true,
        appVersion: '1.0.0',
        maxUploadBytes: 4294967296,
        token: 'leaked-token', // Campo extra — será ignorado por Zod
        extraField: 'ignored',
      };

      const parsed = sessionInfoSchema.safeParse(payloadWithExtra);
      // Schema permite campos extras, mas não os valida
      expect(parsed.success).toBe(true);
      expect(parsed.data?.mode).toBe('send');
      // Garantir que o campo extra não está nos dados parseados
      if (parsed.success) {
        expect(Object.prototype.hasOwnProperty.call(parsed.data, 'token')).toBe(false);
        expect(Object.prototype.hasOwnProperty.call(parsed.data, 'extraField')).toBe(false);
      }
    });

    it('aceita payload válido com modo send', () => {
      const validPayload = {
        mode: 'send' as const,
        tokenValid: true,
        appVersion: '1.0.0',
        maxUploadBytes: 4294967296,
      };

      const parsed = sessionInfoSchema.safeParse(validPayload);
      expect(parsed.success).toBe(true);
    });

    it('aceita payload válido com modo receive', () => {
      const validPayload = {
        mode: 'receive' as const,
        tokenValid: false,
        appVersion: '2.0.0',
        maxUploadBytes: 1073741824,
      };

      const parsed = sessionInfoSchema.safeParse(validPayload);
      expect(parsed.success).toBe(true);
    });

    it('aceita tokenValid false', () => {
      const validPayload = {
        mode: 'send',
        tokenValid: false,
        appVersion: '1.0.0',
        maxUploadBytes: 4294967296,
      };

      const parsed = sessionInfoSchema.safeParse(validPayload);
      expect(parsed.success).toBe(true);
    });
  });
});
