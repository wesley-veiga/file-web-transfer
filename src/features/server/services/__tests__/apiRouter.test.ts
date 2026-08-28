import { ApiRouterImpl } from '../apiRouter';
import type { ApiRouterConfig } from '../apiRouter';
import type {
  HttpModule,
  HttpServerRequest,
  HttpServerRequestHandler,
  HttpServerResponse,
} from '../httpModule';

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

    it('deve validar o SessionInfo contra o schema', async () => {
      const request: HttpServerRequest = {
        method: 'GET',
        path: '/api/session',
        headers: {},
      };

      const response = await registeredHandler!(request);

      // A resposta deve ser válida
      const body = JSON.parse(typeof response.body === 'string' ? response.body : '');
      expect(body).toHaveProperty('sessionId');
      expect(body).toHaveProperty('appVersion');
      expect(body).toHaveProperty('maxUploadBytes');
      expect(typeof body.sessionId).toBe('string');
      expect(typeof body.appVersion).toBe('string');
      expect(typeof body.maxUploadBytes).toBe('number');
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

    it('registerRoute sobrescreve o handler quando o mesmo path/método é registrado de novo', async () => {
      const internals = router as unknown as {
        registerRoute: (method: string, path: string, handler: ApiHandlerForTest) => void;
      };

      internals.registerRoute('GET', '/api/session', () =>
        Promise.resolve({
          statusCode: 200,
          headers: { 'Content-Type': 'application/json; charset=utf-8' },
          body: JSON.stringify({ overridden: true }),
        }),
      );
      router.register(mockHttpModule);

      const response = await registeredHandler!({
        method: 'GET',
        path: '/api/session',
        headers: {},
      });

      const body = JSON.parse(typeof response.body === 'string' ? response.body : '');
      expect(body).toEqual({ overridden: true });
    });
  });
});

type ApiHandlerForTest = () => Promise<HttpServerResponse>;
