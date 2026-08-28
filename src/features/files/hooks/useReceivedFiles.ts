import { useCallback, useMemo } from 'react';
import { useReceivedFilesStore } from '../store/receivedFilesStore';
import { createFileRepository } from '../services/fileRepositoryFactory';
import { createSharingService } from '../services/sharingServiceFactory';
import type { FileRepository, FileSystemModule } from '../services/fileRepository';
import type { SharingModule } from '../services/sharingService';

/**
 * Hook que orquestra operações sobre arquivos recebidos:
 * - Carregar lista do repositório
 * - Abrir arquivo com app padrão
 * - Compartilhar arquivo via share sheet
 *
 * Responsabilidades:
 * - Carregar arquivos 'received' do repositório
 * - Fornecer `openFile()` e `shareFile()` que usam injeção de dependência
 * - Remover arquivo do repositório
 *
 * Testes:
 * - Injetar mock de FileRepository e SharingModule
 * - Verificar que loadReceivedFiles() popula o store
 * - Verificar que openFile() e shareFile() chamam o serviço correto
 */
interface UseReceivedFilesOptions {
  /** Para injetar mock em testes. */
  fileRepository?: FileRepository;
  /** Para injetar mock de FileSystemModule em testes. */
  fileSystemModule?: FileSystemModule;
  /** Para injetar mock de SharingModule em testes. */
  sharingModule?: SharingModule;
}

export function useReceivedFiles(options?: UseReceivedFilesOptions) {
  // Seletores individuais (mesmo padrão que useSharedFiles)
  const files = useReceivedFilesStore((state) => state.files);
  const removeFileFromStore = useReceivedFilesStore((state) => state.removeFile);
  const setFiles = useReceivedFilesStore((state) => state.setFiles);

  const fileRepository = useMemo(
    () => options?.fileRepository ?? createFileRepository(options?.fileSystemModule),
    [options?.fileRepository, options?.fileSystemModule],
  );

  const sharingService = useMemo(
    () => options?.sharingModule ?? createSharingService(options?.sharingModule),
    [options?.sharingModule],
  );

  /**
   * Carrega os arquivos 'received' do repositório e popula o store.
   * Útil ao inicializar a tela ou refresh manual.
   */
  const loadReceivedFiles = useCallback(async (): Promise<void> => {
    try {
      const entries = await fileRepository.list('received');
      setFiles(entries);
    } catch (error) {
      console.error('[useReceivedFiles] Erro ao carregar arquivos recebidos:', error);
      throw error;
    }
  }, [fileRepository, setFiles]);

  /**
   * Abre um arquivo recebido com o app padrão do sistema.
   * Requer que o arquivo tenha sido salvo com `localUri` no repositório.
   */
  const openFile = useCallback(
    async (fileId: string): Promise<void> => {
      try {
        // Buscar arquivo no repositório para obter localUri
        const allEntries = await fileRepository.list('received');
        const file = allEntries.find((f) => f.id === fileId);

        if (!file) {
          throw new Error(`Arquivo com id ${fileId} não encontrado`);
        }

        // Abrir arquivo
        await sharingService.openAsync(file.localUri);
      } catch (error) {
        console.error('[useReceivedFiles] Erro ao abrir arquivo:', fileId, error);
        throw error;
      }
    },
    [fileRepository, sharingService],
  );

  /**
   * Compartilha um arquivo recebido via share sheet do SO.
   * Requer que o arquivo tenha sido salvo com `localUri` no repositório.
   */
  const shareFile = useCallback(
    async (fileId: string): Promise<void> => {
      try {
        // Buscar arquivo no repositório para obter localUri
        const allEntries = await fileRepository.list('received');
        const file = allEntries.find((f) => f.id === fileId);

        if (!file) {
          throw new Error(`Arquivo com id ${fileId} não encontrado`);
        }

        // Compartilhar arquivo
        await sharingService.shareAsync(file.localUri);
      } catch (error) {
        console.error('[useReceivedFiles] Erro ao compartilhar arquivo:', fileId, error);
        throw error;
      }
    },
    [fileRepository, sharingService],
  );

  /**
   * Remove um arquivo recebido da lista e do repositório.
   * Operação otimista: remove do store imediatamente, depois do repositório.
   */
  const removeFile = useCallback(
    async (fileId: string): Promise<void> => {
      try {
        // Remover do store imediatamente (otimista)
        removeFileFromStore(fileId);

        // Remover do repositório
        await fileRepository.remove(fileId);
      } catch (error) {
        console.error('[useReceivedFiles] Erro ao remover arquivo:', fileId, error);
        throw error;
      }
    },
    [removeFileFromStore, fileRepository],
  );

  return {
    files,
    loadReceivedFiles,
    openFile,
    shareFile,
    removeFile,
  };
}
