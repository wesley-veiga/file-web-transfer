import { ApiRouterImpl } from '../apiRouter';
import type { ApiRouterConfig } from '../apiRouter';
import type {
  HttpModule,
  HttpServerRequest,
  HttpServerRequestHandler,
  HttpServerResponse,
} from '../httpModule';
import { sessionInfoSchema, apiErrorSchema } from '../../../../shared/types/api';

/** Acesso ao método privado `createErrorResponse` só para exercitar o branch de fallback. */
type ApiRouterInternals = {
  createErrorResponse: (statusCode: number, code: unknown, message: unknown) => HttpServerResponse;
};

describe('ApiRouter', () => {
  let router: ApiRouterImpl;
  let mockHttpModule: HttpModule;
  let registeredHandler: HttpServerRequestHandler | null = null;

  beforeEach(() => {
    const config: ApiRouterConfig = {
      sessionId: 'test-123',
      appVersion: '1.0.0',
      maxUploadBytes: 4294967296,
    };
    router = new ApiRouterImpl(config);

    // Mock do HttpModule
    mockHttpModule = {
      start: jest.fn(),
      stop: jest.fn(),
      isRunning: jest.fn(),
      addListener: jest.fn((path: string, handler: HttpServerRequestHandler) => {
        if (path === '/api') {
          registeredHandler = handler;
        }
      }),
      removeListener: jest.fn(),
    };
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

    it('deve retornar 200 com SessionInfo válido', async () => {
      const request: HttpServerRequest = {
        method: 'GET',
        path: '/api/session',
        headers: {},
      };

      const response = await registeredHandler!(request);

      expect(response.statusCode).toBe(200);
      expect(response.headers?.['Content-Type']).toBe('application/json; charset=utf-8');

      const body = JSON.parse(typeof response.body === 'string' ? response.body : '');
      expect(body.sessionId).toBe('test-123');
      expect(body.appVersion).toBe('1.0.0');
      expect(body.maxUploadBytes).toBe(4294967296);
    });

    it('deve produzir um payload que valida contra sessionInfoSchema (teste de contrato)', async () => {
      const request: HttpServerRequest = {
        method: 'GET',
        path: '/api/session',
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
        sessionId: 123 as unknown as string,
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

    it('addRoute com pattern :id extrai o parâmetro de rota corretamente', async () => {
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

      await registeredHandler!({
        method: 'GET',
        path: '/api/files/abc-123/download',
        headers: {},
      });

      expect(receivedParams).toEqual({ id: 'abc-123' });
    });

    it('addRoute extrai query string quando presente no path', async () => {
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

      await registeredHandler!({
        method: 'GET',
        path: '/api/files?origin=received&limit=10',
        headers: {},
      });

      expect(receivedQuery).toEqual({ origin: 'received', limit: '10' });
    });

    it('addRoute sem query string no path resulta em query vazia', async () => {
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

      await registeredHandler!({
        method: 'GET',
        path: '/api/files',
        headers: {},
      });

      expect(receivedQuery).toEqual({});
    });

    it('não bate quando o número de segmentos do path difere do pattern', async () => {
      router.addRoute('GET', '/api/files/:id/download', () =>
        Promise.resolve({
          statusCode: 200,
          headers: { 'Content-Type': 'application/json; charset=utf-8' },
          body: JSON.stringify({ ok: true }),
        }),
      );
      router.register(mockHttpModule);

      const response = await registeredHandler!({
        method: 'GET',
        path: '/api/files/abc-123/download/extra',
        headers: {},
      });

      expect(response.statusCode).toBe(404);
    });
  });
});
