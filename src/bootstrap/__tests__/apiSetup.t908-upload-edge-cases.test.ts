/**
 * Testes de casos de borda para T-908 — POST /api/upload token validation.
 *
 * Verifica que a validação de token em POST /api/upload (via registerUploadRoute)
 * funciona corretamente em cenários críticos de segurança.
 */

import type { HttpModule, HttpUploadChunk, HttpServerRequest, HttpServerResponse } from '../../features/server/services/httpModule';
import { registerUploadRoute } from '../apiSetup';
import type { FileRepository } from '../../features/files/services/fileRepository';
import type { FilesChangedAtTracker } from '../../shared/lib/filesChangedAtTracker';
import { createMockHttpModule } from '../../__mocks__/testHelpers';

describe('T-908 — POST /api/upload token validation edge cases', () => {
  let mockHttpModule: jest.Mocked<HttpModule>;
  let mockFileRepository: jest.Mocked<FileRepository>;
  let tracker: jest.Mocked<FilesChangedAtTracker>;

  beforeEach(() => {
    mockHttpModule = createMockHttpModule();
    mockFileRepository = {
      beginStreamedWrite: jest.fn(),
      moveReceivedFileToConfiguredFolder: jest.fn(),
      toDto: jest.fn(),
    } as unknown as jest.Mocked<FileRepository>;

    tracker = {
      get: jest.fn().mockReturnValue(Date.now()),
      touch: jest.fn(),
    } as unknown as jest.Mocked<FilesChangedAtTracker>;
  });

  describe('Token vazio em POST /api/upload', () => {
    it('rejeita upload com token vazio (token=)', async () => {
      let capturedHandler: (
        chunk: HttpUploadChunk,
        request: Omit<HttpServerRequest, 'body'>,
      ) => Promise<HttpServerResponse> = () => {
        throw new Error('Handler não foi registrado');
      };

      mockHttpModule.addUploadListener.mockImplementation((path, handler) => {
        capturedHandler = handler as typeof capturedHandler;
      });

      const getToken = () => 'valid-token-123';
      registerUploadRoute(mockHttpModule, mockFileRepository, 1000000, tracker, getToken);

      const chunk: HttpUploadChunk = {
        requestId: 'req-empty-token',
        data: Buffer.from(''),
        isLast: true,
      };

      const request = {
        method: 'POST',
        path: '/api/upload?token=', // Token vazio
        headers: { 'content-type': 'multipart/form-data; boundary=----WebKit' },
      };

      const response = await capturedHandler(chunk, request);

      expect(response.statusCode).toBe(401);
      const body = JSON.parse(typeof response.body === 'string' ? response.body : '');
      expect(body.error.code).toBe('INVALID_TOKEN');
    });
  });

  describe('Token com espaços em POST /api/upload', () => {
    it('rejeita upload com token prefixado por espaço', async () => {
      let capturedHandler: (
        chunk: HttpUploadChunk,
        request: Omit<HttpServerRequest, 'body'>,
      ) => Promise<HttpServerResponse> = () => {
        throw new Error('Handler não foi registrado');
      };

      mockHttpModule.addUploadListener.mockImplementation((path, handler) => {
        capturedHandler = handler as typeof capturedHandler;
      });

      const getToken = () => 'valid-token-123';
      registerUploadRoute(mockHttpModule, mockFileRepository, 1000000, tracker, getToken);

      const chunk: HttpUploadChunk = {
        requestId: 'req-space-token',
        data: Buffer.from(''),
        isLast: true,
      };

      const request = {
        method: 'POST',
        path: '/api/upload?token=%20valid-token-123', // espaço prefixado
        headers: { 'content-type': 'multipart/form-data; boundary=----WebKit' },
      };

      const response = await capturedHandler(chunk, request);

      expect(response.statusCode).toBe(401);
      const body = JSON.parse(typeof response.body === 'string' ? response.body : '');
      expect(body.error.code).toBe('INVALID_TOKEN');
    });
  });

  describe('Case-sensitivity em POST /api/upload', () => {
    it('rejeita upload com token em uppercase', async () => {
      let capturedHandler: (
        chunk: HttpUploadChunk,
        request: Omit<HttpServerRequest, 'body'>,
      ) => Promise<HttpServerResponse> = () => {
        throw new Error('Handler não foi registrado');
      };

      mockHttpModule.addUploadListener.mockImplementation((path, handler) => {
        capturedHandler = handler as typeof capturedHandler;
      });

      const getToken = () => 'valid-token-123';
      registerUploadRoute(mockHttpModule, mockFileRepository, 1000000, tracker, getToken);

      const chunk: HttpUploadChunk = {
        requestId: 'req-case-token',
        data: Buffer.from(''),
        isLast: true,
      };

      const request = {
        method: 'POST',
        path: '/api/upload?token=VALID-TOKEN-123', // Uppercase
        headers: { 'content-type': 'multipart/form-data; boundary=----WebKit' },
      };

      const response = await capturedHandler(chunk, request);

      expect(response.statusCode).toBe(401);
      const body = JSON.parse(typeof response.body === 'string' ? response.body : '');
      expect(body.error.code).toBe('INVALID_TOKEN');
    });
  });

  describe('Token nunca é ecoado em resposta de erro de POST /api/upload', () => {
    it('não ecoa token secreto em resposta de erro 401', async () => {
      let capturedHandler: (
        chunk: HttpUploadChunk,
        request: Omit<HttpServerRequest, 'body'>,
      ) => Promise<HttpServerResponse> = () => {
        throw new Error('Handler não foi registrado');
      };

      mockHttpModule.addUploadListener.mockImplementation((path, handler) => {
        capturedHandler = handler as typeof capturedHandler;
      });

      const getToken = () => 'super-secret-token-xyz';
      registerUploadRoute(mockHttpModule, mockFileRepository, 1000000, tracker, getToken);

      const chunk: HttpUploadChunk = {
        requestId: 'req-secret-token',
        data: Buffer.from(''),
        isLast: true,
      };

      const secretProvidedToken = 'wrong-secret-guess';
      const request = {
        method: 'POST',
        path: `/api/upload?token=${secretProvidedToken}`,
        headers: { 'content-type': 'multipart/form-data; boundary=----WebKit' },
      };

      const response = await capturedHandler(chunk, request);

      expect(response.statusCode).toBe(401);
      // Garantir que nenhum token (nem o ativo nem o fornecido) está na resposta
      expect(response.body).not.toContain('super-secret-token-xyz');
      expect(response.body).not.toContain('wrong-secret-guess');
      expect(response.body).not.toContain('super-secret');
    });
  });


  describe('Token validation no primeiro chunk (early rejection)', () => {
    it('rejeita token inválido no primeiro chunk sem processar multipart', async () => {
      let capturedHandler: (
        chunk: HttpUploadChunk,
        request: Omit<HttpServerRequest, 'body'>,
      ) => Promise<HttpServerResponse> = () => {
        throw new Error('Handler não foi registrado');
      };

      mockHttpModule.addUploadListener.mockImplementation((path, handler) => {
        capturedHandler = handler as typeof capturedHandler;
      });

      const getToken = () => 'valid-token-123';
      registerUploadRoute(mockHttpModule, mockFileRepository, 1000000, tracker, getToken);

      // Primeiro chunk com token inválido
      const chunk: HttpUploadChunk = {
        requestId: 'req-early-reject',
        data: Buffer.from('------WebKit\r\nContent-Disposition: form-data; name="file"...'),
        isLast: false, // Não é o último chunk
      };

      const request = {
        method: 'POST',
        path: '/api/upload?token=wrong-token',
        headers: { 'content-type': 'multipart/form-data; boundary=----WebKit' },
      };

      const response = await capturedHandler(chunk, request);

      // Deve rejeitar imediatamente sem processar o multipart
      expect(response.statusCode).toBe(401);
      const body = JSON.parse(typeof response.body === 'string' ? response.body : '');
      expect(body.error.code).toBe('INVALID_TOKEN');

      // O fileRepository não deve ter sido chamado
      expect(mockFileRepository.beginStreamedWrite).not.toHaveBeenCalled();
    });
  });
});
