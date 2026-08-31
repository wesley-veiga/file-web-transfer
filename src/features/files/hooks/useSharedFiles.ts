import { useCallback, useMemo, useRef } from 'react';
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
  // Seletores individuais, não o store inteiro: `useSharedFilesStore()` sem seletor
  // retorna um objeto novo a cada `set()` (Zustand recria o container no update), o que
  // desestabilizaria os `useCallback` abaixo a cada mudança de estado. As *ações* do
  // store, por outro lado, são definidas uma única vez em `create()` e nunca trocam de
  // identidade — selecioná-las individualmente mantém os callbacks estáveis entre
  // renders, o que é essencial para o `useEffect` de carregamento em
  // `SharedFilesScreen` não entrar em loop infinito.
  const files = useSharedFilesStore((state) => state.files);
  const addFile = useSharedFilesStore((state) => state.addFile);
  const removeFileFromStore = useSharedFilesStore((state) => state.removeFile);
  const setFiles = useSharedFilesStore((state) => state.setFiles);

  // `useMemo` evita recriar o repositório a cada render quando não injetado — mesma
  // razão: sem isso, os callbacks abaixo trocariam de identidade a cada render.
  const fileRepository = useMemo(
    () => options?.fileRepository ?? createFileRepository(options?.fileSystemModule),
    [options?.fileRepository, options?.fileSystemModule],
  );
  const documentPickerModule = options?.documentPickerModule || DocumentPicker;

  // Trava chamadas concorrentes ao picker nativo: `getDocumentAsync` rejeita com
  // "Different document picking in progress" se for chamado de novo antes da promise
  // anterior resolver (bug real encontrado em teste manual, T-701 — um segundo toque no
  // botão "Compartilhar arquivos" antes do picker fechar disparava a chamada duas vezes).
  // `useRef` (não state) porque não deve causar re-render, só servir de trava síncrona.
  const isPickingRef = useRef(false);

  /**
   * Abre o document picker e salva os arquivos selecionados como 'shared'.
   * Cancelar o picker não altera a lista.
   */
  const pickAndShareFiles = useCallback(async (): Promise<void> => {
    if (isPickingRef.current) {
      return;
    }
    isPickingRef.current = true;

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
          addFile(entry);
        } catch (error) {
          console.error('[useSharedFiles] Erro ao salvar arquivo:', asset.name, error);
          // Continuar com próximo arquivo em caso de erro (não é fatal)
        }
      }
    } catch (error) {
      console.error('[useSharedFiles] Erro ao abrir document picker:', error);
      throw error;
    } finally {
      isPickingRef.current = false;
    }
  }, [fileRepository, documentPickerModule, addFile]);

  /**
   * Remove um arquivo compartilhado pela id.
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
        console.error('[useSharedFiles] Erro ao remover arquivo:', fileId, error);
        // Nota: arquivo já foi removido do store (otimista).
        // Em um app real, poderíamos re-adicionar ao store em caso de erro.
        throw error;
      }
    },
    [removeFileFromStore, fileRepository],
  );

  /**
   * Carrega os arquivos 'shared' do repositório e popula o store.
   * Útil ao inicializar a tela ou refresh manual.
   */
  const loadSharedFiles = useCallback(async (): Promise<void> => {
    try {
      const entries = await fileRepository.list('shared');
      setFiles(entries);
    } catch (error) {
      console.error('[useSharedFiles] Erro ao carregar arquivos compartilhados:', error);
      throw error;
    }
  }, [fileRepository, setFiles]);

  return {
    files,
    pickAndShareFiles,
    removeFile,
    loadSharedFiles,
  };
}
