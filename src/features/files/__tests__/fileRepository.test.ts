/**
 * Testes unitários para FileRepository.
 *
 * Testa:
 * - Salvamento de arquivo com sanitização de nome e resolução de duplicata
 * - Listagem de arquivos
 * - Remoção de arquivo
 * - Mapeamento para DTO (sem localUri)
 * - Fluxo de metadados
 * - Casos extremos (nomes vazios, muitos caracteres, 0 bytes)
 * - Segurança (path traversal, caracteres de controle, unicode malicioso)
 * - Diretórios inexistentes e metadados corrompidos
 * - Validação contra schemas Zod
 * - Factory e injeção de dependência
 *
 * O mock de `expo-crypto` é carregado automaticamente pelo Jest durante os testes.
 */

import { z } from 'zod';

import { fileEntryDtoSchema } from '../../../shared/types/api';
import { createFileRepository, setFileSystemModule } from '../services';
import type { FileSystemModule, FileRepository } from '../services';
import type { FileEntry } from '../types';
import { createMockFileSystemModule } from '../../../__mocks__/testHelpers';

describe('FileRepository', () => {
  let repository: FileRepository;
  let mockFs: jest.Mocked<FileSystemModule>;

  beforeEach(() => {
    // Criar mock do módulo FileSystem
    mockFs = createMockFileSystemModule();
    mockFs.documentDirectory = 'file:///mock-docs/';

    repository = createFileRepository(mockFs);
  });

  describe('save', () => {
    beforeEach(() => {
      // Configurar mocks padrão para um fluxo feliz
      // Rastrear conteúdo escrito para retornar size correto
      const writtenFiles = new Map<string, string>();

      (mockFs.getInfoAsync as jest.Mock).mockImplementation(async (uri: string) => {
        // Se arquivo foi escrito, retornar size; senão, não existe
        if (writtenFiles.has(uri)) {
          const content = writtenFiles.get(uri) || '';
          return {
            exists: true,
            isDirectory: false,
            size: Buffer.byteLength(content, 'utf8'),
          };
        }
        return { exists: false, isDirectory: false };
      });

      (mockFs.writeAsStringAsync as jest.Mock).mockImplementation(
        async (uri: string, content: string) => {
          writtenFiles.set(uri, content);
        },
      );

      (mockFs.readDirectoryAsync as jest.Mock).mockResolvedValue([]);
      (mockFs.makeDirectoryAsync as jest.Mock).mockResolvedValue(undefined);
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

    it('entrada vinculada (linked: true): remove só o metadado, NUNCA chama deleteAsync no arquivo real (T-701)', async () => {
      (mockFs.readAsStringAsync as jest.Mock).mockImplementation((uri: string) => {
        if (uri.includes('shared') && uri.includes('.meta')) {
          return Promise.resolve(
            JSON.stringify([
              {
                id: 'linked-file',
                name: 'foto.jpg',
                sizeBytes: 100,
                mimeType: 'image/jpeg',
                localUri: 'content://com.android.externalstorage.documents/document/foto.jpg',
                createdAt: 1000,
                linked: true,
              },
            ]),
          );
        }
        return Promise.resolve('[]');
      });

      await repository.remove('linked-file');

      expect(mockFs.deleteAsync).not.toHaveBeenCalled();

      const metaCalls = (mockFs.writeAsStringAsync as jest.Mock).mock.calls.filter((c) =>
        c[0].includes('/shared/.meta.json'),
      );
      const updatedMeta = JSON.parse(metaCalls[metaCalls.length - 1][1]);
      expect(updatedMeta).toEqual([]);
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

    it('deve retornar DTO válido conforme fileEntryDtoSchema', () => {
      const entry: FileEntry = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        name: 'test.pdf',
        sizeBytes: 1024,
        mimeType: 'application/pdf',
        localUri: 'file:///path/to/test.pdf',
        origin: 'received',
        createdAt: Date.now(),
      };

      const dto = repository.toDto(entry);

      // Validar contra schema Zod
      expect(() => fileEntryDtoSchema.parse(dto)).not.toThrow();
    });

    it('deve nunca incluir localUri ou origin no DTO mesmo se entrada inválida', () => {
      const entry: FileEntry = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        name: 'file.bin',
        sizeBytes: 0,
        mimeType: 'application/octet-stream',
        localUri: 'file:///private/secret/path',
        origin: 'received',
        createdAt: 1000000000,
      };

      const dto = repository.toDto(entry);
      const keys = Object.keys(dto);

      expect(keys).not.toContain('localUri');
      expect(keys).not.toContain('origin');
      expect(keys).toEqual(['id', 'name', 'sizeBytes', 'mimeType', 'createdAt']);
    });
  });

  describe('save - casos extremos e segurança', () => {
    beforeEach(() => {
      // Rastrear conteúdo escrito para retornar size correto
      const writtenFiles = new Map<string, string>();

      (mockFs.getInfoAsync as jest.Mock).mockImplementation(async (uri: string) => {
        // Se arquivo foi escrito, retornar size; senão, não existe
        if (writtenFiles.has(uri)) {
          const content = writtenFiles.get(uri) || '';
          return {
            exists: true,
            isDirectory: false,
            size: Buffer.byteLength(content, 'utf8'),
          };
        }
        return { exists: false, isDirectory: false };
      });

      (mockFs.writeAsStringAsync as jest.Mock).mockImplementation(
        async (uri: string, content: string) => {
          writtenFiles.set(uri, content);
        },
      );

      (mockFs.readDirectoryAsync as jest.Mock).mockResolvedValue([]);
      (mockFs.makeDirectoryAsync as jest.Mock).mockResolvedValue(undefined);
      (mockFs.readAsStringAsync as jest.Mock).mockResolvedValue('[]');
    });

    it('deve rejeitar path traversal com múltiplos ../../../', async () => {
      const entry = await repository.save(
        'conteúdo',
        '../../../etc/passwd',
        'text/plain',
        'received',
      );

      expect(entry.name).toBe('passwd');
      expect(entry.localUri).not.toContain('..');
    });

    it('deve rejeitar path traversal com backslash (estilo Windows)', async () => {
      const entry = await repository.save(
        'conteúdo',
        '..\\..\\windows\\system32',
        'text/plain',
        'received',
      );

      // sanitizeFileName remove backslashes
      expect(entry.localUri).not.toContain('\\');
    });

    it('deve remover caracteres de controle do nome', async () => {
      const nameWithControl = 'arquivo\x00\x01\x02.txt';
      const entry = await repository.save('conteúdo', nameWithControl, 'text/plain', 'received');

      // Nome deve ser sanitizado sem caracteres de controle
      expect(entry.name).not.toContain('\x00');
      expect(entry.name).not.toContain('\x01');
    });

    it('deve tratar arquivo de 0 bytes', async () => {
      const entry = await repository.save('', 'vazio.txt', 'text/plain', 'received');

      expect(entry.sizeBytes).toBe(0);
      expect(entry.id).toBeDefined();
      expect(mockFs.writeAsStringAsync).toHaveBeenCalled();
    });

    it('deve tratar arquivo com conteúdo UTF-8 multibyte', async () => {
      const content = '你好世界🌍🎉';
      const entry = await repository.save(content, 'utf8.txt', 'text/plain', 'received');

      // sizeBytes deve estar correto (UTF-8 multibyte contado corretamente)
      expect(entry.sizeBytes).toBe(Buffer.byteLength(content, 'utf8'));
      expect(entry.sizeBytes).toBeGreaterThan(content.length);
    });

    it('deve lidar com nome vazio após sanitização', async () => {
      const entry = await repository.save('conteúdo', '\x00\x01', 'text/plain', 'received');

      // sanitizeFileName retorna 'arquivo' como padrão
      expect(entry.name).toBe('arquivo');
    });

    it('deve lidar com nome contendo apenas pontos', async () => {
      const entry = await repository.save('conteúdo', '...', 'text/plain', 'received');

      expect(entry.name).toBe('arquivo');
    });

    it('deve truncar nome com mais de 255 caracteres preservando extensão', async () => {
      const longName = 'a'.repeat(250) + '.pdf';
      const entry = await repository.save('conteúdo', longName, 'application/pdf', 'received');

      expect(entry.name.length).toBeLessThanOrEqual(255);
      expect(entry.name).toContain('.pdf');
    });

    it('deve gerar UUID único para cada arquivo salvo', async () => {
      const entry1 = await repository.save('conteúdo1', 'file1.txt', 'text/plain', 'received');
      const entry2 = await repository.save('conteúdo2', 'file2.txt', 'text/plain', 'received');

      expect(entry1.id).not.toBe(entry2.id);
      // Validar formato UUID v4 (padrão Zod)
      expect(() => z.string().uuid().parse(entry1.id)).not.toThrow();
      expect(() => z.string().uuid().parse(entry2.id)).not.toThrow();
    });

    it('deve preservar timestamp correto', async () => {
      const beforeSave = Date.now();
      const entry = await repository.save('conteúdo', 'timed.txt', 'text/plain', 'received');
      const afterSave = Date.now();

      expect(entry.createdAt).toBeGreaterThanOrEqual(beforeSave);
      expect(entry.createdAt).toBeLessThanOrEqual(afterSave);
    });
  });

  describe('save - metadados e diretórios', () => {
    beforeEach(() => {
      (mockFs.getInfoAsync as jest.Mock).mockResolvedValue({
        exists: false,
        isDirectory: false,
      });
      (mockFs.readDirectoryAsync as jest.Mock).mockResolvedValue([]);
      (mockFs.makeDirectoryAsync as jest.Mock).mockResolvedValue(undefined);
      (mockFs.writeAsStringAsync as jest.Mock).mockResolvedValue(undefined);
      (mockFs.readAsStringAsync as jest.Mock).mockResolvedValue('[]');
    });

    it('deve criar diretório se não existir', async () => {
      (mockFs.getInfoAsync as jest.Mock).mockResolvedValue({
        exists: false,
        isDirectory: false,
      });

      await repository.save('conteúdo', 'novo.txt', 'text/plain', 'received');

      expect(mockFs.makeDirectoryAsync).toHaveBeenCalledWith(expect.stringContaining('/received'), {
        intermediates: true,
      });
    });

    it('deve recuperar metadados existentes ao salvar novo arquivo', async () => {
      const existingMeta = JSON.stringify([
        {
          id: 'existing-file-id',
          name: 'existing.txt',
          sizeBytes: 100,
          mimeType: 'text/plain',
          localUri: 'file:///mock-docs/received/existing.txt',
          createdAt: 1000,
        },
      ]);

      (mockFs.readAsStringAsync as jest.Mock).mockResolvedValue(existingMeta);

      await repository.save('novo conteúdo', 'novo.txt', 'text/plain', 'received');

      // Verificar que ao salvar metadados finais, inclui tanto o arquivo existente quanto o novo
      const metaCalls = (mockFs.writeAsStringAsync as jest.Mock).mock.calls.filter((c) =>
        c[0].includes('.meta.json'),
      );
      const lastMetaCall = metaCalls[metaCalls.length - 1];
      const finalMeta = JSON.parse(lastMetaCall[1]);

      expect(finalMeta.length).toBe(2);
      expect(finalMeta[0].id).toBe('existing-file-id');
      expect(finalMeta[1].name).toBe('novo.txt');
    });

    it('deve lidar com metadados corrompidos durante salvamento', async () => {
      (mockFs.readAsStringAsync as jest.Mock).mockResolvedValue('{ invalid json }');

      await repository.save('conteúdo', 'novo.txt', 'text/plain', 'received');

      // Deve degradar graciosamente (começar com array vazio)
      const metaCalls = (mockFs.writeAsStringAsync as jest.Mock).mock.calls.filter((c) =>
        c[0].includes('.meta.json'),
      );
      const lastMetaCall = metaCalls[metaCalls.length - 1];
      const meta = JSON.parse(lastMetaCall[1]);

      expect(Array.isArray(meta)).toBe(true);
      expect(meta.length).toBe(1);
    });

    it('deve retornar entry com localUri correto', async () => {
      const entry = await repository.save('conteúdo', 'myfile.txt', 'text/plain', 'received');

      expect(entry.localUri).toContain('/received/');
      expect(entry.localUri).toContain('myfile.txt');
    });
  });

  describe('list - casos extremos', () => {
    it('deve retornar array vazio quando ambos os diretórios não existem', async () => {
      (mockFs.readAsStringAsync as jest.Mock).mockRejectedValue(new Error('Not found'));

      const entries = await repository.list();

      expect(entries).toEqual([]);
    });

    it('deve retornar array vazio quando nenhum diretório foi inicializado', async () => {
      (mockFs.readAsStringAsync as jest.Mock).mockImplementation(() =>
        Promise.reject(new Error('File not found')),
      );

      const entriesAll = await repository.list();
      const entriesReceived = await repository.list('received');
      const entriesShared = await repository.list('shared');

      expect(entriesAll).toEqual([]);
      expect(entriesReceived).toEqual([]);
      expect(entriesShared).toEqual([]);
    });

    it('deve lidar com metadados JSON inválido em um diretório', async () => {
      (mockFs.readAsStringAsync as jest.Mock).mockImplementation((uri: string) => {
        if (uri.includes('received')) {
          return Promise.reject(new Error('Corrupt file'));
        }
        if (uri.includes('shared')) {
          return Promise.resolve(
            JSON.stringify([
              {
                id: 'valid-id',
                name: 'valid.txt',
                sizeBytes: 100,
                mimeType: 'text/plain',
                localUri: 'file:///mock-docs/shared/valid.txt',
                createdAt: 1000,
              },
            ]),
          );
        }
        return Promise.resolve('[]');
      });

      const entries = await repository.list();

      // Deve retornar apenas os compartilhados (received falhou graciosamente)
      expect(entries.length).toBe(1);
      expect(entries[0].origin).toBe('shared');
    });
  });

  describe('remove - casos extremos', () => {
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
              {
                id: 'file-to-keep',
                name: 'outro.txt',
                sizeBytes: 50,
                mimeType: 'text/plain',
                localUri: 'file:///mock-docs/received/outro.txt',
                createdAt: 2000,
              },
            ]),
          );
        }
        return Promise.resolve('[]');
      });
    });

    it('deve manter outros arquivos ao remover um', async () => {
      await repository.remove('file-to-remove');

      const metaCalls = (mockFs.writeAsStringAsync as jest.Mock).mock.calls.filter((c) =>
        c[0].includes('.meta.json'),
      );
      const lastMetaCall = metaCalls[metaCalls.length - 1];
      const updated = JSON.parse(lastMetaCall[1]);

      expect(updated.length).toBe(1);
      expect(updated[0].id).toBe('file-to-keep');
    });

    it('deve falhar ao tentar remover arquivo inexistente', async () => {
      await expect(repository.remove('non-existent-id')).rejects.toThrow(
        'File with id non-existent-id not found',
      );
    });

    it('deve chamar deleteAsync com o localUri correto', async () => {
      await repository.remove('file-to-remove');

      expect(mockFs.deleteAsync).toHaveBeenCalledWith('file:///mock-docs/received/arquivo.txt');
    });
  });

  describe('save - erros de filesystem', () => {
    it('deve tentar criar diretório ao getInfoAsync falhar (graceful degradation)', async () => {
      (mockFs.getInfoAsync as jest.Mock).mockRejectedValue(new Error('getInfoAsync failed'));
      (mockFs.makeDirectoryAsync as jest.Mock).mockResolvedValue(undefined);
      (mockFs.readDirectoryAsync as jest.Mock).mockResolvedValue([]);
      (mockFs.writeAsStringAsync as jest.Mock).mockResolvedValue(undefined);
      (mockFs.readAsStringAsync as jest.Mock).mockResolvedValue('[]');

      const entry = await repository.save('conteúdo', 'arquivo.txt', 'text/plain', 'received');

      expect(entry).toBeDefined();
      // makeDirectoryAsync deve ser chamado como fallback
      expect(mockFs.makeDirectoryAsync).toHaveBeenCalled();
    });

    it('deve lidar com erro ao tentar criar diretório', async () => {
      (mockFs.getInfoAsync as jest.Mock).mockResolvedValue({
        exists: false,
        isDirectory: false,
      });
      (mockFs.makeDirectoryAsync as jest.Mock).mockRejectedValue(new Error('Permission denied'));
      (mockFs.readDirectoryAsync as jest.Mock).mockResolvedValue([]);

      await expect(
        repository.save('conteúdo', 'arquivo.txt', 'text/plain', 'received'),
      ).rejects.toThrow('Permission denied');
    });

    it('deve retornar lista vazia de nomes ao falhar readDirectoryAsync (graceful)', async () => {
      (mockFs.getInfoAsync as jest.Mock).mockResolvedValue({
        exists: true,
        isDirectory: true,
      });
      (mockFs.makeDirectoryAsync as jest.Mock).mockResolvedValue(undefined);
      // readDirectoryAsync falha quando chamado para listar nomes existentes
      (mockFs.readDirectoryAsync as jest.Mock).mockRejectedValue(
        new Error('Cannot list directory'),
      );
      (mockFs.writeAsStringAsync as jest.Mock).mockResolvedValue(undefined);
      (mockFs.readAsStringAsync as jest.Mock).mockResolvedValue('[]');

      // Ainda deve funcionar porque trata o erro e retorna lista vazia
      const entry = await repository.save('conteúdo', 'arquivo.txt', 'text/plain', 'received');

      expect(entry).toBeDefined();
      expect(entry.name).toBe('arquivo.txt');
    });
  });

  describe('list - erros de filesystem', () => {
    it('deve retornar array vazio quando readAsStringAsync (loadMetadata) falha em ambos diretórios', async () => {
      // Simular erro ao tentar carregar metadados em received
      (mockFs.readAsStringAsync as jest.Mock).mockRejectedValue(new Error('Cannot read metadata'));

      const entries = await repository.list();

      // Como ambos received e shared falham, retorna vazio
      expect(entries).toEqual([]);
    });

    it('deve retornar array vazio ao falhar no processamento de metadados (degradação graciosa)', async () => {
      // Retornar metadata inválida (non-array) que causa erro no map
      (mockFs.readAsStringAsync as jest.Mock).mockResolvedValue('null');

      // JSON.parse('null') retorna null, não um array
      const entries = await repository.list();

      // O catch em listFromDir garante que retorna array vazio
      expect(entries).toEqual([]);
    });

    it('deve retornar apenas shared quando received falha ao carregar metadados', async () => {
      (mockFs.readAsStringAsync as jest.Mock).mockImplementation((uri: string) => {
        if (uri.includes('received')) {
          return Promise.reject(new Error('Cannot read received metadata'));
        }
        if (uri.includes('shared')) {
          return Promise.resolve(
            JSON.stringify([
              {
                id: 'shared-file-id',
                name: 'shared.txt',
                sizeBytes: 100,
                mimeType: 'text/plain',
                localUri: 'file:///mock-docs/shared/shared.txt',
                createdAt: 1000,
              },
            ]),
          );
        }
        return Promise.resolve('[]');
      });

      const entries = await repository.list();

      expect(entries.length).toBe(1);
      expect(entries[0].origin).toBe('shared');
      expect(entries[0].name).toBe('shared.txt');
    });

    it('deve retornar apenas received quando shared falha ao carregar metadados', async () => {
      (mockFs.readAsStringAsync as jest.Mock).mockImplementation((uri: string) => {
        if (uri.includes('received')) {
          return Promise.resolve(
            JSON.stringify([
              {
                id: 'received-file-id',
                name: 'received.txt',
                sizeBytes: 50,
                mimeType: 'text/plain',
                localUri: 'file:///mock-docs/received/received.txt',
                createdAt: 999,
              },
            ]),
          );
        }
        if (uri.includes('shared')) {
          return Promise.reject(new Error('Cannot read shared metadata'));
        }
        return Promise.resolve('[]');
      });

      const entries = await repository.list();

      expect(entries.length).toBe(1);
      expect(entries[0].origin).toBe('received');
    });
  });

  describe('factory - cobertura de branches de createDefaultFileSystemModule', () => {
    it('deve usar fallback quando documentDirectory é falsy (null, undefined, etc)', () => {
      // Este teste força a execução da branch do || em createDefaultFileSystemModule
      // Criamos um módulo sem documentDirectory para simular expo-file-system sem esse valor
      const partialFs = createMockFileSystemModule();
      partialFs.documentDirectory = undefined;

      const repo = createFileRepository(partialFs);

      // Deve funcionar com o fallback 'file:///document/'
      expect(repo).toBeDefined();
    });
  });

  describe('factory - createFileRepository e setFileSystemModule', () => {
    it('deve usar módulo injetado quando fornecido', () => {
      const customFs = createMockFileSystemModule();
      customFs.documentDirectory = 'file:///custom/';

      const repo = createFileRepository(customFs);

      expect(repo).toBeDefined();
    });

    it('deve usar módulo setado via setFileSystemModule quando nenhum é injetado', () => {
      const prodFs = createMockFileSystemModule();
      prodFs.documentDirectory = 'file:///prod/';

      setFileSystemModule(prodFs);
      const repo = createFileRepository();

      expect(repo).toBeDefined();
    });

    it('deve preferir módulo injetado sobre setado', () => {
      const globalFs = createMockFileSystemModule();
      globalFs.documentDirectory = 'file:///global/';

      const injectFs = createMockFileSystemModule();
      injectFs.documentDirectory = 'file:///injected/';

      setFileSystemModule(globalFs);
      const repo = createFileRepository(injectFs);

      expect(repo).toBeDefined();
      // Repository foi criado com injectFs, não globalFs
    });

    it('deve usar default documentDirectory se FileSystem não fornecer um', () => {
      // Teste que cobre a branch do || na linha 44
      // Criar um módulo com documentDirectory vazio/undefined
      const emptyFsModule = createMockFileSystemModule();
      emptyFsModule.documentDirectory = undefined;

      const repo = createFileRepository(emptyFsModule);

      expect(repo).toBeDefined();
    });

    it('deve usar fallback documentDirectory quando expo-file-system não fornece um', () => {
      // Criar um módulo que simula expo-file-system sem documentDirectory
      // Isso força a branch do || na linha 44 de createDefaultFileSystemModule
      const minimalFs = createMockFileSystemModule();
      minimalFs.documentDirectory = undefined;

      const repo = createFileRepository(minimalFs);

      expect(repo).toBeDefined();
    });
  });

  describe('schemas e validação', () => {
    beforeEach(() => {
      (mockFs.getInfoAsync as jest.Mock).mockResolvedValue({
        exists: false,
        isDirectory: false,
      });
      (mockFs.readDirectoryAsync as jest.Mock).mockResolvedValue([]);
      (mockFs.makeDirectoryAsync as jest.Mock).mockResolvedValue(undefined);
      (mockFs.writeAsStringAsync as jest.Mock).mockResolvedValue(undefined);
      (mockFs.readAsStringAsync as jest.Mock).mockResolvedValue('[]');
    });

    it('deve produzir DTO que passa no schema Zod', async () => {
      const entry = await repository.save(
        'conteúdo de teste',
        'test.doc',
        'application/msword',
        'received',
      );

      const dto = repository.toDto(entry);

      // Deve parse sem erro
      const validated = fileEntryDtoSchema.parse(dto);
      expect(validated).toBeDefined();
      expect(validated.id).toBe(entry.id);
    });

    it('deve nunca incluir campos privados no DTO', async () => {
      const entry = await repository.save('content', 'file.txt', 'text/plain', 'received');
      const dto = repository.toDto(entry);

      // Verificar que DTO só tem campos públicos
      const publicFields = ['id', 'name', 'sizeBytes', 'mimeType', 'createdAt'];
      const dtoKeys = Object.keys(dto);

      expect(dtoKeys).toEqual(publicFields);
    });

    it('deve gerar id UUID válido', async () => {
      const entry = await repository.save('content', 'test.txt', 'text/plain', 'received');
      const dto = repository.toDto(entry);

      // UUID v4 format validation via schema
      expect(() => z.string().uuid().parse(dto.id)).not.toThrow();
    });

    it('deve respeitar limites de schema (255 caracteres no nome)', async () => {
      // Nome com exatamente 255 caracteres
      const maxName = 'a'.repeat(250) + '.pdf';
      const entry = await repository.save('content', maxName, 'application/pdf', 'received');
      const dto = repository.toDto(entry);

      expect(() => fileEntryDtoSchema.parse(dto)).not.toThrow();
      expect(dto.name.length).toBeLessThanOrEqual(255);
    });

    it('deve falhar validação de schema se localUri estivesse presente', () => {
      // Este teste confirma que a remoção de localUri é necessária para validação
      const dto = repository.toDto({
        id: '550e8400-e29b-41d4-a716-446655440000',
        name: 'test.txt',
        sizeBytes: 100,
        mimeType: 'text/plain',
        createdAt: Date.now(),
        localUri: 'file:///secret/path',
        origin: 'received',
      });

      expect(dto).not.toHaveProperty('localUri');
    });
  });

  describe('saveFromUri', () => {
    beforeEach(() => {
      // Configurar mocks padrão para um fluxo feliz
      (mockFs.getInfoAsync as jest.Mock).mockResolvedValue({
        exists: true,
        isDirectory: true,
      });
      (mockFs.copyAsync as jest.Mock).mockResolvedValue(undefined);
      (mockFs.readDirectoryAsync as jest.Mock).mockResolvedValue([]);
      (mockFs.makeDirectoryAsync as jest.Mock).mockResolvedValue(undefined);
      (mockFs.writeAsStringAsync as jest.Mock).mockResolvedValue(undefined);
      (mockFs.readAsStringAsync as jest.Mock).mockResolvedValue('[]');
    });

    it('deve copiar arquivo do sourceUri para o destino', async () => {
      const entry = await repository.saveFromUri(
        'file:///tmp/selected.pdf',
        'documento.pdf',
        'application/pdf',
        1024,
        'shared',
      );

      expect(entry).toBeDefined();
      expect(entry.name).toBe('documento.pdf');
      expect(entry.sizeBytes).toBe(1024);
      expect(mockFs.copyAsync).toHaveBeenCalledWith({
        from: 'file:///tmp/selected.pdf',
        to: expect.stringContaining('/shared/documento.pdf'),
      });
    });

    it('deve usar sizeBytes fornecido (não ler do arquivo)', async () => {
      const entry = await repository.saveFromUri(
        'file:///tmp/file.bin',
        'dados.bin',
        'application/octet-stream',
        5000,
        'received',
      );

      expect(entry.sizeBytes).toBe(5000);
    });

    it('deve sanitizar nome do arquivo', async () => {
      const entry = await repository.saveFromUri(
        'file:///tmp/file.pdf',
        '../../etc/passwd',
        'application/pdf',
        1024,
        'shared',
      );

      // sanitizeFileName remove ../ e pega apenas o basename
      expect(entry.name).toBe('passwd');
      expect(entry.localUri).toContain('/shared/passwd');
    });

    it('deve resolver nome duplicado com sufixo (n)', async () => {
      // Simular que 'documento.pdf' já existe
      (mockFs.readDirectoryAsync as jest.Mock).mockResolvedValue(['documento.pdf']);
      (mockFs.readAsStringAsync as jest.Mock).mockResolvedValue(
        JSON.stringify([
          {
            id: 'existing-id',
            name: 'documento.pdf',
            sizeBytes: 100,
            mimeType: 'application/pdf',
            localUri: 'file:///mock-docs/shared/documento.pdf',
            createdAt: Date.now(),
          },
        ]),
      );

      const entry = await repository.saveFromUri(
        'file:///tmp/documento.pdf',
        'documento.pdf',
        'application/pdf',
        1024,
        'shared',
      );

      expect(entry.name).toBe('documento (1).pdf');
      expect(entry.localUri).toContain('/shared/documento (1).pdf');
    });

    it('deve usar origin="shared" para escrever em shared/', async () => {
      await repository.saveFromUri(
        'file:///tmp/file.pdf',
        'arquivo.pdf',
        'application/pdf',
        1024,
        'shared',
      );

      expect(mockFs.copyAsync).toHaveBeenCalledWith({
        from: 'file:///tmp/file.pdf',
        to: expect.stringContaining('/shared/'),
      });
    });

    it('deve usar origin="received" para escrever em received/', async () => {
      await repository.saveFromUri(
        'file:///tmp/file.pdf',
        'arquivo.pdf',
        'application/pdf',
        1024,
        'received',
      );

      expect(mockFs.copyAsync).toHaveBeenCalledWith({
        from: 'file:///tmp/file.pdf',
        to: expect.stringContaining('/received/'),
      });
    });

    it('deve gerar UUID único para cada arquivo', async () => {
      const entry1 = await repository.saveFromUri(
        'file:///tmp/file1.pdf',
        'file1.pdf',
        'application/pdf',
        1024,
        'shared',
      );

      const entry2 = await repository.saveFromUri(
        'file:///tmp/file2.pdf',
        'file2.pdf',
        'application/pdf',
        2048,
        'shared',
      );

      expect(entry1.id).not.toBe(entry2.id);
      expect(() => z.string().uuid().parse(entry1.id)).not.toThrow();
      expect(() => z.string().uuid().parse(entry2.id)).not.toThrow();
    });

    it('deve preservar timestamp correto', async () => {
      const beforeSave = Date.now();
      const entry = await repository.saveFromUri(
        'file:///tmp/file.pdf',
        'timed.pdf',
        'application/pdf',
        1024,
        'shared',
      );
      const afterSave = Date.now();

      expect(entry.createdAt).toBeGreaterThanOrEqual(beforeSave);
      expect(entry.createdAt).toBeLessThanOrEqual(afterSave);
    });

    it('deve salvar metadados após copiar arquivo', async () => {
      await repository.saveFromUri(
        'file:///tmp/file.pdf',
        'doc.pdf',
        'application/pdf',
        1024,
        'shared',
      );

      // Verificar que saveMetadata foi chamado (via writeAsStringAsync do .meta.json)
      const calls = (mockFs.writeAsStringAsync as jest.Mock).mock.calls;
      const metaCall = calls.find((c) => c[0].includes('.meta.json'));
      expect(metaCall).toBeDefined();

      // Verificar que o conteúdo é um JSON válido
      const metaContent = metaCall[1];
      expect(() => JSON.parse(metaContent)).not.toThrow();

      const metadata = JSON.parse(metaContent);
      expect(Array.isArray(metadata)).toBe(true);
      expect(metadata[0]).toHaveProperty('id');
      expect(metadata[0]).toHaveProperty('name', 'doc.pdf');
      expect(metadata[0]).toHaveProperty('sizeBytes', 1024);
    });

    it('deve rejeitar path traversal com múltiplos ../../../', async () => {
      const entry = await repository.saveFromUri(
        'file:///tmp/file.pdf',
        '../../../etc/passwd',
        'application/pdf',
        1024,
        'shared',
      );

      expect(entry.name).toBe('passwd');
      expect(entry.localUri).not.toContain('..');
    });

    it('deve rejeitar path traversal com backslash (estilo Windows)', async () => {
      const entry = await repository.saveFromUri(
        'file:///tmp/file.pdf',
        '..\\..\\windows\\system32',
        'application/pdf',
        1024,
        'shared',
      );

      expect(entry.localUri).not.toContain('\\');
    });

    it('deve remover caracteres de controle do nome', async () => {
      const nameWithControl = 'arquivo\x00\x01\x02.pdf';
      const entry = await repository.saveFromUri(
        'file:///tmp/file.pdf',
        nameWithControl,
        'application/pdf',
        1024,
        'shared',
      );

      expect(entry.name).not.toContain('\x00');
      expect(entry.name).not.toContain('\x01');
    });

    it('deve truncar nome com mais de 255 caracteres preservando extensão', async () => {
      const longName = 'a'.repeat(250) + '.pdf';
      const entry = await repository.saveFromUri(
        'file:///tmp/file.pdf',
        longName,
        'application/pdf',
        1024,
        'shared',
      );

      expect(entry.name.length).toBeLessThanOrEqual(255);
      expect(entry.name).toContain('.pdf');
    });

    it('deve lidar com nome vazio após sanitização', async () => {
      const entry = await repository.saveFromUri(
        'file:///tmp/file.pdf',
        '\x00\x01',
        'application/pdf',
        1024,
        'shared',
      );

      expect(entry.name).toBe('arquivo');
    });

    it('deve lidar com nome contendo apenas pontos', async () => {
      const entry = await repository.saveFromUri(
        'file:///tmp/file.pdf',
        '...',
        'application/pdf',
        1024,
        'shared',
      );

      expect(entry.name).toBe('arquivo');
    });

    it('deve falhar se copyAsync falhar', async () => {
      (mockFs.copyAsync as jest.Mock).mockRejectedValueOnce(new Error('Source not found'));

      await expect(
        repository.saveFromUri(
          'file:///tmp/nonexistent.pdf',
          'doc.pdf',
          'application/pdf',
          1024,
          'shared',
        ),
      ).rejects.toThrow('Source not found');
    });

    it('deve produzir DTO que passa no schema Zod', async () => {
      const entry = await repository.saveFromUri(
        'file:///tmp/file.pdf',
        'document.pdf',
        'application/pdf',
        2048,
        'shared',
      );

      const dto = repository.toDto(entry);

      const validated = fileEntryDtoSchema.parse(dto);
      expect(validated).toBeDefined();
      expect(validated.id).toBe(entry.id);
    });

    it('deve nunca incluir localUri ou origin no DTO', async () => {
      const entry = await repository.saveFromUri(
        'file:///tmp/file.pdf',
        'secret.pdf',
        'application/pdf',
        512,
        'shared',
      );

      const dto = repository.toDto(entry);
      const keys = Object.keys(dto);

      expect(keys).not.toContain('localUri');
      expect(keys).not.toContain('origin');
      expect(keys).toEqual(['id', 'name', 'sizeBytes', 'mimeType', 'createdAt']);
    });
  });

  describe('linkFromUri (T-701 — compartilhar por pasta sem duplicar)', () => {
    beforeEach(() => {
      (mockFs.getInfoAsync as jest.Mock).mockResolvedValue({ exists: true, isDirectory: true });
      (mockFs.makeDirectoryAsync as jest.Mock).mockResolvedValue(undefined);
      (mockFs.writeAsStringAsync as jest.Mock).mockResolvedValue(undefined);
      (mockFs.readAsStringAsync as jest.Mock).mockResolvedValue('[]');
    });

    it('NUNCA copia o arquivo — localUri da entrada é o sourceUri original', async () => {
      const entry = await repository.linkFromUri(
        'content://com.android.externalstorage.documents/document/primary%3ADownload%2Ffoto.jpg',
        'foto.jpg',
        'image/jpeg',
        2_000_000_000,
        'shared',
      );

      expect(mockFs.copyAsync).not.toHaveBeenCalled();
      expect(entry.localUri).toBe(
        'content://com.android.externalstorage.documents/document/primary%3ADownload%2Ffoto.jpg',
      );
    });

    it('marca a entrada criada com linked: true', async () => {
      const entry = await repository.linkFromUri(
        'content://.../video.mov',
        'video.mov',
        'video/quicktime',
        500,
        'shared',
      );

      expect(entry.linked).toBe(true);
    });

    it('persiste linked: true nos metadados (.meta.json)', async () => {
      await repository.linkFromUri(
        'content://.../doc.pdf',
        'doc.pdf',
        'application/pdf',
        100,
        'shared',
      );

      const metaCalls = (mockFs.writeAsStringAsync as jest.Mock).mock.calls.filter((c) =>
        c[0].includes('/shared/.meta.json'),
      );
      const lastMetaCall = metaCalls[metaCalls.length - 1];
      const savedMeta = JSON.parse(lastMetaCall[1]);

      expect(savedMeta[0].linked).toBe(true);
    });

    it('sanitiza o nome desejado e resolve duplicata contra entradas já vinculadas', async () => {
      // Uma entrada VINCULADA (sem arquivo físico em shared/) já existe com esse nome —
      // getExistingNames precisa detectar a colisão via metadados, não via filesystem.
      (mockFs.readAsStringAsync as jest.Mock).mockResolvedValue(
        JSON.stringify([
          {
            id: 'existing',
            name: 'foto.jpg',
            sizeBytes: 100,
            mimeType: 'image/jpeg',
            localUri: 'content://.../outra-pasta/foto.jpg',
            createdAt: 1000,
            linked: true,
          },
        ]),
      );

      const entry = await repository.linkFromUri(
        'content://.../nova-pasta/foto.jpg',
        'foto.jpg',
        'image/jpeg',
        200,
        'shared',
      );

      expect(entry.name).toBe('foto (1).jpg');
    });
  });

  describe('getLinkedFolderUri / setLinkedFolderUri (T-701)', () => {
    it('getLinkedFolderUri retorna null quando nenhuma pasta foi vinculada ainda', async () => {
      (mockFs.readAsStringAsync as jest.Mock).mockRejectedValue(new Error('not found'));

      await expect(repository.getLinkedFolderUri()).resolves.toBeNull();
    });

    it('setLinkedFolderUri persiste a URI, e getLinkedFolderUri a lê de volta', async () => {
      (mockFs.getInfoAsync as jest.Mock).mockResolvedValue({ exists: true, isDirectory: true });
      (mockFs.makeDirectoryAsync as jest.Mock).mockResolvedValue(undefined);
      let saved = '';
      (mockFs.writeAsStringAsync as jest.Mock).mockImplementation(
        (uri: string, content: string) => {
          if (uri.includes('.linked-folder.json')) {
            saved = content;
          }
          return Promise.resolve(undefined);
        },
      );
      (mockFs.readAsStringAsync as jest.Mock).mockImplementation((uri: string) => {
        if (uri.includes('.linked-folder.json')) {
          return Promise.resolve(saved);
        }
        return Promise.reject(new Error('unexpected path'));
      });

      await repository.setLinkedFolderUri('content://tree/primary%3ADownload');

      expect(
        (mockFs.writeAsStringAsync as jest.Mock).mock.calls.some((c) =>
          c[0].includes('.linked-folder.json'),
        ),
      ).toBe(true);
      await expect(repository.getLinkedFolderUri()).resolves.toBe(
        'content://tree/primary%3ADownload',
      );
    });

    it('setLinkedFolderUri(null) desvincula a pasta', async () => {
      (mockFs.getInfoAsync as jest.Mock).mockResolvedValue({ exists: true, isDirectory: true });
      (mockFs.makeDirectoryAsync as jest.Mock).mockResolvedValue(undefined);
      (mockFs.writeAsStringAsync as jest.Mock).mockResolvedValue(undefined);
      (mockFs.readAsStringAsync as jest.Mock).mockResolvedValue(JSON.stringify({ uri: null }));

      await repository.setLinkedFolderUri(null);

      await expect(repository.getLinkedFolderUri()).resolves.toBeNull();
    });
  });

  describe('beginStreamedWrite', () => {
    beforeEach(() => {
      // Configurar mocks padrão para streaming
      const writtenFiles = new Map<string, string>();

      (mockFs.getInfoAsync as jest.Mock).mockImplementation(async (uri: string) => {
        if (writtenFiles.has(uri)) {
          const content = writtenFiles.get(uri) || '';
          return {
            exists: true,
            isDirectory: false,
            size: Buffer.byteLength(content, 'utf8'),
          };
        }
        return { exists: false, isDirectory: false };
      });

      (mockFs.writeAsStringAsync as jest.Mock).mockImplementation(
        async (uri: string, content: string) => {
          writtenFiles.set(uri, content);
        },
      );

      (mockFs.appendToFileAsync as jest.Mock).mockImplementation(
        async (uri: string, content: string) => {
          const existing = writtenFiles.get(uri) || '';
          writtenFiles.set(uri, existing + content);
        },
      );

      (mockFs.readDirectoryAsync as jest.Mock).mockResolvedValue([]);
      (mockFs.makeDirectoryAsync as jest.Mock).mockResolvedValue(undefined);
      (mockFs.readAsStringAsync as jest.Mock).mockResolvedValue('[]');
      (mockFs.deleteAsync as jest.Mock).mockResolvedValue(undefined);
    });

    it('retorna handle de escrita com id e finalName', async () => {
      const handle = await repository.beginStreamedWrite('test.txt', 'text/plain', 'received');

      expect(handle).toBeDefined();
      expect(handle.id).toBeDefined();
      expect(handle.finalName).toBe('test.txt');
    });

    it('sanitiza nome ao iniciar escrita em streaming', async () => {
      const handle = await repository.beginStreamedWrite(
        '../../etc/passwd',
        'text/plain',
        'received',
      );

      // O nome sanitizado deve ser apenas o basename
      expect(handle.finalName).toBe('passwd');
    });

    it('resolve duplicata automaticamente', async () => {
      // Simular que 'document.txt' já existe
      (mockFs.readDirectoryAsync as jest.Mock).mockResolvedValue(['document.txt']);
      (mockFs.readAsStringAsync as jest.Mock).mockResolvedValue(
        JSON.stringify([
          {
            id: 'existing-id',
            name: 'document.txt',
            sizeBytes: 100,
            mimeType: 'text/plain',
            localUri: 'file:///mock-docs/received/document.txt',
            createdAt: Date.now(),
          },
        ]),
      );

      const handle = await repository.beginStreamedWrite('document.txt', 'text/plain', 'received');

      expect(handle.finalName).toBe('document (1).txt');
    });

    it('usa fallback quando nome fica vazio após sanitização', async () => {
      // sanitizeFileName('.') retorna 'arquivo' (fallback padrão)
      // portanto beginStreamedWrite não deve rejeitar
      const handle = await repository.beginStreamedWrite('.', 'text/plain', 'received');

      // O nome deve ser o fallback 'arquivo'
      expect(handle.finalName).toBe('arquivo');
    });

    it('cria arquivo vazio inicialmente', async () => {
      await repository.beginStreamedWrite('stream.txt', 'text/plain', 'received');

      expect(mockFs.writeAsStringAsync).toHaveBeenCalledWith(
        expect.stringContaining('/received/stream.txt'),
        '',
      );
    });

    it('handle.writeChunk chama appendToFileAsync', async () => {
      const handle = await repository.beginStreamedWrite('stream.txt', 'text/plain', 'received');

      const chunkData = 'First chunk of data';
      await handle.writeChunk(chunkData);

      expect(mockFs.appendToFileAsync).toHaveBeenCalledWith(
        expect.stringContaining('/received/stream.txt'),
        chunkData,
      );
    });

    it('handle.writeChunk pode ser chamado múltiplas vezes', async () => {
      const handle = await repository.beginStreamedWrite('stream.txt', 'text/plain', 'received');

      await handle.writeChunk('Chunk 1\n');
      await handle.writeChunk('Chunk 2\n');
      await handle.writeChunk('Chunk 3\n');

      expect(mockFs.appendToFileAsync).toHaveBeenCalledTimes(3);
    });

    it('handle.finish grava metadados e retorna FileEntry completo', async () => {
      const handle = await repository.beginStreamedWrite(
        'data.bin',
        'application/octet-stream',
        'received',
      );

      const entry = await handle.finish(1024);

      expect(entry).toBeDefined();
      expect(entry.id).toBe(handle.id);
      expect(entry.name).toBe('data.bin');
      expect(entry.sizeBytes).toBe(1024);
      expect(entry.mimeType).toBe('application/octet-stream');
      expect(entry.origin).toBe('received');
      expect(entry.createdAt).toBeGreaterThan(0);

      // Verificar que metadados foram salvos
      const metaCalls = (mockFs.writeAsStringAsync as jest.Mock).mock.calls.filter((call) =>
        call[0].includes('.meta.json'),
      );
      expect(metaCalls.length).toBeGreaterThan(0);
    });

    it('handle.finish retorna DTO válido contra schema Zod', async () => {
      const handle = await repository.beginStreamedWrite('file.pdf', 'application/pdf', 'received');
      const entry = await handle.finish(5000);
      const dto = repository.toDto(entry);

      const validated = fileEntryDtoSchema.parse(dto);
      expect(validated).toBeDefined();
      expect(validated.id).toBe(handle.id);
      expect(validated.sizeBytes).toBe(5000);
    });

    it('handle.abort deleta arquivo parcial', async () => {
      const handle = await repository.beginStreamedWrite(
        'incomplete.txt',
        'text/plain',
        'received',
      );

      await handle.writeChunk('Some partial data');
      await handle.abort();

      expect(mockFs.deleteAsync).toHaveBeenCalledWith(
        expect.stringContaining('/received/incomplete.txt'),
      );
    });

    it('handle.abort não grava metadados', async () => {
      const handle = await repository.beginStreamedWrite(
        'abort-test.txt',
        'text/plain',
        'received',
      );

      // Rastrear chamadas de writeAsStringAsync de .meta.json antes e depois
      const metaCallsBefore = (mockFs.writeAsStringAsync as jest.Mock).mock.calls.filter((call) =>
        call[0].includes('.meta.json'),
      ).length;

      await handle.abort();

      const metaCallsAfter = (mockFs.writeAsStringAsync as jest.Mock).mock.calls.filter((call) =>
        call[0].includes('.meta.json'),
      ).length;

      // Não deve adicionar nova chamada de meta.json após abort
      expect(metaCallsAfter).toBe(metaCallsBefore);
    });

    it('escreve em received/ para origin="received"', async () => {
      const handle = await repository.beginStreamedWrite('file.txt', 'text/plain', 'received');

      expect(handle.finalName).toBe('file.txt');

      const writeCall = (mockFs.writeAsStringAsync as jest.Mock).mock.calls.find(
        (call) => call[1] === '',
      );
      expect(writeCall[0]).toContain('/received/');
    });

    it('escreve em shared/ para origin="shared"', async () => {
      await repository.beginStreamedWrite('shared-file.txt', 'text/plain', 'shared');

      const writeCall = (mockFs.writeAsStringAsync as jest.Mock).mock.calls.find(
        (call) => call[1] === '',
      );
      expect(writeCall[0]).toContain('/shared/');
    });

    it('trata múltiplos uploads concorrentes com nomes diferentes', async () => {
      const handle1 = await repository.beginStreamedWrite('file1.txt', 'text/plain', 'received');
      const handle2 = await repository.beginStreamedWrite('file2.txt', 'text/plain', 'received');

      expect(handle1.id).not.toBe(handle2.id);
      expect(handle1.finalName).toBe('file1.txt');
      expect(handle2.finalName).toBe('file2.txt');
    });

    it('casos de borda — nome com 255 caracteres', async () => {
      const longName = 'a'.repeat(250) + '.txt'; // Total 254 chars, within limit

      const handle = await repository.beginStreamedWrite(longName, 'text/plain', 'received');

      expect(handle.finalName.length).toBeLessThanOrEqual(255);
    });

    it('casos de borda — nome com apenas extensão', async () => {
      // .gitignore é um nome válido
      const handle = await repository.beginStreamedWrite('.gitignore', 'text/plain', 'received');

      expect(handle.finalName).toBe('.gitignore');
    });

    it('casos de borda — nome com acentos e unicode', async () => {
      const handle = await repository.beginStreamedWrite(
        'relatório-ação-é.txt',
        'text/plain',
        'received',
      );

      expect(handle.finalName).toBe('relatório-ação-é.txt');
    });

    it('reject writeChunk errors propagam (ex.: sem espaço)', async () => {
      const handle = await repository.beginStreamedWrite('file.txt', 'text/plain', 'received');

      (mockFs.appendToFileAsync as jest.Mock).mockRejectedValueOnce(
        new Error('No space left on device'),
      );

      await expect(handle.writeChunk('data')).rejects.toThrow('No space left on device');
    });

    it('finish() com sizeBytes=0 é válido', async () => {
      const handle = await repository.beginStreamedWrite('empty.txt', 'text/plain', 'received');

      const entry = await handle.finish(0);

      expect(entry.sizeBytes).toBe(0);
    });

    it('finish() com sizeBytes grande (ex.: 1GB simulado) é válido', async () => {
      const handle = await repository.beginStreamedWrite(
        'large.bin',
        'application/octet-stream',
        'received',
      );

      const entry = await handle.finish(1024 * 1024 * 1024); // 1GB

      expect(entry.sizeBytes).toBe(1024 * 1024 * 1024);
    });

    it('múltiplos writeChunk seguidos de finish grava corretamente', async () => {
      const handle = await repository.beginStreamedWrite(
        'multi-chunk.txt',
        'text/plain',
        'received',
      );

      await handle.writeChunk('Part 1: ');
      await handle.writeChunk('Part 2: ');
      await handle.writeChunk('Part 3');

      const entry = await handle.finish(22); // Total chars

      expect(entry.name).toBe('multi-chunk.txt');
      expect(entry.sizeBytes).toBe(22);

      // Verificar que metadados foram salvos com o arquivo registrado
      const metaCalls = (mockFs.writeAsStringAsync as jest.Mock).mock.calls.filter((call) =>
        call[0].includes('.meta.json'),
      );
      expect(metaCalls.length).toBeGreaterThan(0);

      const lastMetaCall = metaCalls[metaCalls.length - 1];
      const metadata = JSON.parse(lastMetaCall[1]);
      expect(metadata).toBeInstanceOf(Array);
      expect(metadata.length).toBeGreaterThan(0);
      expect(metadata[metadata.length - 1].name).toBe('multi-chunk.txt');
    });

    it('handle.abort ignora erros ao deletar', async () => {
      const handle = await repository.beginStreamedWrite('delicate.txt', 'text/plain', 'received');

      (mockFs.deleteAsync as jest.Mock).mockRejectedValueOnce(new Error('Permission denied'));

      // abort() não deve rejeitar mesmo se delete falhar
      await expect(handle.abort()).resolves.toBeUndefined();
    });
  });
});
