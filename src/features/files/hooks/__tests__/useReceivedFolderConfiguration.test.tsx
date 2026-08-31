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

  it('carrega pasta configurada na inicialização', async () => {
    const folderUri = 'content://com.example.documents';
    mockFileRepository.getReceivedFolderUri.mockResolvedValue(folderUri);

    const { result } = await renderHook(() =>
      useReceivedFolderConfiguration({
        fileRepository: mockFileRepository,
        folderSharingModule: mockFolderSharingModule,
      }),
    );

    // Aguarda a useEffect ser executada
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(result.current.configuredFolderUri).toBe(folderUri);
    expect(result.current.isLoading).toBe(false);
  });

  it('trata erro não-Error na inicialização (getReceivedFolderUri)', async () => {
    // Simula erro que não é uma instância de Error (ex: string rejeitada)
    mockFileRepository.getReceivedFolderUri.mockRejectedValue('Erro desconhecido');

    const { result } = await renderHook(() =>
      useReceivedFolderConfiguration({
        fileRepository: mockFileRepository,
        folderSharingModule: mockFolderSharingModule,
      }),
    );

    // Aguarda a useEffect ser executada
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(result.current.error).toBe('Erro desconhecido');
    expect(result.current.isLoading).toBe(false);
  });

  it('trata erro na getReceivedFolderUri durante inicialização', async () => {
    mockFileRepository.getReceivedFolderUri.mockRejectedValue(
      new Error('Falha ao ler configuração'),
    );

    const { result } = await renderHook(() =>
      useReceivedFolderConfiguration({
        fileRepository: mockFileRepository,
        folderSharingModule: mockFolderSharingModule,
      }),
    );

    // Aguarda a useEffect ser executada
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(result.current.error).toBe('Falha ao ler configuração');
    expect(result.current.isLoading).toBe(false);
  });

  it('selectFolder: trata erro não-Error (não-instância de Error)', async () => {
    mockFolderSharingModule.requestDirectoryPermissionsAsync.mockRejectedValue('Erro unknow');

    const { result } = await renderHook(() =>
      useReceivedFolderConfiguration({
        fileRepository: mockFileRepository,
        folderSharingModule: mockFolderSharingModule,
      }),
    );

    await act(async () => {
      await result.current.selectFolder();
    });

    expect(result.current.error).toBe('Erro ao acessar a pasta');
  });

  it('selectFolder: trata erro ao persistir pasta', async () => {
    const folderUri = 'content://com.example.documents';
    mockFolderSharingModule.requestDirectoryPermissionsAsync.mockResolvedValue({
      granted: true,
      directoryUri: folderUri,
    });
    mockFileRepository.setReceivedFolderUri.mockRejectedValue(new Error('Falha ao salvar URI'));

    const { result } = await renderHook(() =>
      useReceivedFolderConfiguration({
        fileRepository: mockFileRepository,
        folderSharingModule: mockFolderSharingModule,
      }),
    );

    await act(async () => {
      await result.current.selectFolder();
    });

    expect(result.current.error).toBe('Falha ao salvar URI');
  });

  it('clearFolder: trata erro não-Error', async () => {
    mockFileRepository.setReceivedFolderUri.mockRejectedValue('Erro mysterious');

    const { result } = await renderHook(() =>
      useReceivedFolderConfiguration({
        fileRepository: mockFileRepository,
        folderSharingModule: mockFolderSharingModule,
      }),
    );

    await act(async () => {
      await result.current.clearFolder();
    });

    expect(result.current.error).toBe('Erro ao limpar configuração');
  });

  it('cria fileRepository padrão quando não fornecido', async () => {
    mockFolderSharingModule.requestDirectoryPermissionsAsync.mockResolvedValue({
      granted: false,
      directoryUri: null,
    });

    // Não fornece fileRepository - deveria usar createFileRepository()
    const { result } = await renderHook(() =>
      useReceivedFolderConfiguration({
        folderSharingModule: mockFolderSharingModule,
      }),
    );

    // Apenas verifica se hook foi criado sem erro
    expect(result.current).toBeDefined();
  });

  it('cria FolderSharingModule padrão quando não fornecido', async () => {
    // Não fornece folderSharingModule - deveria usar createDefaultFolderSharingModule()
    const { result } = await renderHook(() =>
      useReceivedFolderConfiguration({
        fileRepository: mockFileRepository,
      }),
    );

    // Apenas verifica se hook foi criado sem erro
    expect(result.current).toBeDefined();
  });

  it('atualiza configuredFolderUri quando seleção é concluída', async () => {
    const folderUri = 'content://com.example.update';
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

    expect(result.current.configuredFolderUri).toBe(folderUri);
    expect(result.current.error).toBeNull();
  });

  it('atualiza para null quando clearFolder é concluído', async () => {
    const initialUri = 'content://com.example.docs';
    mockFileRepository.getReceivedFolderUri.mockResolvedValue(initialUri);
    mockFileRepository.setReceivedFolderUri.mockResolvedValue(undefined);

    const { result } = await renderHook(() =>
      useReceivedFolderConfiguration({
        fileRepository: mockFileRepository,
        folderSharingModule: mockFolderSharingModule,
      }),
    );

    // Aguarda loading inicial
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(result.current.configuredFolderUri).toBe(initialUri);

    await act(async () => {
      await result.current.clearFolder();
    });

    expect(result.current.configuredFolderUri).toBeNull();
  });
});
