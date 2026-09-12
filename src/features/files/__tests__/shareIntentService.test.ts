/**
 * Testes para shareIntentService.ts (T-903).
 *
 * Testa:
 * - Processamento de share intent com sucesso (URIs válidas)
 * - Isolamento de erro: URI inválida não derruba o resto
 * - Limpeza do Intent nativo
 * - Factory function com módulo nativo real/mock
 */

import { NativeModules } from 'react-native';
import { ShareIntentService, type ShareIntentPayloadModule, createShareIntentService } from '../services/shareIntentService';
import type { FileRepository } from '../services/fileRepository';
import type { FileEntry } from '../types';

describe('ShareIntentService', () => {
  // Mocks do módulo nativo e repositório
  let mockNativeModule: jest.Mocked<ShareIntentPayloadModule>;
  let mockFileRepository: jest.Mocked<FileRepository>;
  interface MockFileSystemModule {
    getInfoAsync: jest.Mock;
  }
  let mockFsModule: MockFileSystemModule;
  let service: ShareIntentService;

  beforeEach(() => {
    // Mock do módulo nativo
    mockNativeModule = {
      getShareIntentPayload: jest.fn(),
      clearShareIntent: jest.fn(),
    };

    // Mock do módulo filesystem
    mockFsModule = {
      getInfoAsync: jest.fn().mockResolvedValue({ size: 0, name: undefined }),
    };

    // Mock do repositório — linkFromUri e fsModule
    mockFileRepository = {
      linkFromUri: jest.fn(),
      fsModule: mockFsModule,
    } as unknown as jest.Mocked<FileRepository>;

    service = new ShareIntentService(mockNativeModule, mockFileRepository);
  });

  describe('processShareIntent()', () => {
    it('retorna resultado vazio quando nenhum arquivo é compartilhado', async () => {
      mockNativeModule.getShareIntentPayload.mockResolvedValue([]);
      mockNativeModule.clearShareIntent.mockResolvedValue(undefined);

      const result = await service.processShareIntent();

      expect(result.files).toEqual([]);
      expect(result.errors).toEqual([]);
      expect(result.hasSuccessfulItems).toBe(false);
      expect(mockNativeModule.clearShareIntent).toHaveBeenCalled();
    });

    it('processa um único arquivo compartilhado com sucesso (ACTION_SEND)', async () => {
      const uri = 'content://com.example.provider/document/photo.jpg';
      const mockFileEntry: FileEntry = {
        id: 'file-1',
        name: 'photo.jpg',
        sizeBytes: 1024000,
        mimeType: 'image/jpeg',
        localUri: uri,
        origin: 'shared',
        createdAt: Date.now(),
        linked: true,
      };

      mockNativeModule.getShareIntentPayload.mockResolvedValue([uri]);
      mockFsModule.getInfoAsync.mockResolvedValue({ size: 1024000, name: 'photo.jpg' });
      mockFileRepository.linkFromUri.mockResolvedValue(mockFileEntry);
      mockNativeModule.clearShareIntent.mockResolvedValue(undefined);

      const result = await service.processShareIntent();

      expect(result.files).toHaveLength(1);
      expect(result.files[0]).toEqual(mockFileEntry);
      expect(result.errors).toEqual([]);
      expect(result.hasSuccessfulItems).toBe(true);
      expect(mockFileRepository.linkFromUri).toHaveBeenCalledWith(
        uri,
        'photo.jpg',
        'image/jpeg',
        1024000,
        'shared',
      );
    });

    it('processa múltiplos arquivos compartilhados com sucesso (ACTION_SEND_MULTIPLE)', async () => {
      const uris = [
        'content://provider/photo1.jpg',
        'content://provider/photo2.jpg',
        'file:///data/local/tmp/document.pdf',
      ];

      const mockEntries: FileEntry[] = [
        {
          id: 'file-1',
          name: 'photo1.jpg',
          sizeBytes: 500000,
          mimeType: 'image/jpeg',
          localUri: uris[0],
          origin: 'shared',
          createdAt: Date.now(),
          linked: true,
        },
        {
          id: 'file-2',
          name: 'photo2.jpg',
          sizeBytes: 600000,
          mimeType: 'image/jpeg',
          localUri: uris[1],
          origin: 'shared',
          createdAt: Date.now(),
          linked: true,
        },
        {
          id: 'file-3',
          name: 'document.pdf',
          sizeBytes: 2000000,
          mimeType: 'application/pdf',
          localUri: uris[2],
          origin: 'shared',
          createdAt: Date.now(),
          linked: true,
        },
      ];

      mockNativeModule.getShareIntentPayload.mockResolvedValue(uris);
      mockFsModule.getInfoAsync
        .mockResolvedValueOnce({ size: 500000, name: 'photo1.jpg' })
        .mockResolvedValueOnce({ size: 600000, name: 'photo2.jpg' })
        .mockResolvedValueOnce({ size: 2000000, name: 'document.pdf' });
      mockFileRepository.linkFromUri
        .mockResolvedValueOnce(mockEntries[0])
        .mockResolvedValueOnce(mockEntries[1])
        .mockResolvedValueOnce(mockEntries[2]);
      mockNativeModule.clearShareIntent.mockResolvedValue(undefined);

      const result = await service.processShareIntent();

      expect(result.files).toHaveLength(3);
      expect(result.files).toEqual(mockEntries);
      expect(result.errors).toEqual([]);
      expect(result.hasSuccessfulItems).toBe(true);
    });

    it('isola erro por item: uma URI inválida não derruba o processamento das demais', async () => {
      const validUri = 'content://provider/photo.jpg';
      const invalidUri = 'invalid-uri-without-scheme';
      const anotherValidUri = 'file:///data/document.pdf';

      const mockEntry1: FileEntry = {
        id: 'file-1',
        name: 'photo.jpg',
        sizeBytes: 500000,
        mimeType: 'image/jpeg',
        localUri: validUri,
        origin: 'shared',
        createdAt: Date.now(),
        linked: true,
      };

      const mockEntry3: FileEntry = {
        id: 'file-3',
        name: 'document.pdf',
        sizeBytes: 2000000,
        mimeType: 'application/pdf',
        localUri: anotherValidUri,
        origin: 'shared',
        createdAt: Date.now(),
        linked: true,
      };

      mockNativeModule.getShareIntentPayload.mockResolvedValue([
        validUri,
        invalidUri,
        anotherValidUri,
      ]);

      mockFileRepository.linkFromUri
        .mockResolvedValueOnce(mockEntry1)
        .mockRejectedValueOnce(new Error('URI inválida ou inacessível'))
        .mockResolvedValueOnce(mockEntry3);

      mockNativeModule.clearShareIntent.mockResolvedValue(undefined);

      const result = await service.processShareIntent();

      expect(result.files).toHaveLength(2);
      expect(result.files[0]).toEqual(mockEntry1);
      expect(result.files[1]).toEqual(mockEntry3);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].uri).toBe(invalidUri);
      expect(result.errors[0].success).toBe(false);
      expect(result.errors[0].errorMessage).toBe('URI inválida ou inacessível');
      expect(result.hasSuccessfulItems).toBe(true);
    });

    it('retorna resultado com sucessos + erros quando há mix de ambos', async () => {
      const uris = ['valid-1', 'invalid', 'valid-2'];

      const mockEntry1: FileEntry = {
        id: 'file-1',
        name: 'file1.txt',
        sizeBytes: 100,
        mimeType: 'text/plain',
        localUri: 'valid-1',
        origin: 'shared',
        createdAt: Date.now(),
        linked: true,
      };

      const mockEntry3: FileEntry = {
        id: 'file-3',
        name: 'file3.txt',
        sizeBytes: 300,
        mimeType: 'text/plain',
        localUri: 'valid-2',
        origin: 'shared',
        createdAt: Date.now(),
        linked: true,
      };

      mockNativeModule.getShareIntentPayload.mockResolvedValue(uris);
      mockFileRepository.linkFromUri
        .mockResolvedValueOnce(mockEntry1)
        .mockRejectedValueOnce(new Error('Erro ao acessar arquivo'))
        .mockResolvedValueOnce(mockEntry3);

      const result = await service.processShareIntent();

      expect(result.files).toHaveLength(2);
      expect(result.errors).toHaveLength(1);
      expect(result.hasSuccessfulItems).toBe(true);
    });

    it('retorna resultado vazio se todos os arquivos falharem', async () => {
      const uris = ['invalid-1', 'invalid-2'];

      mockNativeModule.getShareIntentPayload.mockResolvedValue(uris);
      mockFileRepository.linkFromUri
        .mockRejectedValueOnce(new Error('Erro 1'))
        .mockRejectedValueOnce(new Error('Erro 2'));

      const result = await service.processShareIntent();

      expect(result.files).toHaveLength(0);
      expect(result.errors).toHaveLength(2);
      expect(result.hasSuccessfulItems).toBe(false);
    });

    it('limpa o Intent nativo após processar', async () => {
      mockNativeModule.getShareIntentPayload.mockResolvedValue([]);
      mockNativeModule.clearShareIntent.mockResolvedValue(undefined);

      await service.processShareIntent();

      expect(mockNativeModule.clearShareIntent).toHaveBeenCalledTimes(1);
    });

    it('limpeza do Intent falhando não invalida o resultado', async () => {
      const uri = 'content://provider/file.txt';
      const mockEntry: FileEntry = {
        id: 'file-1',
        name: 'file.txt',
        sizeBytes: 100,
        mimeType: 'text/plain',
        localUri: uri,
        origin: 'shared',
        createdAt: Date.now(),
        linked: true,
      };

      mockNativeModule.getShareIntentPayload.mockResolvedValue([uri]);
      mockFileRepository.linkFromUri.mockResolvedValue(mockEntry);
      mockNativeModule.clearShareIntent.mockRejectedValue(
        new Error('Falha ao limpar Intent'),
      );

      const result = await service.processShareIntent();

      // Resultado é sucesso mesmo com erro na limpeza
      expect(result.files).toHaveLength(1);
      expect(result.errors).toHaveLength(0);
      expect(result.hasSuccessfulItems).toBe(true);
    });

    it('determina MIME type correto pelo nome do arquivo', async () => {
      const uris = [
        'content://provider/photo.jpg',
        'content://provider/document.pdf',
        'content://provider/unknown.xyz',
      ];

      const mockEntries: FileEntry[] = [
        {
          id: 'file-1',
          name: 'photo.jpg',
          sizeBytes: 500000,
          mimeType: 'image/jpeg',
          localUri: uris[0],
          origin: 'shared',
          createdAt: Date.now(),
          linked: true,
        },
        {
          id: 'file-2',
          name: 'document.pdf',
          sizeBytes: 2000000,
          mimeType: 'application/pdf',
          localUri: uris[1],
          origin: 'shared',
          createdAt: Date.now(),
          linked: true,
        },
        {
          id: 'file-3',
          name: 'unknown.xyz',
          sizeBytes: 1000,
          mimeType: 'application/octet-stream',
          localUri: uris[2],
          origin: 'shared',
          createdAt: Date.now(),
          linked: true,
        },
      ];

      mockNativeModule.getShareIntentPayload.mockResolvedValue(uris);
      mockFsModule.getInfoAsync
        .mockResolvedValueOnce({ size: 500000, name: 'photo.jpg' })
        .mockResolvedValueOnce({ size: 2000000, name: 'document.pdf' })
        .mockResolvedValueOnce({ size: 1000, name: 'unknown.xyz' });
      mockFileRepository.linkFromUri
        .mockResolvedValueOnce(mockEntries[0])
        .mockResolvedValueOnce(mockEntries[1])
        .mockResolvedValueOnce(mockEntries[2]);

      await service.processShareIntent();

      // Verifica que linkFromUri foi chamado com MIME types corretos
      expect(mockFileRepository.linkFromUri).toHaveBeenNthCalledWith(
        1,
        uris[0],
        'photo.jpg',
        'image/jpeg', // Correto para .jpg
        500000,
        'shared',
      );

      expect(mockFileRepository.linkFromUri).toHaveBeenNthCalledWith(
        2,
        uris[1],
        'document.pdf',
        'application/pdf', // Correto para .pdf
        2000000,
        'shared',
      );

      expect(mockFileRepository.linkFromUri).toHaveBeenNthCalledWith(
        3,
        uris[2],
        'unknown.xyz',
        'application/octet-stream', // Fallback para extensão desconhecida
        1000,
        'shared',
      );
    });

    it('extrai nome correto de file:// URIs', async () => {
      const uri = 'file:///data/local/tmp/photo.jpg';
      const mockEntry: FileEntry = {
        id: 'file-1',
        name: 'photo.jpg',
        sizeBytes: 500000,
        mimeType: 'image/jpeg',
        localUri: uri,
        origin: 'shared',
        createdAt: Date.now(),
        linked: true,
      };

      mockNativeModule.getShareIntentPayload.mockResolvedValue([uri]);
      mockFileRepository.linkFromUri.mockResolvedValue(mockEntry);

      await service.processShareIntent();

      // Verifica que o nome foi extraído corretamente de file://
      expect(mockFileRepository.linkFromUri).toHaveBeenCalledWith(
        uri,
        'photo.jpg', // Extraído de /data/local/tmp/photo.jpg
        'image/jpeg',
        expect.any(Number),
        'shared',
      );
    });

    it('usa fallback ao extrair nome de content:// URIs', async () => {
      const uri = 'content://com.example.provider/document/123456';
      const mockEntry: FileEntry = {
        id: 'file-1',
        name: 'shared_file',
        sizeBytes: 100000,
        mimeType: 'application/octet-stream',
        localUri: uri,
        origin: 'shared',
        createdAt: Date.now(),
        linked: true,
      };

      mockNativeModule.getShareIntentPayload.mockResolvedValue([uri]);
      mockFileRepository.linkFromUri.mockResolvedValue(mockEntry);

      await service.processShareIntent();

      // content:// URIs não têm nome legível, usa fallback
      expect(mockFileRepository.linkFromUri).toHaveBeenCalledWith(
        uri,
        'shared_file', // Fallback
        'application/octet-stream',
        expect.any(Number),
        'shared',
      );
    });
  });

  describe('Erro ao chamar módulo nativo', () => {
    it('retorna resultado vazio se getShareIntentPayload lançar exceção', async () => {
      mockNativeModule.getShareIntentPayload.mockRejectedValue(
        new Error('Módulo nativo não disponível'),
      );

      const result = await service.processShareIntent();

      expect(result.files).toEqual([]);
      expect(result.errors).toEqual([]);
      expect(result.hasSuccessfulItems).toBe(false);
    });
  });

  describe('Cenários adicionais de cobertura', () => {
    it('falha ao processar URI quando getInfoAsync lança exceção', async () => {
      const uri = 'content://provider/file.txt';

      mockNativeModule.getShareIntentPayload.mockResolvedValue([uri]);
      // getInfoAsync lança erro — deve usar fallback (size: 0)
      mockFsModule.getInfoAsync.mockRejectedValue(new Error('Acesso negado'));
      mockFileRepository.linkFromUri.mockResolvedValue({
        id: 'file-1',
        name: 'file.txt',
        sizeBytes: 0, // Fallback quando getInfoAsync falha
        mimeType: 'text/plain',
        localUri: uri,
        origin: 'shared',
        createdAt: Date.now(),
        linked: true,
      });

      const result = await service.processShareIntent();

      // Processamento continua apesar do erro em getInfoAsync
      expect(result.files).toHaveLength(1);
      expect(result.files[0].sizeBytes).toBe(0); // Fallback de size
      expect(result.errors).toHaveLength(0);
    });

    it('processa compartilhamento com componente URI sem extensão', async () => {
      const uri = 'content://provider/1234'; // Sem extensão — usa fallback de nome

      const mockEntry: FileEntry = {
        id: 'file-1',
        name: 'shared_file',
        sizeBytes: 0,
        mimeType: 'application/octet-stream',
        localUri: uri,
        origin: 'shared',
        createdAt: Date.now(),
        linked: true,
      };

      mockNativeModule.getShareIntentPayload.mockResolvedValue([uri]);
      mockFsModule.getInfoAsync.mockResolvedValue({ size: 0 });
      mockFileRepository.linkFromUri.mockResolvedValue(mockEntry);

      await service.processShareIntent();

      // Verifica que nome foi extraído do fallback
      expect(mockFileRepository.linkFromUri).toHaveBeenCalledWith(
        uri,
        'shared_file', // Fallback quando URI não tem componente com extensão
        'application/octet-stream',
        0,
        'shared',
      );
    });

    it('trata URI string vazia como inválida', async () => {
      mockNativeModule.getShareIntentPayload.mockResolvedValue(['']);

      const result = await service.processShareIntent();

      // URI vazia é inválida e registrada como erro
      expect(result.files).toHaveLength(0);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].success).toBe(false);
    });

    it('trata URI com apenas espaços em branco como inválida', async () => {
      mockNativeModule.getShareIntentPayload.mockResolvedValue(['   ']);

      const result = await service.processShareIntent();

      expect(result.files).toHaveLength(0);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].success).toBe(false);
    });

    it('processa URI quando getInfoAsync retorna null ou undefined', async () => {
      const uri = 'file:///data/file.pdf';
      const mockEntry: FileEntry = {
        id: 'file-1',
        name: 'file.pdf',
        sizeBytes: 0,
        mimeType: 'application/pdf',
        localUri: uri,
        origin: 'shared',
        createdAt: Date.now(),
        linked: true,
      };

      mockNativeModule.getShareIntentPayload.mockResolvedValue([uri]);
      mockFsModule.getInfoAsync.mockResolvedValue(null); // getInfoAsync retorna null
      mockFileRepository.linkFromUri.mockResolvedValue(mockEntry);

      const result = await service.processShareIntent();

      // Continua processando com fallback (size: 0)
      expect(result.files).toHaveLength(1);
      expect(result.files[0].sizeBytes).toBe(0);
    });

    it('processa URI quando getInfoAsync retorna objeto sem size', async () => {
      const uri = 'content://provider/file.doc';
      const mockEntry: FileEntry = {
        id: 'file-1',
        name: 'file.doc',
        sizeBytes: 0,
        mimeType: 'application/octet-stream',
        localUri: uri,
        origin: 'shared',
        createdAt: Date.now(),
        linked: true,
      };

      mockNativeModule.getShareIntentPayload.mockResolvedValue([uri]);
      // getInfoAsync retorna objeto válido mas sem size
      mockFsModule.getInfoAsync.mockResolvedValue({ name: 'file.doc' });
      mockFileRepository.linkFromUri.mockResolvedValue(mockEntry);

      const result = await service.processShareIntent();

      // size deve ser 0 (fallback), name extraído do objeto
      expect(result.files).toHaveLength(1);
      expect(result.files[0].sizeBytes).toBe(0);
    });
  });
});

describe('createShareIntentService factory', () => {
  let mockFileRepository: jest.Mocked<FileRepository>;

  beforeEach(() => {
    mockFileRepository = {
      linkFromUri: jest.fn(),
      fsModule: {
        getInfoAsync: jest.fn().mockResolvedValue({ size: 0 }),
      },
    } as unknown as jest.Mocked<FileRepository>;
  });

  it('retorna serviço com módulo nativo real quando disponível', () => {
    const service = createShareIntentService(mockFileRepository);

    expect(service).toBeInstanceOf(ShareIntentService);
  });

  it('retorna serviço com fallback mock quando módulo nativo não está disponível', async () => {
    // Simular módulo nativo não disponível
    const originalModule = NativeModules.ShareIntentPayload;
    Object.defineProperty(NativeModules, 'ShareIntentPayload', {
      value: undefined,
      configurable: true,
    });

    const service = createShareIntentService(mockFileRepository);

    expect(service).toBeInstanceOf(ShareIntentService);

    // Verifica que o serviço pode ser usado mesmo com fallback
    const mockEntry: FileEntry = {
      id: 'file-1',
      name: 'file.txt',
      sizeBytes: 100,
      mimeType: 'text/plain',
      localUri: 'content://provider/file.txt',
      origin: 'shared',
      createdAt: Date.now(),
      linked: true,
    };

    mockFileRepository.linkFromUri.mockResolvedValue(mockEntry);

    const result = await service.processShareIntent();

    // Com módulo nativo fallback (undefined), retorna empty (nenhum arquivo compartilhado)
    expect(result.files).toHaveLength(0);
    expect(result.hasSuccessfulItems).toBe(false);

    // Restaurar original
    Object.defineProperty(NativeModules, 'ShareIntentPayload', {
      value: originalModule,
      configurable: true,
    });
  });

});
