/**
 * Testes unitários para FileRepository.
 *
 * Testa:
 * - Salvamento de arquivo com sanitização de nome e resolução de duplicata
 * - Listagem de arquivos
 * - Remoção de arquivo
 * - Mapeamento para DTO (sem localUri)
 * - Fluxo de metadados
 *
 * O mock de `expo-crypto` é carregado automaticamente pelo Jest durante os testes.
 */

import { createFileRepository } from '../services';
import type { FileSystemModule, FileRepository } from '../services';
import type { FileEntry } from '../types';

describe('FileRepository', () => {
  let repository: FileRepository;
  let mockFs: jest.Mocked<FileSystemModule>;

  beforeEach(() => {
    // Criar mock do módulo FileSystem
    mockFs = {
      documentDirectory: 'file:///mock-docs/',
      getInfoAsync: jest.fn(),
      readDirectoryAsync: jest.fn(),
      makeDirectoryAsync: jest.fn(),
      writeAsStringAsync: jest.fn(),
      readAsStringAsync: jest.fn(),
      deleteAsync: jest.fn(),
    };

    repository = createFileRepository(mockFs);
  });

  describe('save', () => {
    beforeEach(() => {
      // Configurar mocks padrão para um fluxo feliz
      (mockFs.getInfoAsync as jest.Mock).mockResolvedValue({
        exists: false,
        isDirectory: false,
      });
      (mockFs.readDirectoryAsync as jest.Mock).mockResolvedValue([]);
      (mockFs.makeDirectoryAsync as jest.Mock).mockResolvedValue(undefined);
      (mockFs.writeAsStringAsync as jest.Mock).mockResolvedValue(undefined);
      (mockFs.readAsStringAsync as jest.Mock).mockResolvedValue('[]');
    });

    it('deve salvar um arquivo com nome sanitizado', async () => {
      const entry = await repository.save(
        'conteúdo do arquivo',
        'documento.txt',
        'text/plain',
        'received',
      );

      expect(entry).toBeDefined();
      expect(entry.id).toBeDefined();
      expect(entry.name).toBe('documento.txt');
      expect(entry.origin).toBe('received');
      expect(entry.sizeBytes).toBeGreaterThan(0);
      expect(entry.mimeType).toBe('text/plain');
      expect(entry.createdAt).toBeGreaterThan(0);

      // Verificar que writeAsStringAsync foi chamado
      expect(mockFs.writeAsStringAsync).toHaveBeenCalledWith(
        expect.stringContaining('/received/documento.txt'),
        'conteúdo do arquivo',
      );
    });

    it('deve sanitizar nome com path traversal', async () => {
      const entry = await repository.save('conteúdo', '../../etc/passwd', 'text/plain', 'received');

      // O sanitizeFileName remove ../ e pega apenas o basename
      expect(entry.name).toBe('passwd');
      expect(entry.localUri).toContain('/received/passwd');
    });

    it('deve resolver nome duplicado com sufixo (n)', async () => {
      // Simular que 'documento.txt' já existe
      (mockFs.readDirectoryAsync as jest.Mock).mockResolvedValue(['documento.txt']);
      (mockFs.readAsStringAsync as jest.Mock).mockResolvedValue(
        JSON.stringify([
          {
            id: 'existing-id',
            name: 'documento.txt',
            sizeBytes: 100,
            mimeType: 'text/plain',
            localUri: 'file:///mock-docs/received/documento.txt',
            createdAt: Date.now(),
          },
        ]),
      );

      const entry = await repository.save(
        'novo conteúdo',
        'documento.txt',
        'text/plain',
        'received',
      );

      expect(entry.name).toBe('documento (1).txt');
      expect(entry.localUri).toContain('/received/documento (1).txt');
    });

    it('deve escrever em received/ para origin="received"', async () => {
      await repository.save('conteúdo', 'arquivo.bin', 'application/octet-stream', 'received');

      expect(mockFs.writeAsStringAsync).toHaveBeenCalledWith(
        expect.stringContaining('/received/'),
        'conteúdo',
      );
    });

    it('deve escrever em shared/ para origin="shared"', async () => {
      await repository.save('conteúdo', 'arquivo.bin', 'application/octet-stream', 'shared');

      expect(mockFs.writeAsStringAsync).toHaveBeenCalledWith(
        expect.stringContaining('/shared/'),
        'conteúdo',
      );
    });

    it('deve salvar metadados após escrever arquivo', async () => {
      await repository.save('conteúdo', 'doc.txt', 'text/plain', 'received');

      // Verificar que saveMetadata foi chamado (via writeAsStringAsync do .meta.json)
      const calls = (mockFs.writeAsStringAsync as jest.Mock).mock.calls;
      const metaCall = calls.find((c) => c[0].includes('.meta.json'));
      expect(metaCall).toBeDefined();

      // Verificar que o conteúdo é um JSON válido
      const metaContent = metaCall[1];
      expect(() => JSON.parse(metaContent)).not.toThrow();

      const metadata = JSON.parse(metaContent);
      expect(Array.isArray(metadata)).toBe(true);
      expect(metadata.length).toBeGreaterThan(0);
      expect(metadata[0]).toHaveProperty('id');
      expect(metadata[0]).toHaveProperty('name');
      expect(metadata[0]).toHaveProperty('sizeBytes');
    });
  });

  describe('list', () => {
    beforeEach(() => {
      (mockFs.readAsStringAsync as jest.Mock).mockImplementation((uri: string) => {
        if (uri.includes('/received/')) {
          return Promise.resolve(
            JSON.stringify([
              {
                id: 'file-1',
                name: 'recebido.txt',
                sizeBytes: 100,
                mimeType: 'text/plain',
                localUri: 'file:///mock-docs/received/recebido.txt',
                createdAt: 1000,
              },
            ]),
          );
        } else if (uri.includes('/shared/')) {
          return Promise.resolve(
            JSON.stringify([
              {
                id: 'file-2',
                name: 'compartilhado.pdf',
                sizeBytes: 5000,
                mimeType: 'application/pdf',
                localUri: 'file:///mock-docs/shared/compartilhado.pdf',
                createdAt: 2000,
              },
            ]),
          );
        }
        return Promise.resolve('[]');
      });
    });

    it('deve listar todos os arquivos quando origin não especificado', async () => {
      const entries = await repository.list();

      expect(entries).toHaveLength(2);
      expect(entries[0].name).toBe('recebido.txt');
      expect(entries[1].name).toBe('compartilhado.pdf');
    });

    it('deve listar apenas recebidos quando origin="received"', async () => {
      const entries = await repository.list('received');

      expect(entries).toHaveLength(1);
      expect(entries[0].name).toBe('recebido.txt');
      expect(entries[0].origin).toBe('received');
    });

    it('deve listar apenas compartilhados quando origin="shared"', async () => {
      const entries = await repository.list('shared');

      expect(entries).toHaveLength(1);
      expect(entries[0].name).toBe('compartilhado.pdf');
      expect(entries[0].origin).toBe('shared');
    });

    it('deve retornar array vazio se metadados não existem', async () => {
      (mockFs.readAsStringAsync as jest.Mock).mockRejectedValue(new Error('File not found'));

      const entries = await repository.list();

      expect(entries).toEqual([]);
    });
  });

  describe('remove', () => {
    beforeEach(() => {
      (mockFs.readAsStringAsync as jest.Mock).mockImplementation((uri: string) => {
        if (uri.includes('received') && uri.includes('.meta')) {
          return Promise.resolve(
            JSON.stringify([
              {
                id: 'file-to-remove',
                name: 'arquivo.txt',
                sizeBytes: 100,
                mimeType: 'text/plain',
                localUri: 'file:///mock-docs/received/arquivo.txt',
                createdAt: 1000,
              },
            ]),
          );
        }
        return Promise.resolve('[]');
      });
    });

    it('deve deletar arquivo e atualizar metadados', async () => {
      await repository.remove('file-to-remove');

      // Verificar que deleteAsync foi chamado
      expect(mockFs.deleteAsync).toHaveBeenCalledWith('file:///mock-docs/received/arquivo.txt');

      // Verificar que metadados foram salvos (agora vazio)
      const metaCalls = (mockFs.writeAsStringAsync as jest.Mock).mock.calls.filter((c) =>
        c[0].includes('.meta.json'),
      );
      expect(metaCalls.length).toBeGreaterThan(0);

      const lastMetaCall = metaCalls[metaCalls.length - 1];
      const updatedMeta = JSON.parse(lastMetaCall[1]);
      expect(updatedMeta).toEqual([]);
    });

    it('deve lançar erro se arquivo não existe', async () => {
      await expect(repository.remove('id-nao-existente')).rejects.toThrow(
        'File with id id-nao-existente not found',
      );
    });
  });

  describe('toDto', () => {
    it('deve mapear FileEntry para FileEntryDto sem localUri', () => {
      const entry: FileEntry = {
        id: 'test-id',
        name: 'documento.pdf',
        sizeBytes: 2048,
        mimeType: 'application/pdf',
        localUri: 'file:///mock-docs/received/documento.pdf',
        origin: 'received',
        createdAt: 1626000000000,
      };

      const dto = repository.toDto(entry);

      expect(dto).toEqual({
        id: 'test-id',
        name: 'documento.pdf',
        sizeBytes: 2048,
        mimeType: 'application/pdf',
        createdAt: 1626000000000,
      });

      // Verificar explicitamente que localUri não está no DTO
      expect(dto).not.toHaveProperty('localUri');
      expect(dto).not.toHaveProperty('origin');
    });

    it('deve aceitar qualquer origin e remover do DTO', () => {
      const entryShared: FileEntry = {
        id: 'shared-id',
        name: 'foto.jpg',
        sizeBytes: 4096,
        mimeType: 'image/jpeg',
        localUri: 'file:///mock-docs/shared/foto.jpg',
        origin: 'shared',
        createdAt: 1626000000001,
      };

      const dto = repository.toDto(entryShared);

      expect(dto).not.toHaveProperty('localUri');
      expect(dto).not.toHaveProperty('origin');
      expect(dto.id).toBe('shared-id');
    });
  });
});
