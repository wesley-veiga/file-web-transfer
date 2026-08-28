import { registerFileRoutes, registerEventsRoute } from '../apiSetup';
import type { ApiRouter, ApiHandler } from '../../features/server/services/apiRouter';
import type { FileRepository } from '../../features/files/services/fileRepository';
import type { FileEntry } from '../../features/files/types';
import { fileEntryDtoSchema, apiErrorSchema } from '../../shared/types/api';
import { createFilesChangedAtTracker } from '../../shared/lib/filesChangedAtTracker';

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
        id: 'test-id',
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
        { id: 'test-id' },
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
        id: 'test-id',
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
        { id: 'test-id' },
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
        { method: 'GET', path: '/api/files/removed-file-id/download', headers: {} },
        { id: 'removed-file-id' },
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
        id: 'test-id',
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
        { id: 'test-id' },
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

describe('apiSetup — registerEventsRoute', () => {
  let mockApiRouter: jest.Mocked<ApiRouter>;

  beforeEach(() => {
    mockApiRouter = {
      register: jest.fn(),
      unregister: jest.fn(),
      addRoute: jest.fn(),
    };
  });

  describe('registro de rota', () => {
    it('registra GET /api/events no roteador', () => {
      const tracker = createFilesChangedAtTracker();
      registerEventsRoute(mockApiRouter, tracker);

      expect(mockApiRouter.addRoute).toHaveBeenCalledWith(
        'GET',
        '/api/events',
        expect.any(Function),
      );
    });
  });

  describe('GET /api/events', () => {
    it('retorna filesChangedAt atual quando since é omitido', async () => {
      let now = 1000;
      const tracker = createFilesChangedAtTracker(() => now);

      const handlers: Record<string, ApiHandler> = {};
      mockApiRouter.addRoute.mockImplementation((method, pattern, handler) => {
        handlers[`${method} ${pattern}`] = handler;
      });

      registerEventsRoute(mockApiRouter, tracker);

      const handler = handlers['GET /api/events'];
      const response = await handler({ method: 'GET', path: '/api/events', headers: {} }, {}, {});

      expect(response.statusCode).toBe(200);
      expect(response.headers?.['Content-Type']).toBe('application/json; charset=utf-8');

      const body = JSON.parse(typeof response.body === 'string' ? response.body : '');
      expect(body.filesChangedAt).toBe(1000);
    });

    it('retorna filesChangedAt maior que since quando arquivo foi alterado', async () => {
      let now = 1000;
      const tracker = createFilesChangedAtTracker(() => now);

      // Arquivo foi alterado em 1000
      tracker.get(); // inicializa

      // Simular passagem de tempo e mudança
      now = 2000;
      tracker.touch();

      const handlers: Record<string, ApiHandler> = {};
      mockApiRouter.addRoute.mockImplementation((method, pattern, handler) => {
        handlers[`${method} ${pattern}`] = handler;
      });

      registerEventsRoute(mockApiRouter, tracker);

      const handler = handlers['GET /api/events'];
      const response = await handler(
        { method: 'GET', path: '/api/events?since=1000', headers: {} },
        {},
        { since: '1000' },
      );

      expect(response.statusCode).toBe(200);

      const body = JSON.parse(typeof response.body === 'string' ? response.body : '');
      expect(body.filesChangedAt).toBe(2000);
      expect(body.filesChangedAt).toBeGreaterThan(1000);
    });

    it('retorna filesChangedAt igual a since quando nada mudou', async () => {
      const tracker = createFilesChangedAtTracker(() => 1000);

      const handlers: Record<string, ApiHandler> = {};
      mockApiRouter.addRoute.mockImplementation((method, pattern, handler) => {
        handlers[`${method} ${pattern}`] = handler;
      });

      registerEventsRoute(mockApiRouter, tracker);

      const handler = handlers['GET /api/events'];
      const response = await handler(
        { method: 'GET', path: '/api/events?since=1000', headers: {} },
        {},
        { since: '1000' },
      );

      expect(response.statusCode).toBe(200);

      const body = JSON.parse(typeof response.body === 'string' ? response.body : '');
      expect(body.filesChangedAt).toBe(1000);
      expect(body.filesChangedAt).toBe(1000); // igual a since
    });

    it('retorna filesChangedAt menor que since nunca (cronologia progressiva)', async () => {
      let now = 1500;
      const tracker = createFilesChangedAtTracker(() => now);

      const handlers: Record<string, ApiHandler> = {};
      mockApiRouter.addRoute.mockImplementation((method, pattern, handler) => {
        handlers[`${method} ${pattern}`] = handler;
      });

      registerEventsRoute(mockApiRouter, tracker);

      const handler = handlers['GET /api/events'];
      // Cliente consulta com since=1500, obtém o valor atual do tracker
      const response = await handler(
        { method: 'GET', path: '/api/events?since=1500', headers: {} },
        {},
        { since: '1500' },
      );

      expect(response.statusCode).toBe(200);

      const body = JSON.parse(typeof response.body === 'string' ? response.body : '');
      expect(body.filesChangedAt).toBeGreaterThanOrEqual(1500);
    });

    it('trata since inválido como 0 (qualquer timestamp é maior)', async () => {
      const tracker = createFilesChangedAtTracker(() => 1000);

      const handlers: Record<string, ApiHandler> = {};
      mockApiRouter.addRoute.mockImplementation((method, pattern, handler) => {
        handlers[`${method} ${pattern}`] = handler;
      });

      registerEventsRoute(mockApiRouter, tracker);

      const handler = handlers['GET /api/events'];

      // since não é um número
      const response1 = await handler(
        { method: 'GET', path: '/api/events?since=not-a-number', headers: {} },
        {},
        { since: 'not-a-number' },
      );

      expect(response1.statusCode).toBe(200);
      const body1 = JSON.parse(typeof response1.body === 'string' ? response1.body : '');
      expect(body1.filesChangedAt).toBe(1000);

      // since é infinity
      const response2 = await handler(
        { method: 'GET', path: '/api/events?since=Infinity', headers: {} },
        {},
        { since: 'Infinity' },
      );

      expect(response2.statusCode).toBe(200);
      const body2 = JSON.parse(typeof response2.body === 'string' ? response2.body : '');
      expect(body2.filesChangedAt).toBe(1000);
    });

    it('trata since=0 corretamente (primeira consulta sempre refaz GET /api/files)', async () => {
      const tracker = createFilesChangedAtTracker(() => 5000);

      const handlers: Record<string, ApiHandler> = {};
      mockApiRouter.addRoute.mockImplementation((method, pattern, handler) => {
        handlers[`${method} ${pattern}`] = handler;
      });

      registerEventsRoute(mockApiRouter, tracker);

      const handler = handlers['GET /api/events'];
      const response = await handler(
        { method: 'GET', path: '/api/events?since=0', headers: {} },
        {},
        { since: '0' },
      );

      expect(response.statusCode).toBe(200);

      const body = JSON.parse(typeof response.body === 'string' ? response.body : '');
      expect(body.filesChangedAt).toBe(5000);
      expect(body.filesChangedAt).toBeGreaterThan(0);
    });
  });

  describe('Integração: ciclo de polling web-ui', () => {
    it('simula polling sequencial com mudanças de arquivo', async () => {
      let now = 1000;
      const tracker = createFilesChangedAtTracker(() => now);

      const handlers: Record<string, ApiHandler> = {};
      mockApiRouter.addRoute.mockImplementation((method, pattern, handler) => {
        handlers[`${method} ${pattern}`] = handler;
      });

      registerEventsRoute(mockApiRouter, tracker);

      const handler = handlers['GET /api/events'];

      // Momento 1: web-ui consulta pela primeira vez (since=0)
      now = 1000;
      let response = await handler(
        { method: 'GET', path: '/api/events?since=0', headers: {} },
        {},
        { since: '0' },
      );
      let body = JSON.parse(typeof response.body === 'string' ? response.body : '');
      expect(body.filesChangedAt).toBe(1000);

      // Momento 2: arquivo é enviado (upload concluído)
      now = 2000;
      tracker.touch();

      // web-ui consulta novamente (since=1000)
      response = await handler(
        { method: 'GET', path: '/api/events?since=1000', headers: {} },
        {},
        { since: '1000' },
      );
      body = JSON.parse(typeof response.body === 'string' ? response.body : '');
      expect(body.filesChangedAt).toBe(2000);
      expect(body.filesChangedAt).toBeGreaterThan(1000);

      // Momento 3: nada mudou desde 2000
      now = 5000;
      response = await handler(
        { method: 'GET', path: '/api/events?since=2000', headers: {} },
        {},
        { since: '2000' },
      );
      body = JSON.parse(typeof response.body === 'string' ? response.body : '');
      expect(body.filesChangedAt).toBe(2000);
      expect(body.filesChangedAt).toBe(2000); // igual a since
    });
  });

  describe('validação de respostas', () => {
    it('sempre retorna HTTP 200 (nunca erro)', async () => {
      const tracker = createFilesChangedAtTracker(() => 1000);

      const handlers: Record<string, ApiHandler> = {};
      mockApiRouter.addRoute.mockImplementation((method, pattern, handler) => {
        handlers[`${method} ${pattern}`] = handler;
      });

      registerEventsRoute(mockApiRouter, tracker);

      const handler = handlers['GET /api/events'];

      const testCases: Record<string, string>[] = [
        { since: '0' },
        { since: '1000' },
        { since: '999999' },
        { since: 'invalid' },
        {},
      ];

      for (const query of testCases) {
        const response = await handler(
          { method: 'GET', path: '/api/events', headers: {} },
          {},
          query,
        );
        expect(response.statusCode).toBe(200);
      }
    });

    it('retorna JSON válido com filesChangedAt sempre', async () => {
      const tracker = createFilesChangedAtTracker(() => 1000);

      const handlers: Record<string, ApiHandler> = {};
      mockApiRouter.addRoute.mockImplementation((method, pattern, handler) => {
        handlers[`${method} ${pattern}`] = handler;
      });

      registerEventsRoute(mockApiRouter, tracker);

      const handler = handlers['GET /api/events'];
      const response = await handler(
        { method: 'GET', path: '/api/events?since=500', headers: {} },
        {},
        { since: '500' },
      );

      expect(response.statusCode).toBe(200);
      expect(response.headers?.['Content-Type']).toBe('application/json; charset=utf-8');

      const body = JSON.parse(typeof response.body === 'string' ? response.body : '');
      expect(body).toHaveProperty('filesChangedAt');
      expect(typeof body.filesChangedAt).toBe('number');
    });

    it('não inclui campos desnecessários na resposta', async () => {
      const tracker = createFilesChangedAtTracker(() => 1000);

      const handlers: Record<string, ApiHandler> = {};
      mockApiRouter.addRoute.mockImplementation((method, pattern, handler) => {
        handlers[`${method} ${pattern}`] = handler;
      });

      registerEventsRoute(mockApiRouter, tracker);

      const handler = handlers['GET /api/events'];
      const response = await handler({ method: 'GET', path: '/api/events', headers: {} }, {}, {});

      const body = JSON.parse(typeof response.body === 'string' ? response.body : '');
      expect(Object.keys(body)).toEqual(['filesChangedAt']);
    });
  });
});
