import { listFilesForApi, getFileForDownload } from '../filesApiService';
import type { FileRepository } from '../fileRepository';
import type { FileEntry } from '../../types';
import { fileEntryDtoSchema } from '../../../../shared/types/api';

describe('filesApiService', () => {
  let mockFileRepository: jest.Mocked<FileRepository>;

  beforeEach(() => {
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
  });

  describe('listFilesForApi', () => {
    it('retorna arquivos ordenados por createdAt desc', async () => {
      const now = Date.now();
      const entries: FileEntry[] = [
        {
          id: '1',
          name: 'arquivo1.txt',
          sizeBytes: 100,
          mimeType: 'text/plain',
          localUri: 'file:///path/1',
          origin: 'shared',
          createdAt: now - 2000,
        },
        {
          id: '2',
          name: 'arquivo2.txt',
          sizeBytes: 200,
          mimeType: 'text/plain',
          localUri: 'file:///path/2',
          origin: 'shared',
          createdAt: now,
        },
        {
          id: '3',
          name: 'arquivo3.txt',
          sizeBytes: 300,
          mimeType: 'text/plain',
          localUri: 'file:///path/3',
          origin: 'shared',
          createdAt: now - 1000,
        },
      ];

      mockFileRepository.list.mockResolvedValue(entries);

      const result = await listFilesForApi(mockFileRepository, 'shared');

      expect(mockFileRepository.list).toHaveBeenCalledWith('shared');
      expect(result).toHaveLength(3);
      // Verificar ordenação: mais recentes primeiro
      expect(result[0].id).toBe('2');
      expect(result[1].id).toBe('3');
      expect(result[2].id).toBe('1');
    });

    it('retorna lista vazia quando não há arquivos', async () => {
      mockFileRepository.list.mockResolvedValue([]);

      const result = await listFilesForApi(mockFileRepository, 'received');

      expect(result).toEqual([]);
      expect(mockFileRepository.list).toHaveBeenCalledWith('received');
    });

    it('usa origin padrão "shared" quando não especificado', async () => {
      mockFileRepository.list.mockResolvedValue([]);

      await listFilesForApi(mockFileRepository);

      expect(mockFileRepository.list).toHaveBeenCalledWith('shared');
    });

    it('não expõe localUri nos DTOs retornados', async () => {
      const entries: FileEntry[] = [
        {
          id: 'test-id',
          name: 'file.pdf',
          sizeBytes: 5000,
          mimeType: 'application/pdf',
          localUri: 'file:///sandbox/received/file.pdf',
          origin: 'shared',
          createdAt: Date.now(),
        },
      ];

      mockFileRepository.list.mockResolvedValue(entries);

      const result = await listFilesForApi(mockFileRepository);

      expect(result[0]).not.toHaveProperty('localUri');
      expect(result[0]).toHaveProperty('id');
      expect(result[0]).toHaveProperty('name');
    });
  });

  describe('getFileForDownload', () => {
    it('retorna informações do arquivo para download', async () => {
      const entry: FileEntry = {
        id: 'test-id',
        name: 'documento.pdf',
        sizeBytes: 5000,
        mimeType: 'application/pdf',
        localUri: 'file:///sandbox/received/documento.pdf',
        origin: 'received',
        createdAt: Date.now(),
      };

      mockFileRepository.list.mockResolvedValue([entry]);

      const result = await getFileForDownload(mockFileRepository, 'test-id');

      expect(result).not.toBeNull();
      expect(result?.localUri).toBe(entry.localUri);
      expect(result?.name).toBe(entry.name);
      expect(result?.mimeType).toBe(entry.mimeType);
      expect(result?.sizeBytes).toBe(entry.sizeBytes);
    });

    it('retorna null quando arquivo não existe', async () => {
      mockFileRepository.list.mockResolvedValue([]);

      const result = await getFileForDownload(mockFileRepository, 'nonexistent-id');

      expect(result).toBeNull();
    });

    it('busca em ambos os origins (shared e received)', async () => {
      const receivedEntry: FileEntry = {
        id: 'shared-id',
        name: 'shared.txt',
        sizeBytes: 100,
        mimeType: 'text/plain',
        localUri: 'file:///sandbox/shared/shared.txt',
        origin: 'shared',
        createdAt: Date.now(),
      };

      mockFileRepository.list.mockResolvedValue([receivedEntry]);

      const result = await getFileForDownload(mockFileRepository, 'shared-id');

      expect(mockFileRepository.list).toHaveBeenCalledWith();
      expect(result).not.toBeNull();
      expect(result?.name).toBe('shared.txt');
    });

    it('manipula nomes de arquivo com acentos corretamente', async () => {
      const entry: FileEntry = {
        id: 'accent-id',
        name: 'relatório-2026.pdf',
        sizeBytes: 2000,
        mimeType: 'application/pdf',
        localUri: 'file:///sandbox/shared/relatório-2026.pdf',
        origin: 'shared',
        createdAt: Date.now(),
      };

      mockFileRepository.list.mockResolvedValue([entry]);

      const result = await getFileForDownload(mockFileRepository, 'accent-id');

      expect(result?.name).toBe('relatório-2026.pdf');
    });
  });

  describe('casos de borde e segurança', () => {
    describe('listFilesForApi', () => {
      it('retorna lista vazia quando há 0 arquivos', async () => {
        mockFileRepository.list.mockResolvedValue([]);

        const result = await listFilesForApi(mockFileRepository, 'shared');

        expect(result).toEqual([]);
        expect(result).toHaveLength(0);
      });

      it('ordena múltiplos arquivos por createdAt descendente estritamente', async () => {
        const baseTime = 1000000;
        const entries: FileEntry[] = [
          {
            id: '550e8400-e29b-41d4-a716-446655440001',
            name: 'first.txt',
            sizeBytes: 100,
            mimeType: 'text/plain',
            localUri: 'file:///1',
            origin: 'shared',
            createdAt: baseTime + 100,
          },
          {
            id: '550e8400-e29b-41d4-a716-446655440002',
            name: 'second.txt',
            sizeBytes: 200,
            mimeType: 'text/plain',
            localUri: 'file:///2',
            origin: 'shared',
            createdAt: baseTime + 1000,
          },
          {
            id: '550e8400-e29b-41d4-a716-446655440003',
            name: 'third.txt',
            sizeBytes: 300,
            mimeType: 'text/plain',
            localUri: 'file:///3',
            origin: 'shared',
            createdAt: baseTime,
          },
          {
            id: '550e8400-e29b-41d4-a716-446655440004',
            name: 'fourth.txt',
            sizeBytes: 400,
            mimeType: 'text/plain',
            localUri: 'file:///4',
            origin: 'shared',
            createdAt: baseTime + 500,
          },
        ];

        mockFileRepository.list.mockResolvedValue(entries);

        const result = await listFilesForApi(mockFileRepository, 'shared');

        expect(result).toHaveLength(4);
        // Verificar que TODOS estão em ordem descendente
        expect(result[0].createdAt).toBe(baseTime + 1000); // newest
        expect(result[1].createdAt).toBe(baseTime + 500);
        expect(result[2].createdAt).toBe(baseTime + 100);
        expect(result[3].createdAt).toBe(baseTime); // oldest
        // Verificar que os nomes correspondem à ordem
        expect(result[0].name).toBe('second.txt');
        expect(result[1].name).toBe('fourth.txt');
        expect(result[2].name).toBe('first.txt');
        expect(result[3].name).toBe('third.txt');
      });

      it('valida todos os DTOs retornados contra fileEntryDtoSchema.array()', async () => {
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

        const result = await listFilesForApi(mockFileRepository, 'received');

        // Validar contra schema Zod
        const parsed = fileEntryDtoSchema.array().safeParse(result);
        expect(parsed.success).toBe(true);

        if (parsed.success) {
          expect(parsed.data).toHaveLength(2);
          // Verificar que cada item tem as propriedades esperadas e nenhuma localUri
          parsed.data.forEach((dto) => {
            expect(dto).toHaveProperty('id');
            expect(dto).toHaveProperty('name');
            expect(dto).toHaveProperty('sizeBytes');
            expect(dto).toHaveProperty('mimeType');
            expect(dto).toHaveProperty('createdAt');
            expect(dto).not.toHaveProperty('localUri');
          });
        }
      });

      it('nunca expõe localUri mesmo em payload JSON stringificado', async () => {
        const entries: FileEntry[] = [
          {
            id: '550e8400-e29b-41d4-a716-446655440007',
            name: 'file.txt',
            sizeBytes: 100,
            mimeType: 'text/plain',
            localUri: '/secret/internal/path/file.txt',
            origin: 'shared',
            createdAt: Date.now(),
          },
        ];

        mockFileRepository.list.mockResolvedValue(entries);

        const result = await listFilesForApi(mockFileRepository, 'shared');

        // Converter para JSON e verificar que não contém localUri
        const jsonStr = JSON.stringify(result);
        expect(jsonStr).not.toContain('localUri');
        expect(jsonStr).not.toContain('/secret/internal/path');
      });

      it('retorna DTOs sem referência ao localUri original', async () => {
        const entries: FileEntry[] = [
          {
            id: '550e8400-e29b-41d4-a716-446655440008',
            name: 'document.pdf',
            sizeBytes: 5000,
            mimeType: 'application/pdf',
            localUri: 'file:///data/user/0/app/files/document.pdf',
            origin: 'shared',
            createdAt: Date.now(),
          },
        ];

        mockFileRepository.list.mockResolvedValue(entries);

        const result = await listFilesForApi(mockFileRepository, 'shared');

        expect(result[0]).not.toHaveProperty('localUri');
        // Apenas as propriedades públicas existem
        expect(Object.keys(result[0]).sort()).toEqual(
          ['id', 'name', 'sizeBytes', 'mimeType', 'createdAt'].sort(),
        );
      });
    });

    describe('getFileForDownload', () => {
      it('retorna null para id inexistente mesmo com muitos arquivos na lista', async () => {
        const entries: FileEntry[] = [
          {
            id: '550e8400-e29b-41d4-a716-446655440010',
            name: 'file1.txt',
            sizeBytes: 100,
            mimeType: 'text/plain',
            localUri: 'file:///1',
            origin: 'shared',
            createdAt: Date.now(),
          },
          {
            id: '550e8400-e29b-41d4-a716-446655440011',
            name: 'file2.txt',
            sizeBytes: 200,
            mimeType: 'text/plain',
            localUri: 'file:///2',
            origin: 'received',
            createdAt: Date.now() + 1000,
          },
        ];

        mockFileRepository.list.mockResolvedValue(entries);

        const result = await getFileForDownload(
          mockFileRepository,
          '550e8400-e29b-41d4-a716-446655440099',
        );

        expect(result).toBeNull();
      });

      it('retorna localUri para acesso ao arquivo mesmo que não seja exposto na API', async () => {
        const expectedUri = 'file:///data/files/important.pdf';
        const entry: FileEntry = {
          id: '550e8400-e29b-41d4-a716-446655440012',
          name: 'important.pdf',
          sizeBytes: 5000,
          mimeType: 'application/pdf',
          localUri: expectedUri,
          origin: 'shared',
          createdAt: Date.now(),
        };

        mockFileRepository.list.mockResolvedValue([entry]);

        const result = await getFileForDownload(
          mockFileRepository,
          '550e8400-e29b-41d4-a716-446655440012',
        );

        expect(result).not.toBeNull();
        expect(result?.localUri).toBe(expectedUri);
        // Mas outras informações estão disponíveis
        expect(result?.name).toBe('important.pdf');
        expect(result?.sizeBytes).toBe(5000);
      });

      it('encontra arquivo com path traversal em id (não executa traversal)', async () => {
        const entry: FileEntry = {
          id: 'legitimate-id',
          name: 'file.txt',
          sizeBytes: 100,
          mimeType: 'text/plain',
          localUri: 'file:///path/file.txt',
          origin: 'shared',
          createdAt: Date.now(),
        };

        mockFileRepository.list.mockResolvedValue([entry]);

        // Tentar buscar com id malicioso
        const result = await getFileForDownload(mockFileRepository, '../../etc/passwd');

        // Deve retornar null (id não corresponde a nenhum arquivo)
        expect(result).toBeNull();
      });

      it('trata nome de arquivo com emoji/unicode corretamente em retorno', async () => {
        const entry: FileEntry = {
          id: '550e8400-e29b-41d4-a716-446655440009',
          name: '📄 Relatório Financeiro 2026-Q3_年度.pdf',
          sizeBytes: 15000,
          mimeType: 'application/pdf',
          localUri: 'file:///files/emoji-report.pdf',
          origin: 'shared',
          createdAt: Date.now(),
        };

        mockFileRepository.list.mockResolvedValue([entry]);

        const result = await getFileForDownload(
          mockFileRepository,
          '550e8400-e29b-41d4-a716-446655440009',
        );

        expect(result).not.toBeNull();
        expect(result?.name).toBe('📄 Relatório Financeiro 2026-Q3_年度.pdf');
        expect(result?.sizeBytes).toBe(15000);
      });

      it('encontra arquivo entre múltiplos de ambos os origins', async () => {
        const receivedEntry: FileEntry = {
          id: '550e8400-e29b-41d4-a716-446655440005',
          name: 'received-file.txt',
          sizeBytes: 100,
          mimeType: 'text/plain',
          localUri: 'file:///received/file.txt',
          origin: 'received',
          createdAt: Date.now(),
        };

        const sharedEntry: FileEntry = {
          id: '550e8400-e29b-41d4-a716-446655440006',
          name: 'shared-file.txt',
          sizeBytes: 200,
          mimeType: 'text/plain',
          localUri: 'file:///shared/file.txt',
          origin: 'shared',
          createdAt: Date.now() + 1000,
        };

        mockFileRepository.list.mockResolvedValue([receivedEntry, sharedEntry]);

        // Buscar o arquivo shared
        const resultShared = await getFileForDownload(
          mockFileRepository,
          '550e8400-e29b-41d4-a716-446655440006',
        );
        expect(resultShared?.name).toBe('shared-file.txt');

        // Buscar o arquivo received
        const resultReceived = await getFileForDownload(
          mockFileRepository,
          '550e8400-e29b-41d4-a716-446655440005',
        );
        expect(resultReceived?.name).toBe('received-file.txt');
      });
    });
  });
});
