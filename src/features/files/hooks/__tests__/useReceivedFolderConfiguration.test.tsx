/**
 * Testes unitários para useReceivedFolderConfiguration hook (T-802).
 *
 * Testa a lógica de seleção/limpeza de pasta configurada para upload de recebidos.
 */

import { renderHook, act } from '@testing-library/react-native';
import { useReceivedFolderConfiguration } from '../useReceivedFolderConfiguration';
import type { FileRepository } from '../../services/fileRepository';
import type { FolderSharingModule } from '../../services/folderSharingService';

describe('useReceivedFolderConfiguration hook (T-802)', () => {
  let mockFileRepository: jest.Mocked<FileRepository>;
  let mockFolderSharingModule: jest.Mocked<FolderSharingModule>;

  const createMockFileRepository = (): jest.Mocked<FileRepository> => ({
    save: jest.fn(),
    saveFromUri: jest.fn(),
    linkFromUri: jest.fn(),
    list: jest.fn(),
    remove: jest.fn(),
    toDto: jest.fn(),
    beginStreamedWrite: jest.fn(),
    moveReceivedFileToConfiguredFolder: jest.fn(),
    getReceivedFolderUri: jest.fn(),
    setReceivedFolderUri: jest.fn(),
    getLinkedFolderUri: jest.fn(),
    setLinkedFolderUri: jest.fn(),
  });

  const createMockFolderSharingModule = (): jest.Mocked<FolderSharingModule> => ({
    requestDirectoryPermissionsAsync: jest.fn(),
    readDirectoryAsync: jest.fn(),
    getInfoAsync: jest.fn(),
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockFileRepository = createMockFileRepository();
    mockFolderSharingModule = createMockFolderSharingModule();
    mockFileRepository.getReceivedFolderUri.mockResolvedValue(null);
  });

  it('selectFolder: chama SAF e persiste quando permissão concedida', async () => {
    const folderUri = 'content://com.android.externalstorage.documents/tree/primary%3ADownload';
    mockFolderSharingModule.requestDirectoryPermissionsAsync.mockResolvedValue({
      granted: true,
      directoryUri: folderUri,
    });
    mockFileRepository.setReceivedFolderUri.mockResolvedValue(undefined);

    const { result } = await renderHook(() =>
      useReceivedFolderConfiguration({
        fileRepository: mockFileRepository,
        folderSharingModule: mockFolderSharingModule,
      }),
    );

    await act(async () => {
      await result.current.selectFolder();
    });

    expect(mockFolderSharingModule.requestDirectoryPermissionsAsync).toHaveBeenCalled();
    expect(mockFileRepository.setReceivedFolderUri).toHaveBeenCalledWith(folderUri);
  });

  it('selectFolder: ignora cancelamento (permissão negada)', async () => {
    mockFolderSharingModule.requestDirectoryPermissionsAsync.mockResolvedValue({
      granted: false,
      directoryUri: null,
    });

    const { result } = await renderHook(() =>
      useReceivedFolderConfiguration({
        fileRepository: mockFileRepository,
        folderSharingModule: mockFolderSharingModule,
      }),
    );

    await act(async () => {
      await result.current.selectFolder();
    });

    expect(mockFileRepository.setReceivedFolderUri).not.toHaveBeenCalled();
  });

  it('selectFolder: trata erro SAF', async () => {
    mockFolderSharingModule.requestDirectoryPermissionsAsync.mockRejectedValue(
      new Error('SAF error'),
    );

    const { result } = await renderHook(() =>
      useReceivedFolderConfiguration({
        fileRepository: mockFileRepository,
        folderSharingModule: mockFolderSharingModule,
      }),
    );

    await act(async () => {
      await result.current.selectFolder();
    });

    expect(result.current.error).toBe('SAF error');
  });

  it('clearFolder: remove configuração', async () => {
    const folderUri = 'content://com.android.externalstorage.documents/tree/primary%3ADownload';
    mockFileRepository.getReceivedFolderUri.mockResolvedValue(folderUri);
    mockFileRepository.setReceivedFolderUri.mockResolvedValue(undefined);

    const { result } = await renderHook(() =>
      useReceivedFolderConfiguration({
        fileRepository: mockFileRepository,
        folderSharingModule: mockFolderSharingModule,
      }),
    );

    await act(async () => {
      await result.current.clearFolder();
    });

    expect(mockFileRepository.setReceivedFolderUri).toHaveBeenCalledWith(null);
  });

  it('clearFolder: trata erro', async () => {
    mockFileRepository.setReceivedFolderUri.mockRejectedValue(new Error('Storage error'));

    const { result } = await renderHook(() =>
      useReceivedFolderConfiguration({
        fileRepository: mockFileRepository,
        folderSharingModule: mockFolderSharingModule,
      }),
    );

    await act(async () => {
      await result.current.clearFolder();
    });

    expect(result.current.error).toBe('Storage error');
  });

  it('expõe funções selectFolder e clearFolder', async () => {
    const { result } = await renderHook(() =>
      useReceivedFolderConfiguration({
        fileRepository: mockFileRepository,
        folderSharingModule: mockFolderSharingModule,
      }),
    );

    expect(typeof result.current.selectFolder).toBe('function');
    expect(typeof result.current.clearFolder).toBe('function');
  });
});
