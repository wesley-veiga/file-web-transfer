/**
 * Testes unitários para useSharedFiles hook.
 *
 * Testa:
 * - pickAndShareFiles: abre document picker, salva arquivos, atualiza store
 * - cancelar document picker não altera a lista
 * - erro ao salvar um arquivo não impede os demais (graceful)
 * - removeFile: remove do store imediatamente (otimista), depois do repositório
 * - loadSharedFiles: popula store a partir do repositório
 */

import { renderHook, act } from '@testing-library/react-native';
import * as DocumentPicker from 'expo-document-picker';
import { useSharedFiles } from '../useSharedFiles';
import { useSharedFilesStore } from '../../store/sharedFilesStore';
import type { FileRepository } from '../../services/fileRepository';
import type { FileEntry } from '../../types';
import { createMockFileRepository as createMockFileRepositoryHelper } from '../../../../__mocks__/testHelpers';

jest.mock('expo-document-picker', () => ({
  getDocumentAsync: jest.fn(),
}));

describe('useSharedFiles hook', () => {
  let mockFileRepository: jest.Mocked<FileRepository>;

  const createMockFileRepository = (): jest.Mocked<FileRepository> =>
    createMockFileRepositoryHelper();

  const resetStore = () => {
    useSharedFilesStore.setState({
      files: [],
    });
  };

  const createMockFileEntry = (overrides?: Partial<FileEntry>): FileEntry => ({
    id: 'file-1',
    name: 'documento.pdf',
    sizeBytes: 1024,
    mimeType: 'application/pdf',
    localUri: 'file:///private/doc.pdf',
    origin: 'shared',
    createdAt: Date.now(),
    ...overrides,
  });

  beforeEach(() => {
    jest.clearAllMocks();
    resetStore();
    mockFileRepository = createMockFileRepository();

    // Mock padrão de DocumentPicker: cancelado
    jest.mocked(DocumentPicker.getDocumentAsync).mockResolvedValue({
      canceled: true,
      assets: null,
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('pickAndShareFiles', () => {
    it('deve abrir document picker com múltiplos arquivos', async () => {
      const { result } = await renderHook(() =>
        useSharedFiles({ fileRepository: mockFileRepository }),
      );

      await act(async () => {
        await result.current.pickAndShareFiles();
      });

      expect(jest.mocked(DocumentPicker.getDocumentAsync)).toHaveBeenCalledWith({
        multiple: true,
      });
    });

    it('deve não fazer nada quando usuário cancela o picker', async () => {
      jest.mocked(DocumentPicker.getDocumentAsync).mockResolvedValueOnce({
        canceled: true,
        assets: null,
      });

      const { result } = await renderHook(() =>
        useSharedFiles({ fileRepository: mockFileRepository }),
      );

      const initialStore = useSharedFilesStore.getState();
      expect(initialStore.files).toHaveLength(0);

      await act(async () => {
        await result.current.pickAndShareFiles();
      });

      expect(useSharedFilesStore.getState().files).toHaveLength(0);
      expect(mockFileRepository.saveFromUri).not.toHaveBeenCalled();
    });

    it('deve salvar arquivo selecionado e adicionar ao store', async () => {
      const asset = {
        uri: 'file:///tmp/selected.pdf',
        name: 'documento.pdf',
        mimeType: 'application/pdf' as const,
        size: 1024,
        lastModified: Date.now(),
      };

      jest.mocked(DocumentPicker.getDocumentAsync).mockResolvedValueOnce({
        canceled: false,
        assets: [asset],
      });

      const savedEntry = createMockFileEntry({ name: 'documento.pdf' });
      mockFileRepository.saveFromUri = jest.fn().mockResolvedValueOnce(savedEntry);

      const { result } = await renderHook(() =>
        useSharedFiles({ fileRepository: mockFileRepository }),
      );

      await act(async () => {
        await result.current.pickAndShareFiles();
      });

      expect(mockFileRepository.saveFromUri).toHaveBeenCalledWith(
        'file:///tmp/selected.pdf',
        'documento.pdf',
        'application/pdf',
        1024,
        'shared',
      );

      expect(useSharedFilesStore.getState().files).toHaveLength(1);
      expect(useSharedFilesStore.getState().files[0].id).toBe('file-1');
    });

    it('deve salvar múltiplos arquivos selecionados', async () => {
      const assets = [
        {
          uri: 'file:///tmp/doc1.pdf',
          name: 'doc1.pdf',
          mimeType: 'application/pdf',
          size: 1024,
          lastModified: Date.now(),
        },
        {
          uri: 'file:///tmp/doc2.pdf',
          name: 'doc2.pdf',
          mimeType: 'application/pdf',
          size: 2048,
          lastModified: Date.now(),
        },
      ];

      jest.mocked(DocumentPicker.getDocumentAsync).mockResolvedValueOnce({
        canceled: false,
        assets,
      });

      const entry1 = createMockFileEntry({ id: 'file-1', name: 'doc1.pdf' });
      const entry2 = createMockFileEntry({ id: 'file-2', name: 'doc2.pdf', sizeBytes: 2048 });

      mockFileRepository.saveFromUri = jest
        .fn()
        .mockResolvedValueOnce(entry1)
        .mockResolvedValueOnce(entry2);

      const { result } = await renderHook(() =>
        useSharedFiles({ fileRepository: mockFileRepository }),
      );

      await act(async () => {
        await result.current.pickAndShareFiles();
      });

      expect(mockFileRepository.saveFromUri).toHaveBeenCalledTimes(2);
      expect(useSharedFilesStore.getState().files).toHaveLength(2);
    });

    it('deve usar mimeType padrão quando asset não fornece', async () => {
      const asset = {
        uri: 'file:///tmp/unknown',
        name: 'desconhecido',
        mimeType: undefined,
        size: 512,
        lastModified: Date.now(),
      };

      jest.mocked(DocumentPicker.getDocumentAsync).mockResolvedValueOnce({
        canceled: false,
        assets: [asset],
      });

      const savedEntry = createMockFileEntry({
        name: 'desconhecido',
        mimeType: 'application/octet-stream',
      });
      mockFileRepository.saveFromUri = jest.fn().mockResolvedValueOnce(savedEntry);

      const { result } = await renderHook(() =>
        useSharedFiles({ fileRepository: mockFileRepository }),
      );

      await act(async () => {
        await result.current.pickAndShareFiles();
      });

      expect(mockFileRepository.saveFromUri).toHaveBeenCalledWith(
        'file:///tmp/unknown',
        'desconhecido',
        'application/octet-stream', // Padrão quando não fornecido
        512,
        'shared',
      );
    });

    it('deve usar size padrão 0 quando asset não fornece', async () => {
      const asset = {
        uri: 'file:///tmp/nosize',
        name: 'nosize.bin',
        mimeType: 'application/octet-stream',
        size: undefined,
        lastModified: Date.now(),
      };

      jest.mocked(DocumentPicker.getDocumentAsync).mockResolvedValueOnce({
        canceled: false,
        assets: [asset],
      });

      const savedEntry = createMockFileEntry({ name: 'nosize.bin', sizeBytes: 0 });
      mockFileRepository.saveFromUri = jest.fn().mockResolvedValueOnce(savedEntry);

      const { result } = await renderHook(() =>
        useSharedFiles({ fileRepository: mockFileRepository }),
      );

      await act(async () => {
        await result.current.pickAndShareFiles();
      });

      expect(mockFileRepository.saveFromUri).toHaveBeenCalledWith(
        'file:///tmp/nosize',
        'nosize.bin',
        'application/octet-stream',
        0, // Padrão quando não fornecido
        'shared',
      );
    });

    it('deve continuar com próximo arquivo se um falhar', async () => {
      const assets = [
        {
          uri: 'file:///tmp/doc1.pdf',
          name: 'doc1.pdf',
          mimeType: 'application/pdf',
          size: 1024,
          lastModified: Date.now(),
        },
        {
          uri: 'file:///tmp/doc2.pdf',
          name: 'doc2.pdf',
          mimeType: 'application/pdf',
          size: 2048,
          lastModified: Date.now(),
        },
      ];

      jest.mocked(DocumentPicker.getDocumentAsync).mockResolvedValueOnce({
        canceled: false,
        assets,
      });

      const entry1 = createMockFileEntry({ id: 'file-1', name: 'doc1.pdf' });
      // Segundo arquivo falha
      mockFileRepository.saveFromUri = jest
        .fn()
        .mockResolvedValueOnce(entry1)
        .mockRejectedValueOnce(new Error('Storage full'));

      const { result } = await renderHook(() =>
        useSharedFiles({ fileRepository: mockFileRepository }),
      );

      await act(async () => {
        await result.current.pickAndShareFiles();
      });

      // Primeira chamada resolvida, segunda rejeitada, mas a função não lança
      expect(mockFileRepository.saveFromUri).toHaveBeenCalledTimes(2);
      // Apenas o primeiro arquivo foi adicionado ao store
      expect(useSharedFilesStore.getState().files).toHaveLength(1);
    });

    it('deve ignorar chamada concorrente enquanto o picker anterior ainda está aberto (T-701)', async () => {
      // Bug real em teste manual: um segundo toque no botão antes do picker fechar
      // disparava `getDocumentAsync` duas vezes, e a lib nativa rejeitava a segunda
      // chamada com "Different document picking in progress".
      let resolvePicker: ((value: DocumentPicker.DocumentPickerResult) => void) | undefined;
      jest.mocked(DocumentPicker.getDocumentAsync).mockReturnValueOnce(
        new Promise((resolve) => {
          resolvePicker = resolve;
        }),
      );

      const { result } = await renderHook(() =>
        useSharedFiles({ fileRepository: mockFileRepository }),
      );

      let firstCall: Promise<void>;
      let secondCall: Promise<void>;
      await act(async () => {
        firstCall = result.current.pickAndShareFiles();
        secondCall = result.current.pickAndShareFiles();
        resolvePicker?.({ canceled: true, assets: null });
        await Promise.all([firstCall, secondCall]);
      });

      expect(jest.mocked(DocumentPicker.getDocumentAsync)).toHaveBeenCalledTimes(1);
    });

    it('permite uma nova chamada após o picker anterior finalizar', async () => {
      const { result } = await renderHook(() =>
        useSharedFiles({ fileRepository: mockFileRepository }),
      );

      await act(async () => {
        await result.current.pickAndShareFiles();
      });
      await act(async () => {
        await result.current.pickAndShareFiles();
      });

      expect(jest.mocked(DocumentPicker.getDocumentAsync)).toHaveBeenCalledTimes(2);
    });

    it('deve lançar erro se document picker falhar', async () => {
      jest.mocked(DocumentPicker.getDocumentAsync).mockRejectedValueOnce(new Error('Picker error'));

      const { result } = await renderHook(() =>
        useSharedFiles({ fileRepository: mockFileRepository }),
      );

      let caughtError: unknown;
      await act(async () => {
        try {
          await result.current.pickAndShareFiles();
        } catch (error) {
          caughtError = error;
        }
      });

      expect(caughtError).toBeInstanceOf(Error);
      expect(String(caughtError)).toContain('Picker error');
    });
  });

  describe('removeFile', () => {
    it('deve remover arquivo do store imediatamente (otimista)', async () => {
      const file = createMockFileEntry({ id: 'file-to-remove' });

      // Pré-popular store
      useSharedFilesStore.setState({
        files: [
          {
            id: 'file-to-remove',
            name: 'doc.pdf',
            sizeBytes: 1024,
            mimeType: 'application/pdf',
            createdAt: 1000,
          },
        ],
      });

      mockFileRepository.remove = jest.fn().mockResolvedValueOnce(undefined);

      const { result } = await renderHook(() =>
        useSharedFiles({ fileRepository: mockFileRepository }),
      );

      expect(useSharedFilesStore.getState().files).toHaveLength(1);

      await act(async () => {
        await result.current.removeFile('file-to-remove');
      });

      // Store já foi atualizado (otimista)
      expect(useSharedFilesStore.getState().files).toHaveLength(0);
      expect(mockFileRepository.remove).toHaveBeenCalledWith('file-to-remove');
    });

    it('deve chamar repository.remove mesmo após remover do store', async () => {
      useSharedFilesStore.setState({
        files: [
          {
            id: 'file-1',
            name: 'doc.pdf',
            sizeBytes: 1024,
            mimeType: 'application/pdf',
            createdAt: 1000,
          },
        ],
      });

      mockFileRepository.remove = jest.fn().mockResolvedValueOnce(undefined);

      const { result } = await renderHook(() =>
        useSharedFiles({ fileRepository: mockFileRepository }),
      );

      await act(async () => {
        await result.current.removeFile('file-1');
      });

      expect(mockFileRepository.remove).toHaveBeenCalledWith('file-1');
    });

    it('deve lançar erro se repository.remove falhar', async () => {
      useSharedFilesStore.setState({
        files: [
          {
            id: 'file-1',
            name: 'doc.pdf',
            sizeBytes: 1024,
            mimeType: 'application/pdf',
            createdAt: 1000,
          },
        ],
      });

      mockFileRepository.remove = jest.fn().mockRejectedValueOnce(new Error('Removal failed'));

      const { result } = await renderHook(() =>
        useSharedFiles({ fileRepository: mockFileRepository }),
      );

      let caughtError: unknown;
      await act(async () => {
        try {
          await result.current.removeFile('file-1');
        } catch (error) {
          caughtError = error;
        }
      });

      // Store já foi atualizado (otimista), mas o erro é lançado
      expect(caughtError).toBeInstanceOf(Error);
      expect(String(caughtError)).toContain('Removal failed');
    });
  });

  describe('loadSharedFiles', () => {
    it('deve carregar arquivos do repositório e popular store', async () => {
      const entries = [
        createMockFileEntry({ id: 'file-1', name: 'doc1.pdf' }),
        createMockFileEntry({ id: 'file-2', name: 'doc2.pdf' }),
      ];

      mockFileRepository.list = jest.fn().mockResolvedValueOnce(entries);

      const { result } = await renderHook(() =>
        useSharedFiles({ fileRepository: mockFileRepository }),
      );

      expect(useSharedFilesStore.getState().files).toHaveLength(0);

      await act(async () => {
        await result.current.loadSharedFiles();
      });

      expect(mockFileRepository.list).toHaveBeenCalledWith('shared');
      expect(useSharedFilesStore.getState().files).toHaveLength(2);
    });

    it('deve lidar com lista vazia', async () => {
      mockFileRepository.list = jest.fn().mockResolvedValueOnce([]);

      const { result } = await renderHook(() =>
        useSharedFiles({ fileRepository: mockFileRepository }),
      );

      await act(async () => {
        await result.current.loadSharedFiles();
      });

      expect(useSharedFilesStore.getState().files).toHaveLength(0);
    });

    it('deve lançar erro se repository.list falhar', async () => {
      mockFileRepository.list = jest.fn().mockRejectedValueOnce(new Error('Load failed'));

      const { result } = await renderHook(() =>
        useSharedFiles({ fileRepository: mockFileRepository }),
      );

      let caughtError: unknown;
      await act(async () => {
        try {
          await result.current.loadSharedFiles();
        } catch (error) {
          caughtError = error;
        }
      });

      expect(caughtError).toBeInstanceOf(Error);
      expect(String(caughtError)).toContain('Load failed');
    });
  });

  describe('pasta vinculada (T-701 — compartilhar por pasta sem duplicar)', () => {
    const folderUri = 'content://tree/primary%3ADownload';
    const folderFileFixture = {
      uri: 'content://.../document/primary%3ADownload%2Ffoto.jpg',
      name: 'foto.jpg',
      mimeType: 'image/jpeg',
      sizeBytes: 2048,
    };

    function createMockFolderSharingModule() {
      return {
        requestDirectoryPermissionsAsync: jest.fn(),
        readDirectoryAsync: jest.fn().mockResolvedValue([folderFileFixture.uri]),
        getInfoAsync: jest.fn().mockResolvedValue({
          exists: true,
          uri: folderFileFixture.uri,
          isDirectory: false,
          size: folderFileFixture.sizeBytes,
          modificationTime: 0,
        }),
      };
    }

    describe('loadLinkedFolder', () => {
      it('sem pasta vinculada: linkedFolderUri fica null e folderFiles vazio', async () => {
        mockFileRepository.getLinkedFolderUri.mockResolvedValue(null);
        mockFileRepository.list.mockResolvedValue([]);
        const folderSharingModule = createMockFolderSharingModule();

        const { result } = await renderHook(() =>
          useSharedFiles({ fileRepository: mockFileRepository, folderSharingModule }),
        );

        await act(async () => {
          await result.current.loadLinkedFolder();
        });

        expect(result.current.linkedFolderUri).toBeNull();
        expect(result.current.folderFiles).toEqual([]);
        expect(folderSharingModule.readDirectoryAsync).not.toHaveBeenCalled();
      });

      it('com pasta vinculada: popula linkedFolderUri e folderFiles', async () => {
        mockFileRepository.getLinkedFolderUri.mockResolvedValue(folderUri);
        mockFileRepository.list.mockResolvedValue([]);
        const folderSharingModule = createMockFolderSharingModule();

        const { result } = await renderHook(() =>
          useSharedFiles({ fileRepository: mockFileRepository, folderSharingModule }),
        );

        await act(async () => {
          await result.current.loadLinkedFolder();
        });

        expect(result.current.linkedFolderUri).toBe(folderUri);
        expect(result.current.folderFiles).toEqual([folderFileFixture]);
      });

      it('marca isFolderFileEnabled(uri) true quando já existe entrada linked com o mesmo localUri', async () => {
        mockFileRepository.getLinkedFolderUri.mockResolvedValue(folderUri);
        mockFileRepository.list.mockResolvedValue([
          createMockFileEntry({
            id: 'linked-1',
            localUri: folderFileFixture.uri,
            linked: true,
          }),
        ]);
        const folderSharingModule = createMockFolderSharingModule();

        const { result } = await renderHook(() =>
          useSharedFiles({ fileRepository: mockFileRepository, folderSharingModule }),
        );

        await act(async () => {
          await result.current.loadLinkedFolder();
        });

        expect(result.current.isFolderFileEnabled(folderFileFixture.uri)).toBe(true);
        expect(result.current.isFolderFileEnabled('content://outro.jpg')).toBe(false);
      });

      it('propaga erro quando fileRepository.list falha', async () => {
        mockFileRepository.getLinkedFolderUri.mockResolvedValue(folderUri);
        mockFileRepository.list.mockRejectedValue(new Error('list failed'));
        const folderSharingModule = createMockFolderSharingModule();

        const { result } = await renderHook(() =>
          useSharedFiles({ fileRepository: mockFileRepository, folderSharingModule }),
        );

        await expect(
          act(async () => {
            await result.current.loadLinkedFolder();
          }),
        ).rejects.toThrow('list failed');
      });
    });

    describe('pickFolder', () => {
      it('usuário concede permissão: persiste a URI e carrega os arquivos da pasta', async () => {
        mockFileRepository.list.mockResolvedValue([]);
        const folderSharingModule = createMockFolderSharingModule();
        folderSharingModule.requestDirectoryPermissionsAsync.mockResolvedValue({
          granted: true,
          directoryUri: folderUri,
        });

        const { result } = await renderHook(() =>
          useSharedFiles({ fileRepository: mockFileRepository, folderSharingModule }),
        );

        await act(async () => {
          await result.current.pickFolder();
        });

        expect(mockFileRepository.setLinkedFolderUri).toHaveBeenCalledWith(folderUri);
        expect(result.current.linkedFolderUri).toBe(folderUri);
        expect(result.current.folderFiles).toEqual([folderFileFixture]);
      });

      it('usuário nega/cancela: não persiste nada e não muda o estado', async () => {
        const folderSharingModule = createMockFolderSharingModule();
        folderSharingModule.requestDirectoryPermissionsAsync.mockResolvedValue({
          granted: false,
        });

        const { result } = await renderHook(() =>
          useSharedFiles({ fileRepository: mockFileRepository, folderSharingModule }),
        );

        await act(async () => {
          await result.current.pickFolder();
        });

        expect(mockFileRepository.setLinkedFolderUri).not.toHaveBeenCalled();
        expect(result.current.linkedFolderUri).toBeNull();
      });
    });

    describe('toggleFolderFile', () => {
      it('arquivo ainda não habilitado: vincula via linkFromUri e adiciona ao store', async () => {
        mockFileRepository.getLinkedFolderUri.mockResolvedValue(folderUri);
        mockFileRepository.list.mockResolvedValue([]);
        const linkedEntry = createMockFileEntry({
          id: 'new-linked',
          name: folderFileFixture.name,
          localUri: folderFileFixture.uri,
          linked: true,
        });
        mockFileRepository.linkFromUri.mockResolvedValue(linkedEntry);
        const folderSharingModule = createMockFolderSharingModule();

        const { result } = await renderHook(() =>
          useSharedFiles({ fileRepository: mockFileRepository, folderSharingModule }),
        );
        await act(async () => {
          await result.current.loadLinkedFolder();
        });

        await act(async () => {
          await result.current.toggleFolderFile(folderFileFixture);
        });

        expect(mockFileRepository.linkFromUri).toHaveBeenCalledWith(
          folderFileFixture.uri,
          folderFileFixture.name,
          folderFileFixture.mimeType,
          folderFileFixture.sizeBytes,
          'shared',
        );
        expect(useSharedFilesStore.getState().files.some((f) => f.id === 'new-linked')).toBe(true);
        expect(result.current.isFolderFileEnabled(folderFileFixture.uri)).toBe(true);
      });

      it('arquivo já habilitado: desvincula via removeFile (não chama linkFromUri de novo)', async () => {
        mockFileRepository.getLinkedFolderUri.mockResolvedValue(folderUri);
        mockFileRepository.list.mockResolvedValue([
          createMockFileEntry({
            id: 'already-linked',
            localUri: folderFileFixture.uri,
            linked: true,
          }),
        ]);
        const folderSharingModule = createMockFolderSharingModule();

        const { result } = await renderHook(() =>
          useSharedFiles({ fileRepository: mockFileRepository, folderSharingModule }),
        );
        await act(async () => {
          await result.current.loadLinkedFolder();
        });

        await act(async () => {
          await result.current.toggleFolderFile(folderFileFixture);
        });

        expect(mockFileRepository.remove).toHaveBeenCalledWith('already-linked');
        expect(mockFileRepository.linkFromUri).not.toHaveBeenCalled();
        expect(result.current.isFolderFileEnabled(folderFileFixture.uri)).toBe(false);
      });

      it('propaga erro quando linkFromUri falha', async () => {
        mockFileRepository.getLinkedFolderUri.mockResolvedValue(folderUri);
        mockFileRepository.list.mockResolvedValue([]);
        mockFileRepository.linkFromUri.mockRejectedValue(new Error('link failed'));
        const folderSharingModule = createMockFolderSharingModule();

        const { result } = await renderHook(() =>
          useSharedFiles({ fileRepository: mockFileRepository, folderSharingModule }),
        );
        await act(async () => {
          await result.current.loadLinkedFolder();
        });

        await expect(
          act(async () => {
            await result.current.toggleFolderFile(folderFileFixture);
          }),
        ).rejects.toThrow('link failed');
      });
    });
  });

  describe('hook return', () => {
    it('deve retornar files, pickAndShareFiles, removeFile, loadSharedFiles', async () => {
      const { result } = await renderHook(() =>
        useSharedFiles({ fileRepository: mockFileRepository }),
      );

      expect(result.current).toHaveProperty('files');
      expect(result.current).toHaveProperty('pickAndShareFiles');
      expect(result.current).toHaveProperty('removeFile');
      expect(result.current).toHaveProperty('loadSharedFiles');

      expect(typeof result.current.pickAndShareFiles).toBe('function');
      expect(typeof result.current.removeFile).toBe('function');
      expect(typeof result.current.loadSharedFiles).toBe('function');
      expect(Array.isArray(result.current.files)).toBe(true);
    });
  });
});
