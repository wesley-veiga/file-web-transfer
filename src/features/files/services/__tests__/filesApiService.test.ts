import { listFilesForApi, getFileForDownload } from '../filesApiService';
import type { FileRepository } from '../fileRepository';
import type { FileEntry } from '../../types';

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
});
