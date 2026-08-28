/**
 * Testes unitários para useReceivedFiles hook.
 *
 * Testa:
 * - loadReceivedFiles: popula o store a partir do repositório
 * - openFile: busca localUri no repositório e chama sharingService.openAsync
 * - shareFile: busca localUri no repositório e chama sharingService.shareAsync
 * - removeFile: remove do store imediatamente (otimista), depois do repositório
 */

import { renderHook, act } from '@testing-library/react-native';
import { useReceivedFiles } from '../useReceivedFiles';
import { useReceivedFilesStore } from '../../store/receivedFilesStore';
import type { FileRepository } from '../../services/fileRepository';
import type { SharingModule } from '../../services/sharingService';
import type { FileEntry } from '../../types';
import { createMockFileRepository as createMockFileRepositoryHelper } from '../../../../__mocks__/testHelpers';

describe('useReceivedFiles hook', () => {
  let mockFileRepository: jest.Mocked<FileRepository>;
  let mockSharingModule: jest.Mocked<SharingModule>;

  const createMockFileRepository = (): jest.Mocked<FileRepository> =>
    createMockFileRepositoryHelper();

  const createMockSharingModule = (): jest.Mocked<SharingModule> => ({
    openAsync: jest.fn(),
    shareAsync: jest.fn(),
  });

  const resetStore = () => {
    useReceivedFilesStore.setState({ files: [] });
  };

  const createMockFileEntry = (overrides?: Partial<FileEntry>): FileEntry => ({
    id: 'file-1',
    name: 'documento.pdf',
    sizeBytes: 1024,
    mimeType: 'application/pdf',
    localUri: 'file:///private/doc.pdf',
    origin: 'received',
    createdAt: Date.now(),
    ...overrides,
  });

  beforeEach(() => {
    jest.clearAllMocks();
    resetStore();
    mockFileRepository = createMockFileRepository();
    mockSharingModule = createMockSharingModule();
  });

  describe('injeção de dependência padrão', () => {
    it('usa o repositório e o serviço de sharing reais quando nada é injetado', async () => {
      const { result } = await renderHook(() => useReceivedFiles());

      expect(result.current.files).toEqual([]);
      expect(typeof result.current.openFile).toBe('function');
    });
  });

  describe('loadReceivedFiles', () => {
    it('chama fileRepository.list("received") e popula o store via setFiles', async () => {
      const mockEntries: FileEntry[] = [createMockFileEntry()];
      mockFileRepository.list.mockResolvedValue(mockEntries);

      const { result } = await renderHook(() =>
        useReceivedFiles({ fileRepository: mockFileRepository, sharingModule: mockSharingModule }),
      );

      await act(async () => {
        await result.current.loadReceivedFiles();
      });

      expect(mockFileRepository.list).toHaveBeenCalledWith('received');
      // setFiles converte para DTO (remove localUri/origin) — não é igual à entry crua
      expect(result.current.files).toHaveLength(1);
      expect(result.current.files[0]).not.toHaveProperty('localUri');
      expect(result.current.files[0]).not.toHaveProperty('origin');
      expect(result.current.files[0].id).toBe('file-1');
    });

    it('quando list rejeita, propaga o erro', async () => {
      mockFileRepository.list.mockRejectedValue(new Error('Erro ao listar arquivos'));

      const { result } = await renderHook(() =>
        useReceivedFiles({ fileRepository: mockFileRepository, sharingModule: mockSharingModule }),
      );

      await expect(
        act(async () => {
          await result.current.loadReceivedFiles();
        }),
      ).rejects.toThrow('Erro ao listar arquivos');
    });
  });

  describe('openFile', () => {
    it('busca a lista, encontra o arquivo pelo id e chama sharingService.openAsync(file.localUri)', async () => {
      const mockEntries: FileEntry[] = [createMockFileEntry()];
      mockFileRepository.list.mockResolvedValue(mockEntries);
      mockSharingModule.openAsync.mockResolvedValue();

      const { result } = await renderHook(() =>
        useReceivedFiles({ fileRepository: mockFileRepository, sharingModule: mockSharingModule }),
      );

      await act(async () => {
        await result.current.openFile('file-1');
      });

      expect(mockFileRepository.list).toHaveBeenCalledWith('received');
      expect(mockSharingModule.openAsync).toHaveBeenCalledWith('file:///private/doc.pdf');
    });

    it('quando o arquivo não é encontrado, rejeita com erro contendo o id', async () => {
      mockFileRepository.list.mockResolvedValue([]);

      const { result } = await renderHook(() =>
        useReceivedFiles({ fileRepository: mockFileRepository, sharingModule: mockSharingModule }),
      );

      await expect(
        act(async () => {
          await result.current.openFile('file-2');
        }),
      ).rejects.toThrow('file-2');
    });

    it('quando sharingService.openAsync rejeita, o erro é propagado', async () => {
      const mockEntries: FileEntry[] = [createMockFileEntry()];
      mockFileRepository.list.mockResolvedValue(mockEntries);
      mockSharingModule.openAsync.mockRejectedValue(new Error('Erro ao abrir arquivo'));

      const { result } = await renderHook(() =>
        useReceivedFiles({ fileRepository: mockFileRepository, sharingModule: mockSharingModule }),
      );

      await expect(
        act(async () => {
          await result.current.openFile('file-1');
        }),
      ).rejects.toThrow('Erro ao abrir arquivo');
    });
  });

  describe('shareFile', () => {
    it('busca a lista, encontra o arquivo pelo id e chama sharingService.shareAsync(file.localUri)', async () => {
      const mockEntries: FileEntry[] = [createMockFileEntry()];
      mockFileRepository.list.mockResolvedValue(mockEntries);
      mockSharingModule.shareAsync.mockResolvedValue();

      const { result } = await renderHook(() =>
        useReceivedFiles({ fileRepository: mockFileRepository, sharingModule: mockSharingModule }),
      );

      await act(async () => {
        await result.current.shareFile('file-1');
      });

      expect(mockFileRepository.list).toHaveBeenCalledWith('received');
      expect(mockSharingModule.shareAsync).toHaveBeenCalledWith('file:///private/doc.pdf');
    });

    it('quando o arquivo não é encontrado, rejeita', async () => {
      mockFileRepository.list.mockResolvedValue([]);

      const { result } = await renderHook(() =>
        useReceivedFiles({ fileRepository: mockFileRepository, sharingModule: mockSharingModule }),
      );

      await expect(
        act(async () => {
          await result.current.shareFile('file-2');
        }),
      ).rejects.toThrow('file-2');
    });

    it('quando sharingService.shareAsync rejeita, o erro é propagado', async () => {
      const mockEntries: FileEntry[] = [createMockFileEntry()];
      mockFileRepository.list.mockResolvedValue(mockEntries);
      mockSharingModule.shareAsync.mockRejectedValue(new Error('Erro ao compartilhar arquivo'));

      const { result } = await renderHook(() =>
        useReceivedFiles({ fileRepository: mockFileRepository, sharingModule: mockSharingModule }),
      );

      await expect(
        act(async () => {
          await result.current.shareFile('file-1');
        }),
      ).rejects.toThrow('Erro ao compartilhar arquivo');
    });
  });

  describe('removeFile', () => {
    it('remove do store imediatamente (otimista), antes do repositório resolver', async () => {
      useReceivedFilesStore.setState({
        files: [
          {
            id: 'file-1',
            name: 'documento.pdf',
            sizeBytes: 1024,
            mimeType: 'application/pdf',
            createdAt: Date.now(),
          },
        ],
      });

      let resolveRemove: () => void = () => {};
      mockFileRepository.remove.mockReturnValue(
        new Promise((resolve) => {
          resolveRemove = () => resolve(undefined);
        }),
      );

      const { result } = await renderHook(() =>
        useReceivedFiles({ fileRepository: mockFileRepository, sharingModule: mockSharingModule }),
      );

      let removePromise!: Promise<void>;
      await act(async () => {
        removePromise = result.current.removeFile('file-1');
        // Deixa o microtask do removeFileFromStore síncrono rodar antes do repositório resolver
        await Promise.resolve();
      });

      expect(useReceivedFilesStore.getState().files).toHaveLength(0);

      resolveRemove();
      await act(async () => {
        await removePromise;
      });
    });

    it('chama fileRepository.remove(fileId)', async () => {
      mockFileRepository.remove.mockResolvedValue();

      const { result } = await renderHook(() =>
        useReceivedFiles({ fileRepository: mockFileRepository, sharingModule: mockSharingModule }),
      );

      await act(async () => {
        await result.current.removeFile('file-1');
      });

      expect(mockFileRepository.remove).toHaveBeenCalledWith('file-1');
    });

    it('quando fileRepository.remove rejeita, o erro é propagado', async () => {
      mockFileRepository.remove.mockRejectedValue(new Error('Erro ao remover arquivo'));

      const { result } = await renderHook(() =>
        useReceivedFiles({ fileRepository: mockFileRepository, sharingModule: mockSharingModule }),
      );

      await expect(
        act(async () => {
          await result.current.removeFile('file-1');
        }),
      ).rejects.toThrow('Erro ao remover arquivo');
    });
  });
});
