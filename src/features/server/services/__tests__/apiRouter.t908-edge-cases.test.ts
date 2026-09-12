/**
 * Testes de casos de borda para T-908 — Middleware de validação de token.
 *
 * Cobre cenários críticos de segurança e comportamento determinístico
 * que não são cobertos pelos testes principais de apiRouter.test.ts.
 */

import { ApiRouterImpl } from '../apiRouter';
import type { ApiRouterConfig } from '../apiRouter';
import type { HttpServerRequest, HttpServerRequestHandler } from '../httpModule';
import { createMockHttpModule } from '../../../../__mocks__/testHelpers';

describe('T-908 — Token validation edge cases', () => {
  let router: ApiRouterImpl;
  let mockHttpModule: jest.Mocked<ReturnType<typeof createMockHttpModule>>;
  let registeredHandler: HttpServerRequestHandler | null = null;

  beforeEach(() => {
    const config: ApiRouterConfig = {
      getToken: () => 'valid-token-123',
      getMode: () => 'send',
      appVersion: '1.0.0',
      maxUploadBytes: 4294967296,
    };
    router = new ApiRouterImpl(config);

    mockHttpModule = createMockHttpModule();
    mockHttpModule.addListener.mockImplementation(
      (path: string, handler: HttpServerRequestHandler) => {
        if (path === '/api') {
          registeredHandler = handler;
        }
      },
    );

    router.register(mockHttpModule);
    // Registrar rotas gated para testes
    router.addRoute('GET', '/api/files', () =>
      Promise.resolve({
        statusCode: 200,
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify({ files: [] }),
      }),
    );
  });

  describe('Token vazio ou apenas whitespace', () => {
    it('rejeita token vazio com 401 INVALID_TOKEN', async () => {
      const request: HttpServerRequest = {
        method: 'GET',
        path: '/api/files?token=',
        headers: {},
      };

      const response = await registeredHandler!(request);

      expect(response.statusCode).toBe(401);
      const body = JSON.parse(typeof response.body === 'string' ? response.body : '');
      expect(body.error.code).toBe('INVALID_TOKEN');
    });

    it('rejeita token com apenas espaço com 401 INVALID_TOKEN', async () => {
      const request: HttpServerRequest = {
        method: 'GET',
        path: '/api/files?token=%20', // space encoded as %20
        headers: {},
      };

      const response = await registeredHandler!(request);

      expect(response.statusCode).toBe(401);
      const body = JSON.parse(typeof response.body === 'string' ? response.body : '');
      expect(body.error.code).toBe('INVALID_TOKEN');
      // Token com espaço é diferente do token válido: ' ' !== 'valid-token-123'
    });
  });

  describe('Case-sensitivity', () => {
    it('rejeita token com case diferente (uppercase)', async () => {
      const request: HttpServerRequest = {
        method: 'GET',
        path: '/api/files?token=VALID-TOKEN-123', // uppercase
        headers: {},
      };

      const response = await registeredHandler!(request);

      expect(response.statusCode).toBe(401);
      const body = JSON.parse(typeof response.body === 'string' ? response.body : '');
      expect(body.error.code).toBe('INVALID_TOKEN');
    });

    it('rejeita token com case parcialmente diferente', async () => {
      const request: HttpServerRequest = {
        method: 'GET',
        path: '/api/files?token=Valid-Token-123',
        headers: {},
      };

      const response = await registeredHandler!(request);

      expect(response.statusCode).toBe(401);
      const body = JSON.parse(typeof response.body === 'string' ? response.body : '');
      expect(body.error.code).toBe('INVALID_TOKEN');
    });
  });

  describe('Token com espaços prefixados/sufixados', () => {
    it('rejeita token com espaço prefixado', async () => {
      const request: HttpServerRequest = {
        method: 'GET',
        path: '/api/files?token=%20valid-token-123', // space + token
        headers: {},
      };

      const response = await registeredHandler!(request);

      expect(response.statusCode).toBe(401);
      const body = JSON.parse(typeof response.body === 'string' ? response.body : '');
      expect(body.error.code).toBe('INVALID_TOKEN');
    });

    it('rejeita token com espaço sufixado', async () => {
      const request: HttpServerRequest = {
        method: 'GET',
        path: '/api/files?token=valid-token-123%20', // token + space
        headers: {},
      };

      const response = await registeredHandler!(request);

      expect(response.statusCode).toBe(401);
      const body = JSON.parse(typeof response.body === 'string' ? response.body : '');
      expect(body.error.code).toBe('INVALID_TOKEN');
    });
  });

  describe('Múltiplos valores de token (determinismo)', () => {
    it('usa último valor quando há múltiplos tokens na query (URLSearchParams behavior)', async () => {
      // URLSearchParams.forEach itera sobre os valores; URLSearchParams.get() retorna o último
      // O código usa forEach, então deve pegar o último value do forEach
      const request: HttpServerRequest = {
        method: 'GET',
        path: '/api/files?token=wrong-1&token=wrong-2&token=valid-token-123',
        headers: {},
      };

      const response = await registeredHandler!(request);

      // Deve aceitar o último valor (valid-token-123)
      expect(response.statusCode).toBe(200);
    });

    it('rejeita quando último valor é inválido mesmo com valor válido anterior', async () => {
      const request: HttpServerRequest = {
        method: 'GET',
        path: '/api/files?token=valid-token-123&token=wrong',
        headers: {},
      };

      const response = await registeredHandler!(request);

      // Deve rejeitar porque o último valor é 'wrong'
      expect(response.statusCode).toBe(401);
      const body = JSON.parse(typeof response.body === 'string' ? response.body : '');
      expect(body.error.code).toBe('INVALID_TOKEN');
    });
  });

  describe('Token nunca é ecoado em nenhuma circunstância', () => {
    it('não ecoa token vazio em resposta de erro', async () => {
      const request: HttpServerRequest = {
        method: 'GET',
        path: '/api/files?token=',
        headers: {},
      };

      const response = await registeredHandler!(request);

      expect(response.statusCode).toBe(401);
      expect(response.body).not.toContain('token');
    });

    it('não ecoa token inválido em resposta de erro', async () => {
      const secretToken = 'super-secret-password-xyz';
      const request: HttpServerRequest = {
        method: 'GET',
        path: `/api/files?token=${secretToken}`,
        headers: {},
      };

      const response = await registeredHandler!(request);

      expect(response.statusCode).toBe(401);
      // Garantir que a resposta não contém o token em nenhum lugar
      expect(response.body).not.toContain(secretToken);
      expect(response.body).not.toContain('super-secret');
    });
  });

  describe('GET /api/session nunca ecoa token mesmo na query', () => {
    it('não inclui token na resposta mesmo quando enviado na query', async () => {
      const request: HttpServerRequest = {
        method: 'GET',
        path: '/api/session?token=valid-token-123',
        headers: {},
      };

      const response = await registeredHandler!(request);

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(typeof response.body === 'string' ? response.body : '');

      // Verificar que nenhum campo contém o token
      expect(body).not.toHaveProperty('token');
      expect(body).not.toHaveProperty('sessionId');
      expect(response.body).not.toContain('valid-token-123');
    });

    it('não inclui token mesmo quando token inválido é enviado', async () => {
      const request: HttpServerRequest = {
        method: 'GET',
        path: '/api/session?token=invalid-token',
        headers: {},
      };

      const response = await registeredHandler!(request);

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(typeof response.body === 'string' ? response.body : '');

      expect(body).not.toHaveProperty('token');
      expect(response.body).not.toContain('invalid-token');
    });
  });

  describe('Encoding de URL e query string parsing', () => {
    it('valida token com caracteres encoded corretamente', async () => {
      // Se o token contiver caracteres que precisam ser encoded, URLSearchParams decodifica
      // Ex.: "maçã-42" seria encoded como "ma%C3%A7%C3%A3-42"
      // URLSearchParams.get() retorna o valor decodificado
      const config: ApiRouterConfig = {
        getToken: () => 'maçã-42', // token com caractere especial
        getMode: () => 'send',
        appVersion: '1.0.0',
        maxUploadBytes: 4294967296,
      };
      const specialRouter = new ApiRouterImpl(config);

      let specialHandler: HttpServerRequestHandler | null = null;
      mockHttpModule.addListener.mockImplementation(
        (path: string, handler: HttpServerRequestHandler) => {
          if (path === '/api') {
            specialHandler = handler;
          }
        },
      );

      specialRouter.register(mockHttpModule);
      specialRouter.addRoute('GET', '/api/files', () =>
        Promise.resolve({
          statusCode: 200,
          headers: { 'Content-Type': 'application/json; charset=utf-8' },
          body: JSON.stringify({ files: [] }),
        }),
      );

      // Token encoded
      const encodedToken = encodeURIComponent('maçã-42');
      const request: HttpServerRequest = {
        method: 'GET',
        path: `/api/files?token=${encodedToken}`,
        headers: {},
      };

      const response = specialHandler!(request);

      // Deve aceitar o token encoded corretamente
      return response.then((r) => {
        expect(r.statusCode).toBe(200);
      });
    });
  });

  describe('Token validation é exato (não usa trim, toLowerCase, etc)', () => {
    it('rejeita token com newline', async () => {
      // Transmitido como %0A
      const request: HttpServerRequest = {
        method: 'GET',
        path: '/api/files?token=valid-token-123%0A', // newline no final
        headers: {},
      };

      const response = await registeredHandler!(request);

      expect(response.statusCode).toBe(401);
      const body = JSON.parse(typeof response.body === 'string' ? response.body : '');
      expect(body.error.code).toBe('INVALID_TOKEN');
    });

    it('aceita token válido sem modificações', async () => {
      const request: HttpServerRequest = {
        method: 'GET',
        path: '/api/files?token=valid-token-123',
        headers: {},
      };

      const response = await registeredHandler!(request);

      expect(response.statusCode).toBe(200);
    });
  });
});
