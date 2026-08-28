import { useCallback } from 'react';
import * as DocumentPicker from 'expo-document-picker';
import { useSharedFilesStore } from '../store/sharedFilesStore';
import { createFileRepository } from '../services/fileRepositoryFactory';
import type { FileRepository, FileSystemModule } from '../services/fileRepository';

/**
 * Hook que orquestra seleção de arquivos via document picker,
 * salvamento no repositório e atualização do store.
 *
 * Responsabilidades:
 * - Abrir document picker (múltiplos arquivos)
 * - Para cada arquivo selecionado: copiar via saveFromUri() para 'shared'
 * - Popular o store com os arquivos adicionados
 * - Remover arquivo: chamar repository.remove() e atualizar store (otimista)
 *
 * Testes:
 * - Injetar mock de FileRepository e DocumentPicker
 * - Verificar que cancelar picker não muda lista
 * - Verificar que seleção adiciona arquivos ao store
 * - Verificar que remoção é imediata (otimista)
 */
interface UseSharedFilesOptions {
  /** Para injetar mock em testes. */
  fileRepository?: FileRepository;
  /** Para injetar mock de FileSystemModule em testes. */
  fileSystemModule?: FileSystemModule;
  /** Para injetar mock de DocumentPicker em testes. */
  documentPickerModule?: typeof DocumentPicker;
}

export function useSharedFiles(options?: UseSharedFilesOptions) {
  const store = useSharedFilesStore();
  const fileRepository = options?.fileRepository || createFileRepository(options?.fileSystemModule);
  const documentPickerModule = options?.documentPickerModule || DocumentPicker;

  /**
   * Abre o document picker e salva os arquivos selecionados como 'shared'.
   * Cancelar o picker não altera a lista.
   */
  const pickAndShareFiles = useCallback(async (): Promise<void> => {
    try {
      const result = await documentPickerModule.getDocumentAsync({
        multiple: true,
      });

      // Se cancelado, não fazer nada
      if (result.canceled) {
        return;
      }

      // Para cada asset selecionado, copiar para o repositório
      for (const asset of result.assets) {
        try {
          const entry = await fileRepository.saveFromUri(
            asset.uri,
            asset.name,
            asset.mimeType || 'application/octet-stream',
            asset.size || 0,
            'shared',
          );

          // Adicionar ao store
          store.addFile(entry);
        } catch (error) {
          console.error('[useSharedFiles] Erro ao salvar arquivo:', asset.name, error);
          // Continuar com próximo arquivo em caso de erro (não é fatal)
        }
      }
    } catch (error) {
      console.error('[useSharedFiles] Erro ao abrir document picker:', error);
      throw error;
    }
  }, [fileRepository, documentPickerModule, store]);

  /**
   * Remove um arquivo compartilhado pela id.
   * Operação otimista: remove do store imediatamente, depois do repositório.
   */
  const removeFile = useCallback(
    async (fileId: string): Promise<void> => {
      try {
        // Remover do store imediatamente (otimista)
        store.removeFile(fileId);

        // Remover do repositório
        await fileRepository.remove(fileId);
      } catch (error) {
        console.error('[useSharedFiles] Erro ao remover arquivo:', fileId, error);
        // Nota: arquivo já foi removido do store (otimista).
        // Em um app real, poderíamos re-adicionar ao store em caso de erro.
        throw error;
      }
    },
    [store, fileRepository],
  );

  /**
   * Carrega os arquivos 'shared' do repositório e popula o store.
   * Útil ao inicializar a tela ou refresh manual.
   */
  const loadSharedFiles = useCallback(async (): Promise<void> => {
    try {
      const entries = await fileRepository.list('shared');
      store.setFiles(entries);
    } catch (error) {
      console.error('[useSharedFiles] Erro ao carregar arquivos compartilhados:', error);
      throw error;
    }
  }, [fileRepository, store]);

  return {
    files: store.files,
    pickAndShareFiles,
    removeFile,
    loadSharedFiles,
  };
}
