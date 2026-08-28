import { registerFileRoutes } from '../apiSetup';
import type { ApiRouter, ApiHandler } from '../../features/server/services/apiRouter';
import type { FileRepository } from '../../features/files/services/fileRepository';
import type { FileEntry } from '../../features/files/types';
import { fileEntryDtoSchema, apiErrorSchema } from '../../shared/types/api';

describe('apiSetup — registerFileRoutes', () => {
  let mockApiRouter: jest.Mocked<ApiRouter>;
  let mockFileRepository: jest.Mocked<FileRepository>;
  let mockFsModule: jest.Mocked<{ readAsStringAsync: (uri: string) => Promise<string> }>;

  beforeEach(() => {
    mockApiRouter = {
      register: jest.fn(),
      unregister: jest.fn(),
      addRoute: jest.fn(),
    };

    mockFileRepository = {
      save: jest.fn(),
      saveFromUri: jest.fn(),
      list: jest.fn(),
      remove: jest.fn(),
      toDto: jest.fn((entry: FileEntry) => ({
        id: entry.id,
        name: entry.name,
        sizeBytes: entry.sizeBytes,
        mimeType: entry.mimeType,
        createdAt: entry.createdAt,
      })),
    };

    mockFsModule = {
      readAsStringAsync: jest.fn(),
    };
  });

  describe('registro de rotas', () => {
    it('registra GET /api/files no roteador', () => {
      registerFileRoutes(mockApiRouter, mockFileRepository, mockFsModule);

      expect(mockApiRouter.addRoute).toHaveBeenCalledWith(
        'GET',
        '/api/files',
        expect.any(Function),
      );
    });

    it('registra GET /api/files/:id/download no roteador', () => {
      registerFileRoutes(mockApiRouter, mockFileRepository, mockFsModule);

      expect(mockApiRouter.addRoute).toHaveBeenCalledWith(
        'GET',
        '/api/files/:id/download',
        expect.any(Function),
      );
    });
  });

  describe('GET /api/files', () => {
    it('retorna lista vazia com sucesso', async () => {
      mockFileRepository.list.mockResolvedValue([]);

      const handlers: Record<string, ApiHandler> = {};
      mockApiRouter.addRoute.mockImplementation((method, pattern, handler) => {
        handlers[`${method} ${pattern}`] = handler;
      });

      registerFileRoutes(mockApiRouter, mockFileRepository, mockFsModule);

      const handler = handlers['GET /api/files'];
      const response = await handler({ method: 'GET', path: '/api/files', headers: {} }, {}, {});

      expect(response.statusCode).toBe(200);
      expect(response.headers?.['Content-Type']).toBe('application/json; charset=utf-8');

      const body = JSON.parse(typeof response.body === 'string' ? response.body : '');
      expect(body.files).toEqual([]);

      // Validar contra schema
      const parsed = fileEntryDtoSchema.array().safeParse(body.files);
      expect(parsed.success).toBe(true);
    });

    it('retorna arquivos com query origin=shared', async () => {
      const now = Date.now();
      const entries: FileEntry[] = [
        {
          id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
          name: 'arquivo.txt',
          sizeBytes: 100,
          mimeType: 'text/plain',
          localUri: 'file:///path',
          origin: 'shared',
          createdAt: now,
        },
      ];

      mockFileRepository.list.mockResolvedValue(entries);

      const handlers: Record<string, ApiHandler> = {};
      mockApiRouter.addRoute.mockImplementation((method, pattern, handler) => {
        handlers[`${method} ${pattern}`] = handler;
      });

      registerFileRoutes(mockApiRouter, mockFileRepository, mockFsModule);

      const handler = handlers['GET /api/files'];
      const response = await handler(
        { method: 'GET', path: '/api/files?origin=shared', headers: {} },
        {},
        { origin: 'shared' },
      );

      expect(response.statusCode).toBe(200);

      const body = JSON.parse(typeof response.body === 'string' ? response.body : '');
      expect(body.files).toHaveLength(1);
      expect(body.files[0].name).toBe('arquivo.txt');

      // Garantir que localUri não é exposto
      expect(body.files[0]).not.toHaveProperty('localUri');
    });

    it('retorna 400 para origin inválido', async () => {
      const handlers: Record<string, ApiHandler> = {};
      mockApiRouter.addRoute.mockImplementation((method, pattern, handler) => {
        handlers[`${method} ${pattern}`] = handler;
      });

      registerFileRoutes(mockApiRouter, mockFileRepository, mockFsModule);

      const handler = handlers['GET /api/files'];
      const response = await handler(
        { method: 'GET', path: '/api/files?origin=invalid', headers: {} },
        {},
        { origin: 'invalid' },
      );

      expect(response.statusCode).toBe(400);

      const body = JSON.parse(typeof response.body === 'string' ? response.body : '');
      expect(body.error.code).toBe('INVALID_QUERY');
    });
  });

  describe('GET /api/files/:id/download', () => {
    it('retorna arquivo com headers corretos', async () => {
      const entry: FileEntry = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        name: 'document.pdf',
        sizeBytes: 5000,
        mimeType: 'application/pdf',
        localUri: 'file:///path/document.pdf',
        origin: 'shared',
        createdAt: Date.now(),
      };

      mockFileRepository.list.mockResolvedValue([entry]);
      mockFsModule.readAsStringAsync.mockResolvedValue('PDF_CONTENT_HERE');

      const handlers: Record<string, ApiHandler> = {};
      mockApiRouter.addRoute.mockImplementation((method, pattern, handler) => {
        handlers[`${method} ${pattern}`] = handler;
      });

      registerFileRoutes(mockApiRouter, mockFileRepository, mockFsModule);

      const handler = handlers['GET /api/files/:id/download'];
      const response = await handler(
        { method: 'GET', path: '/api/files/test-id/download', headers: {} },
        { id: '550e8400-e29b-41d4-a716-446655440000' },
        {},
      );

      expect(response.statusCode).toBe(200);
      expect(response.headers?.['Content-Type']).toBe('application/pdf');
      expect(response.headers?.['Content-Length']).toBe('5000');
      expect(response.headers?.['Content-Disposition']).toContain('attachment');
      expect(response.headers?.['Content-Disposition']).toContain('filename*=UTF-8');
      expect(response.body).toBe('PDF_CONTENT_HERE');
    });

    it('retorna 404 para arquivo não encontrado', async () => {
      mockFileRepository.list.mockResolvedValue([]);

      const handlers: Record<string, ApiHandler> = {};
      mockApiRouter.addRoute.mockImplementation((method, pattern, handler) => {
        handlers[`${method} ${pattern}`] = handler;
      });

      registerFileRoutes(mockApiRouter, mockFileRepository, mockFsModule);

      const handler = handlers['GET /api/files/:id/download'];
      const response = await handler(
        { method: 'GET', path: '/api/files/nonexistent/download', headers: {} },
        { id: '99999999-9999-9999-9999-999999999999' },
        {},
      );

      expect(response.statusCode).toBe(404);

      const body = JSON.parse(typeof response.body === 'string' ? response.body : '');
      expect(body.error.code).toBe('FILE_NOT_FOUND');
    });

    it('codifica nomes de arquivo com acentos em RFC 5987', async () => {
      const entry: FileEntry = {
        id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        name: 'relatório-é.pdf',
        sizeBytes: 2000,
        mimeType: 'application/pdf',
        localUri: 'file:///path/relatório-é.pdf',
        origin: 'shared',
        createdAt: Date.now(),
      };

      mockFileRepository.list.mockResolvedValue([entry]);
      mockFsModule.readAsStringAsync.mockResolvedValue('PDF');

      const handlers: Record<string, ApiHandler> = {};
      mockApiRouter.addRoute.mockImplementation((method, pattern, handler) => {
        handlers[`${method} ${pattern}`] = handler;
      });

      registerFileRoutes(mockApiRouter, mockFileRepository, mockFsModule);

      const handler = handlers['GET /api/files/:id/download'];
      const response = await handler(
        {
          method: 'GET',
          path: '/api/files/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/download',
          headers: {},
        },
        { id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' },
        {},
      );

      expect(response.statusCode).toBe(200);
      const disposition = response.headers?.['Content-Disposition'] ?? '';
      // RFC 5987: filename*=UTF-8''<encoded>
      expect(disposition).toContain("filename*=UTF-8''");
      expect(disposition).toContain(encodeURIComponent('relatório-é.pdf'));
    });

    it('retorna 400 quando id não é fornecido', async () => {
      const handlers: Record<string, ApiHandler> = {};
      mockApiRouter.addRoute.mockImplementation((method, pattern, handler) => {
        handlers[`${method} ${pattern}`] = handler;
      });

      registerFileRoutes(mockApiRouter, mockFileRepository, mockFsModule);

      const handler = handlers['GET /api/files/:id/download'];
      const response = await handler(
        { method: 'GET', path: '/api/files//download', headers: {} },
        {},
        {},
      );

      expect(response.statusCode).toBe(400);

      const body = JSON.parse(typeof response.body === 'string' ? response.body : '');
      expect(body.error.code).toBe('INVALID_ID');
    });
  });

  describe('validação de respostas de erro', () => {
    it('todas as respostas de erro usam envelope apiErrorSchema', async () => {
      mockFileRepository.list.mockResolvedValue([]);

      const handlers: Record<string, ApiHandler> = {};
      mockApiRouter.addRoute.mockImplementation((method, pattern, handler) => {
        handlers[`${method} ${pattern}`] = handler;
      });

      registerFileRoutes(mockApiRouter, mockFileRepository, mockFsModule);

      // Testar 404 para arquivo não encontrado
      const handler404 = handlers['GET /api/files/:id/download'];
      const response404 = await handler404(
        { method: 'GET', path: '/api/files/nonexistent/download', headers: {} },
        { id: '99999999-9999-9999-9999-999999999999' },
        {},
      );

      const body404 = JSON.parse(typeof response404.body === 'string' ? response404.body : '');
      const parsed404 = apiErrorSchema.safeParse(body404);
      expect(parsed404.success).toBe(true);

      // Testar 400 para origin inválido
      const handler400 = handlers['GET /api/files'];
      const response400 = await handler400(
        { method: 'GET', path: '/api/files?origin=invalid', headers: {} },
        {},
        { origin: 'invalid' },
      );

      const body400 = JSON.parse(typeof response400.body === 'string' ? response400.body : '');
      const parsed400 = apiErrorSchema.safeParse(body400);
      expect(parsed400.success).toBe(true);
    });
  });
});
