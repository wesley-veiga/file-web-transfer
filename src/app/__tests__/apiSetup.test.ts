import { registerFileRoutes, registerUploadRoute } from '../apiSetup';
import type { ApiRouter, ApiHandler } from '../../features/server/services/apiRouter';
import type { HttpModule, HttpUploadChunk } from '../../features/server/services/httpModule';
import type { FileRepository } from '../../features/files/services/fileRepository';
import type { FileEntry } from '../../features/files/types';
import { fileEntryDtoSchema, apiErrorSchema } from '../../shared/types/api';
import { createMockFileRepository } from '../../__mocks__/testHelpers';

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

    mockFileRepository = createMockFileRepository();

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

  describe('casos de borda e segurança — GET /api/files', () => {
    it('rejeita origin=received válido também', async () => {
      const now = Date.now();
      const entries: FileEntry[] = [
        {
          id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
          name: 'recebido.txt',
          sizeBytes: 100,
          mimeType: 'text/plain',
          localUri: 'file:///path',
          origin: 'received',
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
        { method: 'GET', path: '/api/files?origin=received', headers: {} },
        {},
        { origin: 'received' },
      );

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(typeof response.body === 'string' ? response.body : '');
      expect(body.files).toHaveLength(1);
      expect(body.files[0].name).toBe('recebido.txt');
    });

    it('nunca expõe localUri na resposta de listagem', async () => {
      const now = Date.now();
      const entries: FileEntry[] = [
        {
          id: '550e8400-e29b-41d4-a716-446655440001',
          name: 'file1.txt',
          sizeBytes: 100,
          mimeType: 'text/plain',
          localUri: '/secret/path/file:///real-path',
          origin: 'shared',
          createdAt: now,
        },
        {
          id: '550e8400-e29b-41d4-a716-446655440002',
          name: 'file2.txt',
          sizeBytes: 200,
          mimeType: 'text/plain',
          localUri: '/secret/path/file:///another-path',
          origin: 'shared',
          createdAt: now + 1000,
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
      const bodyStr = typeof response.body === 'string' ? response.body : '';
      expect(bodyStr).not.toContain('localUri');
      expect(bodyStr).not.toContain('/secret/path');
      expect(bodyStr).not.toContain('real-path');
    });

    it('lista arquivos em ordem correta (createdAt desc) com múltiplos itens', async () => {
      const baseTime = 1000000;
      const entries: FileEntry[] = [
        {
          id: '550e8400-e29b-41d4-a716-446655440010',
          name: 'oldest.txt',
          sizeBytes: 100,
          mimeType: 'text/plain',
          localUri: 'file:///1',
          origin: 'shared',
          createdAt: baseTime,
        },
        {
          id: '550e8400-e29b-41d4-a716-446655440012',
          name: 'newest.txt',
          sizeBytes: 100,
          mimeType: 'text/plain',
          localUri: 'file:///3',
          origin: 'shared',
          createdAt: baseTime + 2000,
        },
        {
          id: '550e8400-e29b-41d4-a716-446655440011',
          name: 'middle.txt',
          sizeBytes: 100,
          mimeType: 'text/plain',
          localUri: 'file:///2',
          origin: 'shared',
          createdAt: baseTime + 1000,
        },
      ];

      mockFileRepository.list.mockResolvedValue(entries);

      const handlers: Record<string, ApiHandler> = {};
      mockApiRouter.addRoute.mockImplementation((method, pattern, handler) => {
        handlers[`${method} ${pattern}`] = handler;
      });

      registerFileRoutes(mockApiRouter, mockFileRepository, mockFsModule);

      const handler = handlers['GET /api/files'];
      const response = await handler({ method: 'GET', path: '/api/files', headers: {} }, {}, {});

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(typeof response.body === 'string' ? response.body : '');
      expect(body.files).toHaveLength(3);
      // Verificar ordenação: mais recentes primeiro
      expect(body.files[0].id).toBe('550e8400-e29b-41d4-a716-446655440012');
      expect(body.files[1].id).toBe('550e8400-e29b-41d4-a716-446655440011');
      expect(body.files[2].id).toBe('550e8400-e29b-41d4-a716-446655440010');
    });
  });

  describe('casos de borde e segurança — GET /api/files/:id/download', () => {
    it('rejeita id com path traversal (../../etc/passwd)', async () => {
      mockFileRepository.list.mockResolvedValue([]);

      const handlers: Record<string, ApiHandler> = {};
      mockApiRouter.addRoute.mockImplementation((method, pattern, handler) => {
        handlers[`${method} ${pattern}`] = handler;
      });

      registerFileRoutes(mockApiRouter, mockFileRepository, mockFsModule);

      const handler = handlers['GET /api/files/:id/download'];
      const response = await handler(
        { method: 'GET', path: '/api/files/../../etc/passwd/download', headers: {} },
        { id: '../../etc/passwd' },
        {},
      );

      expect(response.statusCode).toBe(404);
      expect(mockFsModule.readAsStringAsync).not.toHaveBeenCalled();

      const body = JSON.parse(typeof response.body === 'string' ? response.body : '');
      expect(body.error.code).toBe('FILE_NOT_FOUND');
    });

    it('rejeita id com caracteres de controle', async () => {
      mockFileRepository.list.mockResolvedValue([]);

      const handlers: Record<string, ApiHandler> = {};
      mockApiRouter.addRoute.mockImplementation((method, pattern, handler) => {
        handlers[`${method} ${pattern}`] = handler;
      });

      registerFileRoutes(mockApiRouter, mockFileRepository, mockFsModule);

      const handler = handlers['GET /api/files/:id/download'];
      const maliciousId = 'file\x00id\nwith\rcontrol';
      const response = await handler(
        { method: 'GET', path: '/api/files/malicious/download', headers: {} },
        { id: maliciousId },
        {},
      );

      expect(response.statusCode).toBe(404);
      expect(mockFsModule.readAsStringAsync).not.toHaveBeenCalled();

      const body = JSON.parse(typeof response.body === 'string' ? response.body : '');
      expect(body.error.code).toBe('FILE_NOT_FOUND');
    });

    it('nunca expõe localUri na resposta de download (no header ou body)', async () => {
      const entry: FileEntry = {
        id: '550e8400-e29b-41d4-a716-446655440021',
        name: 'document.pdf',
        sizeBytes: 5000,
        mimeType: 'application/pdf',
        localUri: 'file:///secret/path/document.pdf',
        origin: 'shared',
        createdAt: Date.now(),
      };

      mockFileRepository.list.mockResolvedValue([entry]);
      mockFsModule.readAsStringAsync.mockResolvedValue('PDF_CONTENT');

      const handlers: Record<string, ApiHandler> = {};
      mockApiRouter.addRoute.mockImplementation((method, pattern, handler) => {
        handlers[`${method} ${pattern}`] = handler;
      });

      registerFileRoutes(mockApiRouter, mockFileRepository, mockFsModule);

      const handler = handlers['GET /api/files/:id/download'];
      const response = await handler(
        { method: 'GET', path: '/api/files/test-id/download', headers: {} },
        { id: '550e8400-e29b-41d4-a716-446655440021' },
        {},
      );

      expect(response.statusCode).toBe(200);
      // Verificar headers
      const headerStr = JSON.stringify(response.headers);
      expect(headerStr).not.toContain('localUri');
      expect(headerStr).not.toContain('/secret/path');
      // Verificar body (conteúdo do arquivo, não expõe localUri)
      expect(response.body).toBe('PDF_CONTENT');
      expect(response.body).not.toContain('localUri');
    });

    it('retorna 500 quando falha ao ler arquivo do filesystem', async () => {
      const entry: FileEntry = {
        id: '550e8400-e29b-41d4-a716-446655440021',
        name: 'broken.pdf',
        sizeBytes: 5000,
        mimeType: 'application/pdf',
        localUri: 'file:///path/broken.pdf',
        origin: 'shared',
        createdAt: Date.now(),
      };

      mockFileRepository.list.mockResolvedValue([entry]);
      mockFsModule.readAsStringAsync.mockRejectedValue(new Error('Permissão negada'));

      const handlers: Record<string, ApiHandler> = {};
      mockApiRouter.addRoute.mockImplementation((method, pattern, handler) => {
        handlers[`${method} ${pattern}`] = handler;
      });

      registerFileRoutes(mockApiRouter, mockFileRepository, mockFsModule);

      const handler = handlers['GET /api/files/:id/download'];
      const response = await handler(
        { method: 'GET', path: '/api/files/test-id/download', headers: {} },
        { id: '550e8400-e29b-41d4-a716-446655440021' },
        {},
      );

      expect(response.statusCode).toBe(500);
      const body = JSON.parse(typeof response.body === 'string' ? response.body : '');
      expect(body.error.code).toBe('INTERNAL_ERROR');
      expect(body.error.message).toContain('Erro ao ler arquivo');
    });

    it('trata corretamente nome de arquivo com emoji e unicode', async () => {
      const entry: FileEntry = {
        id: 'emoji-id',
        name: '📄 relatório-final_é.pdf',
        sizeBytes: 2000,
        mimeType: 'application/pdf',
        localUri: 'file:///path/emoji-file.pdf',
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
        { method: 'GET', path: '/api/files/emoji-id/download', headers: {} },
        { id: 'emoji-id' },
        {},
      );

      expect(response.statusCode).toBe(200);
      const disposition = response.headers?.['Content-Disposition'] ?? '';
      // RFC 5987: filename*=UTF-8''<encoded>
      expect(disposition).toContain("filename*=UTF-8''");
      // Verificar que o nome foi encodado e contém as partes esperadas
      expect(disposition).toContain(encodeURIComponent('📄 relatório-final_é.pdf'));
      expect(response.headers?.['Content-Type']).toBe('application/pdf');
    });

    it('arquivo que existia mas foi removido retorna 404', async () => {
      // Simular que o arquivo não está mais na lista (foi removido)
      mockFileRepository.list.mockResolvedValue([]);

      const handlers: Record<string, ApiHandler> = {};
      mockApiRouter.addRoute.mockImplementation((method, pattern, handler) => {
        handlers[`${method} ${pattern}`] = handler;
      });

      registerFileRoutes(mockApiRouter, mockFileRepository, mockFsModule);

      const handler = handlers['GET /api/files/:id/download'];
      const response = await handler(
        {
          method: 'GET',
          path: '/api/files/550e8400-e29b-41d4-a716-446655440023/download',
          headers: {},
        },
        { id: '550e8400-e29b-41d4-a716-446655440023' },
        {},
      );

      expect(response.statusCode).toBe(404);
      expect(mockFsModule.readAsStringAsync).not.toHaveBeenCalled();

      const body = JSON.parse(typeof response.body === 'string' ? response.body : '');
      expect(body.error.code).toBe('FILE_NOT_FOUND');
      expect(body.error.message).toContain('não encontrado ou foi removido');
    });

    it('valida envelopes de erro contra apiErrorSchema (500)', async () => {
      const entry: FileEntry = {
        id: '550e8400-e29b-41d4-a716-446655440021',
        name: 'file.pdf',
        sizeBytes: 1000,
        mimeType: 'application/pdf',
        localUri: 'file:///path/file.pdf',
        origin: 'shared',
        createdAt: Date.now(),
      };

      mockFileRepository.list.mockResolvedValue([entry]);
      mockFsModule.readAsStringAsync.mockRejectedValue(new Error('Disk error'));

      const handlers: Record<string, ApiHandler> = {};
      mockApiRouter.addRoute.mockImplementation((method, pattern, handler) => {
        handlers[`${method} ${pattern}`] = handler;
      });

      registerFileRoutes(mockApiRouter, mockFileRepository, mockFsModule);

      const handler = handlers['GET /api/files/:id/download'];
      const response = await handler(
        { method: 'GET', path: '/api/files/test-id/download', headers: {} },
        { id: '550e8400-e29b-41d4-a716-446655440021' },
        {},
      );

      expect(response.statusCode).toBe(500);
      const body = JSON.parse(typeof response.body === 'string' ? response.body : '');
      const parsed = apiErrorSchema.safeParse(body);
      expect(parsed.success).toBe(true);
    });

    it('valida lista de arquivos contra fileEntryDtoSchema.array()', async () => {
      const now = Date.now();
      const entries: FileEntry[] = [
        {
          id: '550e8400-e29b-41d4-a716-446655440000',
          name: 'file1.txt',
          sizeBytes: 100,
          mimeType: 'text/plain',
          localUri: 'file:///1',
          origin: 'shared',
          createdAt: now,
        },
        {
          id: '550e8400-e29b-41d4-a716-446655440001',
          name: 'file2.txt',
          sizeBytes: 200,
          mimeType: 'text/plain',
          localUri: 'file:///2',
          origin: 'shared',
          createdAt: now + 1000,
        },
      ];

      mockFileRepository.list.mockResolvedValue(entries);

      const handlers: Record<string, ApiHandler> = {};
      mockApiRouter.addRoute.mockImplementation((method, pattern, handler) => {
        handlers[`${method} ${pattern}`] = handler;
      });

      registerFileRoutes(mockApiRouter, mockFileRepository, mockFsModule);

      const handler = handlers['GET /api/files'];
      const response = await handler({ method: 'GET', path: '/api/files', headers: {} }, {}, {});

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(typeof response.body === 'string' ? response.body : '');
      const parsed = fileEntryDtoSchema.array().safeParse(body.files);
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data).toHaveLength(2);
      }
    });
  });
});

describe('apiSetup — registerUploadRoute', () => {
  let mockHttpModule: jest.Mocked<HttpModule>;
  let mockFileRepository: jest.Mocked<FileRepository>;

  beforeEach(() => {
    mockHttpModule = {
      addUploadListener: jest.fn(),
    };

    mockFileRepository = createMockFileRepository();
  });

  describe('registro de rota', () => {
    it('registra POST /api/upload no módulo HTTP', () => {
      registerUploadRoute(mockHttpModule, mockFileRepository, 1000000);

      expect(mockHttpModule.addUploadListener).toHaveBeenCalledWith(
        '/api/upload',
        expect.any(Function),
      );
    });
  });

  describe('happy path — upload com sucesso (201)', () => {
    it('retorna 201 com FileEntryDto válido ao completar upload', async () => {
      const maxUploadBytes = 1000000;

      let capturedHandler:
        | ((
            chunk: HttpUploadChunk,
            request: Omit<HttpServerRequest, 'body'>,
          ) => Promise<HttpServerResponse | void>)
        | null = null;

      mockHttpModule.addUploadListener.mockImplementation((path, handler) => {
        capturedHandler = handler;
      });

      registerUploadRoute(mockHttpModule, mockFileRepository, maxUploadBytes);

      const mockWriteHandle = {
        id: '550e8400-e29b-41d4-a716-446655440020',
        finalName: 'test.txt',
        writeChunk: jest.fn().mockResolvedValue(undefined),
        finish: jest.fn().mockResolvedValue({
          id: '550e8400-e29b-41d4-a716-446655440020',
          name: 'test.txt',
          sizeBytes: 11,
          mimeType: 'text/plain',
          localUri: 'file:///received/test.txt',
          origin: 'received' as const,
          createdAt: Date.now(),
        }),
        abort: jest.fn().mockResolvedValue(undefined),
      };

      mockFileRepository.beginStreamedWrite.mockResolvedValue(mockWriteHandle);
      mockFileRepository.toDto.mockReturnValue({
        id: '550e8400-e29b-41d4-a716-446655440020',
        name: 'test.txt',
        sizeBytes: 11,
        mimeType: 'text/plain',
        createdAt: Date.now(),
      });

      // Simular upload completo em um chunk
      const boundary = '----WebKitFormBoundary';
      const uploadBody =
        `------WebKitFormBoundary\r\n` +
        `Content-Disposition: form-data; name="file"; filename="test.txt"\r\n` +
        `Content-Type: text/plain\r\n` +
        `\r\n` +
        `Hello World\r\n` +
        `------WebKitFormBoundary--\r\n`;

      const chunk: HttpUploadChunk = {
        requestId: 'req-1',
        data: uploadBody,
        isLast: true,
      };

      const request = {
        method: 'POST',
        path: '/api/upload',
        headers: { 'content-type': 'multipart/form-data; boundary=----WebKitFormBoundary' },
      };

      if (!capturedHandler) throw new Error('Handler não foi registrado');
      const response = await capturedHandler(chunk, request);

      expect(response).toBeDefined();
      expect(response.statusCode).toBe(201);

      const body = JSON.parse(typeof response.body === 'string' ? response.body : '');
      expect(body.file).toBeDefined();

      // Validar contra schema
      const parsed = fileEntryDtoSchema.safeParse(body.file);
      expect(parsed.success).toBe(true);
    });

    it('nunca expõe localUri na resposta de sucesso', async () => {
      const maxUploadBytes = 1000000;

      let capturedHandler:
        | ((
            chunk: HttpUploadChunk,
            request: Omit<HttpServerRequest, 'body'>,
          ) => Promise<HttpServerResponse | void>)
        | null = null;
      mockHttpModule.addUploadListener.mockImplementation((path, handler) => {
        capturedHandler = handler;
      });

      registerUploadRoute(mockHttpModule, mockFileRepository, maxUploadBytes);

      const mockWriteHandle = {
        id: '550e8400-e29b-41d4-a716-446655440021',
        finalName: 'file.txt',
        writeChunk: jest.fn().mockResolvedValue(undefined),
        finish: jest.fn().mockResolvedValue({
          id: '550e8400-e29b-41d4-a716-446655440021',
          name: 'file.txt',
          sizeBytes: 10,
          mimeType: 'text/plain',
          localUri: 'file:///secret/path/file.txt',
          origin: 'received' as const,
          createdAt: Date.now(),
        }),
        abort: jest.fn().mockResolvedValue(undefined),
      };

      mockFileRepository.beginStreamedWrite.mockResolvedValue(mockWriteHandle);
      mockFileRepository.toDto.mockReturnValue({
        id: '550e8400-e29b-41d4-a716-446655440021',
        name: 'file.txt',
        sizeBytes: 10,
        mimeType: 'text/plain',
        createdAt: Date.now(),
      });

      const uploadBody =
        `------boundary\r\n` +
        `Content-Disposition: form-data; name="file"; filename="file.txt"\r\n` +
        `\r\n` +
        `some content\r\n` +
        `------boundary--\r\n`;

      const chunk: HttpUploadChunk = {
        requestId: 'req-1',
        data: uploadBody,
        isLast: true,
      };

      const response = await capturedHandler(chunk, {
        method: 'POST',
        path: '/api/upload',
        headers: { 'content-type': 'multipart/form-data; boundary=----boundary' },
      });

      const body = typeof response.body === 'string' ? response.body : '';
      expect(body).not.toContain('localUri');
      expect(body).not.toContain('/secret/path');
    });

    it('sanitiza nome do arquivo e resolve duplicata automaticamente', async () => {
      const maxUploadBytes = 1000000;

      let capturedHandler:
        | ((
            chunk: HttpUploadChunk,
            request: Omit<HttpServerRequest, 'body'>,
          ) => Promise<HttpServerResponse | void>)
        | null = null;
      mockHttpModule.addUploadListener.mockImplementation((path, handler) => {
        capturedHandler = handler;
      });

      registerUploadRoute(mockHttpModule, mockFileRepository, maxUploadBytes);

      const mockWriteHandle = {
        id: '550e8400-e29b-41d4-a716-446655440022',
        finalName: 'document (1).txt',
        writeChunk: jest.fn().mockResolvedValue(undefined),
        finish: jest.fn().mockResolvedValue({
          id: '550e8400-e29b-41d4-a716-446655440022',
          name: 'document (1).txt',
          sizeBytes: 5,
          mimeType: 'text/plain',
          localUri: 'file:///received/document (1).txt',
          origin: 'received' as const,
          createdAt: Date.now(),
        }),
        abort: jest.fn().mockResolvedValue(undefined),
      };

      mockFileRepository.beginStreamedWrite.mockResolvedValue(mockWriteHandle);
      mockFileRepository.toDto.mockReturnValue({
        id: '550e8400-e29b-41d4-a716-446655440022',
        name: 'document (1).txt',
        sizeBytes: 5,
        mimeType: 'text/plain',
        createdAt: Date.now(),
      });

      const uploadBody =
        `------boundary\r\n` +
        `Content-Disposition: form-data; name="file"; filename="document.txt"\r\n` +
        `\r\n` +
        `hello\r\n` +
        `------boundary--\r\n`;

      const chunk: HttpUploadChunk = {
        requestId: 'req-1',
        data: uploadBody,
        isLast: true,
      };

      const response = await capturedHandler(chunk, {
        method: 'POST',
        path: '/api/upload',
        headers: { 'content-type': 'multipart/form-data; boundary=----boundary' },
      });

      // Verificar que beginStreamedWrite foi chamado com "document.txt"
      expect(mockFileRepository.beginStreamedWrite).toHaveBeenCalledWith(
        'document.txt',
        expect.any(String),
        'received',
      );

      // Verificar que a resposta retorna o nome final após resolução de duplicata
      const body = JSON.parse(typeof response.body === 'string' ? response.body : '');
      expect(body.file.name).toBe('document (1).txt');
    });
  });

  describe('erro 400 — INVALID_MULTIPART', () => {
    it('retorna 400 quando Content-Type sem boundary', async () => {
      const maxUploadBytes = 1000000;

      let capturedHandler:
        | ((
            chunk: HttpUploadChunk,
            request: Omit<HttpServerRequest, 'body'>,
          ) => Promise<HttpServerResponse | void>)
        | null = null;
      mockHttpModule.addUploadListener.mockImplementation((path, handler) => {
        capturedHandler = handler;
      });

      registerUploadRoute(mockHttpModule, mockFileRepository, maxUploadBytes);

      const chunk: HttpUploadChunk = {
        requestId: 'req-1',
        data: 'some data',
        isLast: true,
      };

      const response = await capturedHandler(chunk, {
        method: 'POST',
        path: '/api/upload',
        headers: { 'content-type': 'multipart/form-data' }, // Sem boundary
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(typeof response.body === 'string' ? response.body : '');
      expect(body.error.code).toBe('INVALID_MULTIPART');
    });

    it('retorna 400 quando campo "file" está ausente no multipart', async () => {
      const maxUploadBytes = 1000000;

      let capturedHandler:
        | ((
            chunk: HttpUploadChunk,
            request: Omit<HttpServerRequest, 'body'>,
          ) => Promise<HttpServerResponse | void>)
        | null = null;
      mockHttpModule.addUploadListener.mockImplementation((path, handler) => {
        capturedHandler = handler;
      });

      registerUploadRoute(mockHttpModule, mockFileRepository, maxUploadBytes);

      const uploadBody =
        `------boundary\r\n` +
        `Content-Disposition: form-data; name="other"; filename="file.txt"\r\n` +
        `\r\n` +
        `content\r\n` +
        `------boundary--\r\n`;

      const chunk: HttpUploadChunk = {
        requestId: 'req-1',
        data: uploadBody,
        isLast: true,
      };

      const response = await capturedHandler(chunk, {
        method: 'POST',
        path: '/api/upload',
        headers: { 'content-type': 'multipart/form-data; boundary=----boundary' },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(typeof response.body === 'string' ? response.body : '');
      expect(body.error.code).toBe('INVALID_MULTIPART');
    });

    it('retorna 400 quando corpo multipart é malformado', async () => {
      const maxUploadBytes = 1000000;

      let capturedHandler:
        | ((
            chunk: HttpUploadChunk,
            request: Omit<HttpServerRequest, 'body'>,
          ) => Promise<HttpServerResponse | void>)
        | null = null;
      mockHttpModule.addUploadListener.mockImplementation((path, handler) => {
        capturedHandler = handler;
      });

      registerUploadRoute(mockHttpModule, mockFileRepository, maxUploadBytes);

      // Multipart sem boundary final válido
      const uploadBody =
        `------boundary\r\n` +
        `Content-Disposition: form-data; name="file"; filename="test.txt"\r\n` +
        `\r\n` +
        `content\r\n` +
        `(no boundary here)`;

      const chunk: HttpUploadChunk = {
        requestId: 'req-1',
        data: uploadBody,
        isLast: true,
      };

      const response = await capturedHandler(chunk, {
        method: 'POST',
        path: '/api/upload',
        headers: { 'content-type': 'multipart/form-data; boundary=----boundary' },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(typeof response.body === 'string' ? response.body : '');
      expect(body.error.code).toBe('INVALID_MULTIPART');
    });
  });

  describe('erro 413 — FILE_TOO_LARGE', () => {
    it('retorna 413 quando arquivo excede maxUploadBytes', async () => {
      const maxUploadBytes = 20; // Limite muito pequeno para teste

      let capturedHandler:
        | ((
            chunk: HttpUploadChunk,
            request: Omit<HttpServerRequest, 'body'>,
          ) => Promise<HttpServerResponse | void>)
        | null = null;
      mockHttpModule.addUploadListener.mockImplementation((path, handler) => {
        capturedHandler = handler;
      });

      registerUploadRoute(mockHttpModule, mockFileRepository, maxUploadBytes);

      const mockWriteHandle = {
        id: '550e8400-e29b-41d4-a716-446655440021',
        finalName: 'large.txt',
        writeChunk: jest.fn().mockResolvedValue(undefined),
        abort: jest.fn().mockResolvedValue(undefined),
      };

      mockFileRepository.beginStreamedWrite.mockResolvedValue(mockWriteHandle);

      const uploadBody =
        `------boundary\r\n` +
        `Content-Disposition: form-data; name="file"; filename="large.txt"\r\n` +
        `\r\n` +
        `This is a very long content that exceeds the maximum size allowed\r\n` +
        `------boundary--\r\n`;

      const chunk: HttpUploadChunk = {
        requestId: 'req-1',
        data: uploadBody,
        isLast: true,
      };

      const response = await capturedHandler(chunk, {
        method: 'POST',
        path: '/api/upload',
        headers: { 'content-type': 'multipart/form-data; boundary=----boundary' },
      });

      expect(response.statusCode).toBe(413);
      const body = JSON.parse(typeof response.body === 'string' ? response.body : '');
      expect(body.error.code).toBe('FILE_TOO_LARGE');

      // Verificar que abort foi chamado
      expect(mockWriteHandle.abort).toHaveBeenCalled();
    });

    it('para de processar chunks após ultrapassar limite', async () => {
      const maxUploadBytes = 50;

      let capturedHandler:
        | ((
            chunk: HttpUploadChunk,
            request: Omit<HttpServerRequest, 'body'>,
          ) => Promise<HttpServerResponse | void>)
        | null = null;
      mockHttpModule.addUploadListener.mockImplementation((path, handler) => {
        capturedHandler = handler;
      });

      registerUploadRoute(mockHttpModule, mockFileRepository, maxUploadBytes);

      const mockWriteHandle = {
        id: '550e8400-e29b-41d4-a716-446655440021',
        finalName: 'file.txt',
        writeChunk: jest.fn().mockResolvedValue(undefined),
        abort: jest.fn().mockResolvedValue(undefined),
      };

      mockFileRepository.beginStreamedWrite.mockResolvedValue(mockWriteHandle);

      const boundary = '----boundary';

      // Primeiro chunk: headers + pequeno conteúdo
      const chunk1 =
        `------boundary\r\n` +
        `Content-Disposition: form-data; name="file"; filename="file.txt"\r\n` +
        `\r\n` +
        `Part1 data here\r\n`;

      const response1 = await capturedHandler(
        { requestId: 'req-1', data: chunk1, isLast: false },
        {
          method: 'POST',
          path: '/api/upload',
          headers: { 'content-type': 'multipart/form-data; boundary=----boundary' },
        },
      );

      expect(response1).toBeUndefined(); // Primeira parte OK

      // Segundo chunk: mais conteúdo que ultrapassa o limite
      const chunk2 = `Part2 data here and then much more data that will exceed the limit------boundary--\r\n`;

      const response2 = await capturedHandler(
        { requestId: 'req-1', data: chunk2, isLast: true },
        {
          method: 'POST',
          path: '/api/upload',
          headers: { 'content-type': 'multipart/form-data; boundary=----boundary' },
        },
      );

      expect(response2.statusCode).toBe(413);
      expect(mockWriteHandle.abort).toHaveBeenCalled();
    });
  });

  describe('erro 422 — INVALID_FILENAME', () => {
    it('retorna 422 quando nome sanitizado fica vazio', async () => {
      const maxUploadBytes = 1000000;

      let capturedHandler:
        | ((
            chunk: HttpUploadChunk,
            request: Omit<HttpServerRequest, 'body'>,
          ) => Promise<HttpServerResponse | void>)
        | null = null;
      mockHttpModule.addUploadListener.mockImplementation((path, handler) => {
        capturedHandler = handler;
      });

      registerUploadRoute(mockHttpModule, mockFileRepository, maxUploadBytes);

      mockFileRepository.beginStreamedWrite.mockRejectedValue(
        new Error('Nome sanitizado vazio (INVALID_FILENAME)'),
      );

      const uploadBody =
        `------boundary\r\n` +
        `Content-Disposition: form-data; name="file"; filename=".."\r\n` +
        `\r\n` +
        `content\r\n` +
        `------boundary--\r\n`;

      const chunk: HttpUploadChunk = {
        requestId: 'req-1',
        data: uploadBody,
        isLast: true,
      };

      const response = await capturedHandler(chunk, {
        method: 'POST',
        path: '/api/upload',
        headers: { 'content-type': 'multipart/form-data; boundary=----boundary' },
      });

      expect(response.statusCode).toBe(422);
      const body = JSON.parse(typeof response.body === 'string' ? response.body : '');
      expect(body.error.code).toBe('INVALID_FILENAME');
    });
  });

  describe('erro 507 — INSUFFICIENT_STORAGE', () => {
    it('retorna 507 quando writeChunk falha com erro de espaço', async () => {
      const maxUploadBytes = 1000000;

      let capturedHandler:
        | ((
            chunk: HttpUploadChunk,
            request: Omit<HttpServerRequest, 'body'>,
          ) => Promise<HttpServerResponse | void>)
        | null = null;
      mockHttpModule.addUploadListener.mockImplementation((path, handler) => {
        capturedHandler = handler;
      });

      registerUploadRoute(mockHttpModule, mockFileRepository, maxUploadBytes);

      const mockWriteHandle = {
        id: '550e8400-e29b-41d4-a716-446655440021',
        finalName: 'file.txt',
        writeChunk: jest.fn().mockRejectedValue(new Error('No space left on device (ENOSPC)')),
        abort: jest.fn().mockResolvedValue(undefined),
      };

      mockFileRepository.beginStreamedWrite.mockResolvedValue(mockWriteHandle);

      const uploadBody =
        `------boundary\r\n` +
        `Content-Disposition: form-data; name="file"; filename="file.txt"\r\n` +
        `\r\n` +
        `content here\r\n` +
        `------boundary--\r\n`;

      const chunk: HttpUploadChunk = {
        requestId: 'req-1',
        data: uploadBody,
        isLast: true,
      };

      const response = await capturedHandler(chunk, {
        method: 'POST',
        path: '/api/upload',
        headers: { 'content-type': 'multipart/form-data; boundary=----boundary' },
      });

      expect(response.statusCode).toBe(507);
      const body = JSON.parse(typeof response.body === 'string' ? response.body : '');
      expect(body.error.code).toBe('INSUFFICIENT_STORAGE');

      // Verificar que abort foi chamado
      expect(mockWriteHandle.abort).toHaveBeenCalled();
    });

    it('detecta erro de storage por "storage" na mensagem', async () => {
      const maxUploadBytes = 1000000;

      let capturedHandler:
        | ((
            chunk: HttpUploadChunk,
            request: Omit<HttpServerRequest, 'body'>,
          ) => Promise<HttpServerResponse | void>)
        | null = null;
      mockHttpModule.addUploadListener.mockImplementation((path, handler) => {
        capturedHandler = handler;
      });

      registerUploadRoute(mockHttpModule, mockFileRepository, maxUploadBytes);

      const mockWriteHandle = {
        id: '550e8400-e29b-41d4-a716-446655440021',
        finalName: 'file.txt',
        writeChunk: jest.fn().mockRejectedValue(new Error('Storage quota exceeded')),
        abort: jest.fn().mockResolvedValue(undefined),
      };

      mockFileRepository.beginStreamedWrite.mockResolvedValue(mockWriteHandle);

      const uploadBody =
        `------boundary\r\n` +
        `Content-Disposition: form-data; name="file"; filename="file.txt"\r\n` +
        `\r\n` +
        `data\r\n` +
        `------boundary--\r\n`;

      const chunk: HttpUploadChunk = {
        requestId: 'req-1',
        data: uploadBody,
        isLast: true,
      };

      const response = await capturedHandler(chunk, {
        method: 'POST',
        path: '/api/upload',
        headers: { 'content-type': 'multipart/form-data; boundary=----boundary' },
      });

      expect(response.statusCode).toBe(507);
      const body = JSON.parse(typeof response.body === 'string' ? response.body : '');
      expect(body.error.code).toBe('INSUFFICIENT_STORAGE');
    });
  });

  describe('concorrência — múltiplos uploads simultâneos', () => {
    it('mantém uploads concorrentes separados via requestId', async () => {
      const maxUploadBytes = 1000000;

      let capturedHandler:
        | ((
            chunk: HttpUploadChunk,
            request: Omit<HttpServerRequest, 'body'>,
          ) => Promise<HttpServerResponse | void>)
        | null = null;
      mockHttpModule.addUploadListener.mockImplementation((path, handler) => {
        capturedHandler = handler;
      });

      registerUploadRoute(mockHttpModule, mockFileRepository, maxUploadBytes);

      const uuid1 = '550e8400-e29b-41d4-a716-446655440001';
      const uuid2 = '550e8400-e29b-41d4-a716-446655440002';

      const mockWriteHandle1 = {
        id: uuid1,
        finalName: 'file1.txt',
        writeChunk: jest.fn().mockResolvedValue(undefined),
        finish: jest.fn().mockResolvedValue({
          id: uuid1,
          name: 'file1.txt',
          sizeBytes: 6,
          mimeType: 'text/plain',
          localUri: 'file:///received/file1.txt',
          origin: 'received' as const,
          createdAt: Date.now(),
        }),
        abort: jest.fn().mockResolvedValue(undefined),
      };

      const mockWriteHandle2 = {
        id: uuid2,
        finalName: 'file2.txt',
        writeChunk: jest.fn().mockResolvedValue(undefined),
        finish: jest.fn().mockResolvedValue({
          id: uuid2,
          name: 'file2.txt',
          sizeBytes: 6,
          mimeType: 'text/plain',
          localUri: 'file:///received/file2.txt',
          origin: 'received' as const,
          createdAt: Date.now(),
        }),
        abort: jest.fn().mockResolvedValue(undefined),
      };

      let callCount = 0;
      mockFileRepository.beginStreamedWrite.mockImplementation(async () => {
        callCount++;
        return callCount === 1 ? mockWriteHandle1 : mockWriteHandle2;
      });

      mockFileRepository.toDto.mockImplementation((entry) => ({
        id: entry.id,
        name: entry.name,
        sizeBytes: entry.sizeBytes,
        mimeType: entry.mimeType,
        createdAt: entry.createdAt,
      }));

      const boundary = '----boundary';

      // Iniciar upload 1
      const chunk1a: HttpUploadChunk = {
        requestId: 'req-1',
        data:
          `------boundary\r\n` +
          `Content-Disposition: form-data; name="file"; filename="file1.txt"\r\n` +
          `\r\n` +
          `Hello`,
        isLast: false,
      };

      await capturedHandler(chunk1a, {
        method: 'POST',
        path: '/api/upload',
        headers: { 'content-type': 'multipart/form-data; boundary=----boundary' },
      });

      // Iniciar upload 2 enquanto 1 ainda está em andamento
      const chunk2a: HttpUploadChunk = {
        requestId: 'req-2',
        data:
          `------boundary\r\n` +
          `Content-Disposition: form-data; name="file"; filename="file2.txt"\r\n` +
          `\r\n` +
          `World`,
        isLast: false,
      };

      await capturedHandler(chunk2a, {
        method: 'POST',
        path: '/api/upload',
        headers: { 'content-type': 'multipart/form-data; boundary=----boundary' },
      });

      // Finalizar upload 1
      const chunk1b: HttpUploadChunk = {
        requestId: 'req-1',
        data: `\r\n------boundary--\r\n`,
        isLast: true,
      };

      const response1 = await capturedHandler(chunk1b, {
        method: 'POST',
        path: '/api/upload',
        headers: { 'content-type': 'multipart/form-data; boundary=----boundary' },
      });

      // Finalizar upload 2
      const chunk2b: HttpUploadChunk = {
        requestId: 'req-2',
        data: `\r\n------boundary--\r\n`,
        isLast: true,
      };

      const response2 = await capturedHandler(chunk2b, {
        method: 'POST',
        path: '/api/upload',
        headers: { 'content-type': 'multipart/form-data; boundary=----boundary' },
      });

      // Ambos devem ter sucesso
      expect(response1.statusCode).toBe(201);
      expect(response2.statusCode).toBe(201);

      // Verificar que cada upload foi processado com seu handle correto
      expect(mockWriteHandle1.writeChunk).toHaveBeenCalled();
      expect(mockWriteHandle2.writeChunk).toHaveBeenCalled();
      expect(mockWriteHandle1.finish).toHaveBeenCalled();
      expect(mockWriteHandle2.finish).toHaveBeenCalled();
    });

    it('erro em um upload não afeta o outro', async () => {
      const maxUploadBytes = 1000000;

      let capturedHandler:
        | ((
            chunk: HttpUploadChunk,
            request: Omit<HttpServerRequest, 'body'>,
          ) => Promise<HttpServerResponse | void>)
        | null = null;
      mockHttpModule.addUploadListener.mockImplementation((path, handler) => {
        capturedHandler = handler;
      });

      registerUploadRoute(mockHttpModule, mockFileRepository, maxUploadBytes);

      const uuid1 = '550e8400-e29b-41d4-a716-446655440001';
      const uuid2 = '550e8400-e29b-41d4-a716-446655440002';

      const mockWriteHandle1 = {
        id: uuid1,
        finalName: 'file1.txt',
        writeChunk: jest.fn().mockRejectedValue(new Error('No space left on device')),
        abort: jest.fn().mockResolvedValue(undefined),
      };

      const mockWriteHandle2 = {
        id: uuid2,
        finalName: 'file2.txt',
        writeChunk: jest.fn().mockResolvedValue(undefined),
        finish: jest.fn().mockResolvedValue({
          id: uuid2,
          name: 'file2.txt',
          sizeBytes: 8,
          mimeType: 'text/plain',
          localUri: 'file:///received/file2.txt',
          origin: 'received' as const,
          createdAt: Date.now(),
        }),
        abort: jest.fn().mockResolvedValue(undefined),
      };

      let callCount = 0;
      mockFileRepository.beginStreamedWrite.mockImplementation(async () => {
        callCount++;
        return callCount === 1 ? mockWriteHandle1 : mockWriteHandle2;
      });

      mockFileRepository.toDto.mockImplementation((entry) => ({
        id: entry.id,
        name: entry.name,
        sizeBytes: entry.sizeBytes,
        mimeType: entry.mimeType,
        createdAt: entry.createdAt,
      }));

      const boundary = '----boundary';

      // Upload 1 com erro
      const chunk1: HttpUploadChunk = {
        requestId: 'req-1',
        data:
          `------boundary\r\n` +
          `Content-Disposition: form-data; name="file"; filename="file1.txt"\r\n` +
          `\r\n` +
          `Content1\r\n` +
          `------boundary--\r\n`,
        isLast: true,
      };

      const response1 = await capturedHandler(chunk1, {
        method: 'POST',
        path: '/api/upload',
        headers: { 'content-type': 'multipart/form-data; boundary=----boundary' },
      });

      // Upload 2 com sucesso
      const chunk2: HttpUploadChunk = {
        requestId: 'req-2',
        data:
          `------boundary\r\n` +
          `Content-Disposition: form-data; name="file"; filename="file2.txt"\r\n` +
          `\r\n` +
          `Content2\r\n` +
          `------boundary--\r\n`,
        isLast: true,
      };

      const response2 = await capturedHandler(chunk2, {
        method: 'POST',
        path: '/api/upload',
        headers: { 'content-type': 'multipart/form-data; boundary=----boundary' },
      });

      // Upload 1 deve falhar (507)
      expect(response1.statusCode).toBe(507);

      // Upload 2 deve ter sucesso (201)
      expect(response2.statusCode).toBe(201);
    });
  });

  describe('validação de contrato — FileEntryDto', () => {
    it('valida resposta de sucesso contra fileEntryDtoSchema', async () => {
      const maxUploadBytes = 1000000;

      let capturedHandler:
        | ((
            chunk: HttpUploadChunk,
            request: Omit<HttpServerRequest, 'body'>,
          ) => Promise<HttpServerResponse | void>)
        | null = null;
      mockHttpModule.addUploadListener.mockImplementation((path, handler) => {
        capturedHandler = handler;
      });

      registerUploadRoute(mockHttpModule, mockFileRepository, maxUploadBytes);

      const createdAt = Date.now();
      const testUuid = '550e8400-e29b-41d4-a716-446655440010';
      const mockWriteHandle = {
        id: testUuid,
        finalName: 'document.pdf',
        writeChunk: jest.fn().mockResolvedValue(undefined),
        finish: jest.fn().mockResolvedValue({
          id: testUuid,
          name: 'document.pdf',
          sizeBytes: 50000,
          mimeType: 'application/pdf',
          localUri: 'file:///received/document.pdf',
          origin: 'received' as const,
          createdAt,
        }),
        abort: jest.fn().mockResolvedValue(undefined),
      };

      mockFileRepository.beginStreamedWrite.mockResolvedValue(mockWriteHandle);
      mockFileRepository.toDto.mockReturnValue({
        id: testUuid,
        name: 'document.pdf',
        sizeBytes: 50000,
        mimeType: 'application/pdf',
        createdAt,
      });

      const uploadBody =
        `------boundary\r\n` +
        `Content-Disposition: form-data; name="file"; filename="document.pdf"\r\n` +
        `Content-Type: application/pdf\r\n` +
        `\r\n` +
        `PDF content\r\n` +
        `------boundary--\r\n`;

      const chunk: HttpUploadChunk = {
        requestId: 'req-1',
        data: uploadBody,
        isLast: true,
      };

      const response = await capturedHandler(chunk, {
        method: 'POST',
        path: '/api/upload',
        headers: { 'content-type': 'multipart/form-data; boundary=----boundary' },
      });

      expect(response.statusCode).toBe(201);

      const body = JSON.parse(typeof response.body === 'string' ? response.body : '');
      const parsed = fileEntryDtoSchema.safeParse(body.file);

      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.id).toBe('550e8400-e29b-41d4-a716-446655440010');
        expect(parsed.data.name).toBe('document.pdf');
        expect(parsed.data.sizeBytes).toBe(50000);
        expect(parsed.data.mimeType).toBe('application/pdf');
      }
    });

    it('valida envelope de erro contra apiErrorSchema para todos os códigos', async () => {
      const maxUploadBytes = 1000000;

      let capturedHandler:
        | ((
            chunk: HttpUploadChunk,
            request: Omit<HttpServerRequest, 'body'>,
          ) => Promise<HttpServerResponse | void>)
        | null = null;
      mockHttpModule.addUploadListener.mockImplementation((path, handler) => {
        capturedHandler = handler;
      });

      registerUploadRoute(mockHttpModule, mockFileRepository, maxUploadBytes);

      // Testar 400
      const chunk400: HttpUploadChunk = {
        requestId: 'req-1',
        data: 'invalid',
        isLast: true,
      };

      const response400 = await capturedHandler(chunk400, {
        method: 'POST',
        path: '/api/upload',
        headers: { 'content-type': 'multipart/form-data' }, // Sem boundary
      });

      const body400 = JSON.parse(typeof response400.body === 'string' ? response400.body : '');
      const parsed400 = apiErrorSchema.safeParse(body400);
      expect(parsed400.success).toBe(true);
    });
  });

  describe('casos de borda e segurança', () => {
    it('rejeita filename com path traversal (../../etc/passwd)', async () => {
      const maxUploadBytes = 1000000;

      let capturedHandler:
        | ((
            chunk: HttpUploadChunk,
            request: Omit<HttpServerRequest, 'body'>,
          ) => Promise<HttpServerResponse | void>)
        | null = null;
      mockHttpModule.addUploadListener.mockImplementation((path, handler) => {
        capturedHandler = handler;
      });

      registerUploadRoute(mockHttpModule, mockFileRepository, maxUploadBytes);

      mockFileRepository.beginStreamedWrite.mockRejectedValue(
        new Error('Nome sanitizado vazio (INVALID_FILENAME)'),
      );

      const uploadBody =
        `------boundary\r\n` +
        `Content-Disposition: form-data; name="file"; filename="../../etc/passwd"\r\n` +
        `\r\n` +
        `content\r\n` +
        `------boundary--\r\n`;

      const chunk: HttpUploadChunk = {
        requestId: 'req-1',
        data: uploadBody,
        isLast: true,
      };

      const response = await capturedHandler(chunk, {
        method: 'POST',
        path: '/api/upload',
        headers: { 'content-type': 'multipart/form-data; boundary=----boundary' },
      });

      expect(response.statusCode).toBe(422);
      const body = JSON.parse(typeof response.body === 'string' ? response.body : '');
      expect(body.error.code).toBe('INVALID_FILENAME');
    });

    it('trata filename com caracteres de controle', async () => {
      const maxUploadBytes = 1000000;

      let capturedHandler:
        | ((
            chunk: HttpUploadChunk,
            request: Omit<HttpServerRequest, 'body'>,
          ) => Promise<HttpServerResponse | void>)
        | null = null;
      mockHttpModule.addUploadListener.mockImplementation((path, handler) => {
        capturedHandler = handler;
      });

      registerUploadRoute(mockHttpModule, mockFileRepository, maxUploadBytes);

      mockFileRepository.beginStreamedWrite.mockRejectedValue(
        new Error('Nome sanitizado vazio (INVALID_FILENAME)'),
      );

      const uploadBody =
        `------boundary\r\n` +
        `Content-Disposition: form-data; name="file"; filename="file\x00name.txt"\r\n` +
        `\r\n` +
        `content\r\n` +
        `------boundary--\r\n`;

      const chunk: HttpUploadChunk = {
        requestId: 'req-1',
        data: uploadBody,
        isLast: true,
      };

      const response = await capturedHandler(chunk, {
        method: 'POST',
        path: '/api/upload',
        headers: { 'content-type': 'multipart/form-data; boundary=----boundary' },
      });

      expect(response.statusCode).toBe(422);
    });

    it('trata filename com acentos e unicode corretamente', async () => {
      const maxUploadBytes = 1000000;

      let capturedHandler:
        | ((
            chunk: HttpUploadChunk,
            request: Omit<HttpServerRequest, 'body'>,
          ) => Promise<HttpServerResponse | void>)
        | null = null;
      mockHttpModule.addUploadListener.mockImplementation((path, handler) => {
        capturedHandler = handler;
      });

      registerUploadRoute(mockHttpModule, mockFileRepository, maxUploadBytes);

      const testUuid = '550e8400-e29b-41d4-a716-446655440011';
      const createdAtTime = Date.now();

      const mockWriteHandle = {
        id: testUuid,
        finalName: 'relatório-ação-é.txt',
        writeChunk: jest.fn().mockResolvedValue(undefined),
        finish: jest.fn().mockResolvedValue({
          id: testUuid,
          name: 'relatório-ação-é.txt',
          sizeBytes: 10,
          mimeType: 'text/plain',
          localUri: 'file:///received/relatório-ação-é.txt',
          origin: 'received' as const,
          createdAt: createdAtTime,
        }),
        abort: jest.fn().mockResolvedValue(undefined),
      };

      mockFileRepository.beginStreamedWrite.mockResolvedValue(mockWriteHandle);
      mockFileRepository.toDto.mockReturnValue({
        id: testUuid,
        name: 'relatório-ação-é.txt',
        sizeBytes: 10,
        mimeType: 'text/plain',
        createdAt: createdAtTime,
      });

      const uploadBody =
        `------boundary\r\n` +
        `Content-Disposition: form-data; name="file"; filename="relatório-ação-é.txt"\r\n` +
        `\r\n` +
        `Conteúdo\r\n` +
        `------boundary--\r\n`;

      const chunk: HttpUploadChunk = {
        requestId: 'req-1',
        data: uploadBody,
        isLast: true,
      };

      const response = await capturedHandler(chunk, {
        method: 'POST',
        path: '/api/upload',
        headers: { 'content-type': 'multipart/form-data; boundary=----boundary' },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(typeof response.body === 'string' ? response.body : '');
      expect(body.file.name).toBe('relatório-ação-é.txt');
    });
  });
});
