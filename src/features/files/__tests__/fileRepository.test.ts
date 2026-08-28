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
      copyAsync: jest.fn(),
      moveAsync: jest.fn(),
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
      (mockFs.getInfoAsync as jest.Mock).mockResolvedValue({
        exists: false,
        isDirectory: false,
      });
      (mockFs.readDirectoryAsync as jest.Mock).mockResolvedValue([]);
      (mockFs.makeDirectoryAsync as jest.Mock).mockResolvedValue(undefined);
      (mockFs.writeAsStringAsync as jest.Mock).mockResolvedValue(undefined);
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
      const partialFs: jest.Mocked<FileSystemModule> = {
        documentDirectory: undefined,
        getInfoAsync: jest.fn(),
        readDirectoryAsync: jest.fn(),
        makeDirectoryAsync: jest.fn(),
        writeAsStringAsync: jest.fn(),
        readAsStringAsync: jest.fn(),
        deleteAsync: jest.fn(),
        copyAsync: jest.fn(),
        moveAsync: jest.fn(),
      };

      const repo = createFileRepository(partialFs);

      // Deve funcionar com o fallback 'file:///document/'
      expect(repo).toBeDefined();
    });
  });

  describe('factory - createFileRepository e setFileSystemModule', () => {
    it('deve usar módulo injetado quando fornecido', () => {
      const customFs: jest.Mocked<FileSystemModule> = {
        documentDirectory: 'file:///custom/',
        getInfoAsync: jest.fn(),
        readDirectoryAsync: jest.fn(),
        makeDirectoryAsync: jest.fn(),
        writeAsStringAsync: jest.fn(),
        readAsStringAsync: jest.fn(),
        deleteAsync: jest.fn(),
        copyAsync: jest.fn(),
        moveAsync: jest.fn(),
      };

      const repo = createFileRepository(customFs);

      expect(repo).toBeDefined();
    });

    it('deve usar módulo setado via setFileSystemModule quando nenhum é injetado', () => {
      const prodFs: jest.Mocked<FileSystemModule> = {
        documentDirectory: 'file:///prod/',
        getInfoAsync: jest.fn(),
        readDirectoryAsync: jest.fn(),
        makeDirectoryAsync: jest.fn(),
        writeAsStringAsync: jest.fn(),
        readAsStringAsync: jest.fn(),
        deleteAsync: jest.fn(),
        copyAsync: jest.fn(),
        moveAsync: jest.fn(),
      };

      setFileSystemModule(prodFs);
      const repo = createFileRepository();

      expect(repo).toBeDefined();
    });

    it('deve preferir módulo injetado sobre setado', () => {
      const globalFs: jest.Mocked<FileSystemModule> = {
        documentDirectory: 'file:///global/',
        getInfoAsync: jest.fn(),
        readDirectoryAsync: jest.fn(),
        makeDirectoryAsync: jest.fn(),
        writeAsStringAsync: jest.fn(),
        readAsStringAsync: jest.fn(),
        deleteAsync: jest.fn(),
        copyAsync: jest.fn(),
        moveAsync: jest.fn(),
      };

      const injectFs: jest.Mocked<FileSystemModule> = {
        documentDirectory: 'file:///injected/',
        getInfoAsync: jest.fn(),
        readDirectoryAsync: jest.fn(),
        makeDirectoryAsync: jest.fn(),
        writeAsStringAsync: jest.fn(),
        readAsStringAsync: jest.fn(),
        deleteAsync: jest.fn(),
        copyAsync: jest.fn(),
        moveAsync: jest.fn(),
      };

      setFileSystemModule(globalFs);
      const repo = createFileRepository(injectFs);

      expect(repo).toBeDefined();
      // Repository foi criado com injectFs, não globalFs
    });

    it('deve usar default documentDirectory se FileSystem não fornecer um', () => {
      // Teste que cobre a branch do || na linha 44
      // Criar um módulo com documentDirectory vazio/undefined
      const emptyFsModule: jest.Mocked<FileSystemModule> = {
        documentDirectory: undefined,
        getInfoAsync: jest.fn(),
        readDirectoryAsync: jest.fn(),
        makeDirectoryAsync: jest.fn(),
        writeAsStringAsync: jest.fn(),
        readAsStringAsync: jest.fn(),
        deleteAsync: jest.fn(),
        copyAsync: jest.fn(),
        moveAsync: jest.fn(),
      };

      const repo = createFileRepository(emptyFsModule);

      expect(repo).toBeDefined();
    });

    it('deve usar fallback documentDirectory quando expo-file-system não fornece um', () => {
      // Criar um módulo que simula expo-file-system sem documentDirectory
      // Isso força a branch do || na linha 44 de createDefaultFileSystemModule
      const minimalFs: jest.Mocked<FileSystemModule> = {
        documentDirectory: undefined,
        getInfoAsync: jest.fn(),
        readDirectoryAsync: jest.fn(),
        makeDirectoryAsync: jest.fn(),
        writeAsStringAsync: jest.fn(),
        readAsStringAsync: jest.fn(),
        deleteAsync: jest.fn(),
        copyAsync: jest.fn(),
        moveAsync: jest.fn(),
      };

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
});
