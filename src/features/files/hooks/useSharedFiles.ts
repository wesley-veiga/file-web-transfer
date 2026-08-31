import { useCallback, useMemo, useRef, useState } from 'react';
import * as DocumentPicker from 'expo-document-picker';
import { useSharedFilesStore } from '../store/sharedFilesStore';
import { createFileRepository } from '../services/fileRepositoryFactory';
import type { FileRepository, FileSystemModule } from '../services/fileRepository';
import {
  createDefaultFolderSharingModule,
  requestFolderAccess,
  listFolderFiles,
} from '../services/folderSharingService';
import type { FolderSharingModule, FolderFile } from '../services/folderSharingService';
import type { FileEntry } from '../types';

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
  /** Para injetar mock de FolderSharingModule (SAF) em testes. */
  folderSharingModule?: FolderSharingModule;
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
  const folderSharingModule = useMemo(
    () => options?.folderSharingModule ?? createDefaultFolderSharingModule(),
    [options?.folderSharingModule],
  );

  // Estado da pasta vinculada (T-801 — compartilhar por pasta sem duplicar).
  const [folderFiles, setFolderFiles] = useState<FolderFile[]>([]);
  // Entradas `linked: true` atuais (com `localUri`, para casar com `folderFiles`).
  // Não vem do Zustand (`useSharedFilesStore`), que guarda só o DTO público (sem
  // `localUri`, por design — ver `sharedFilesStore.ts`); vem direto do repositório.
  const [linkedEntries, setLinkedEntries] = useState<FileEntry[]>([]);

  // Selecionar a URI da pasta do store (compartilhada entre instâncias do hook)
  const linkedFolderUri = useSharedFilesStore((state) => state.linkedFolderUri);
  const linkedFolderEnabled = useSharedFilesStore((state) => state.linkedFolderEnabled);
  const setLinkedFolderUri = useSharedFilesStore((state) => state.setLinkedFolderUri);
  const toggleLinkedFolderEnabled = useSharedFilesStore((state) => state.toggleLinkedFolderEnabled);

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
   * Carrega a URI da pasta vinculada (se houver) e lista seus arquivos
   * (T-801 — compartilhar por pasta sem duplicar).
   * Útil ao inicializar a tela.
   */
  const loadLinkedFolder = useCallback(async (): Promise<void> => {
    try {
      const [uri, sharedEntries] = await Promise.all([
        fileRepository.getLinkedFolderUri(),
        fileRepository.list('shared'),
      ]);
      setLinkedFolderUri(uri);
      setLinkedEntries(sharedEntries.filter((e) => e.linked));

      if (!uri) {
        setFolderFiles([]);
        return;
      }

      const listed = await listFolderFiles(folderSharingModule, uri);
      setFolderFiles(listed);
    } catch (error) {
      console.error('[useSharedFiles] Erro ao carregar pasta vinculada:', error);
      throw error;
    }
  }, [fileRepository, folderSharingModule, setLinkedFolderUri]);

  /**
   * Pede ao usuário para escolher uma pasta (SAF) e a vincula para
   * compartilhamento, sem copiar nenhum arquivo dela.
   * Não faz nada se o usuário negar/cancelar a permissão.
   * Nova pasta desabilita automaticamente a anterior (se houvesse).
   */
  const pickFolder = useCallback(async (): Promise<void> => {
    try {
      const uri = await requestFolderAccess(folderSharingModule);
      if (!uri) {
        return;
      }

      // Persistir no repositório
      await fileRepository.setLinkedFolderUri(uri);
      // Atualizar store
      setLinkedFolderUri(uri);

      const listed = await listFolderFiles(folderSharingModule, uri);
      setFolderFiles(listed);

      // Nova pasta começa desabilitada (requer toggle explícito do usuário)
      // Se não houver ainda arquivos vinculados, linkedEntries fica vazio
      setLinkedEntries([]);
    } catch (error) {
      console.error('[useSharedFiles] Erro ao vincular pasta:', error);
      throw error;
    }
  }, [fileRepository, folderSharingModule, setLinkedFolderUri]);

  /**
   * Alterna o estado de habilitação da pasta vinculada como um todo (T-801).
   *
   * Se desabilitando: remove TODOS os arquivos da pasta da lista de
   * compartilhados (via `removeFile` — nunca apaga os arquivos reais).
   *
   * Se habilitando: adiciona TODOS os arquivos da pasta à lista de
   * compartilhados (via `linkFromUri` — sem copiar).
   */
  const toggleLinkedFolder = useCallback(async (): Promise<void> => {
    try {
      // Alternar estado no store
      toggleLinkedFolderEnabled();

      // Se desabilitando
      if (linkedFolderEnabled) {
        // Remove todos os arquivos vinculados da pasta
        for (const entry of linkedEntries) {
          await removeFile(entry.id);
        }
        setLinkedEntries([]);
        return;
      }

      // Se habilitando: vincular todos os arquivos da pasta
      const newEntries: FileEntry[] = [];
      for (const file of folderFiles) {
        try {
          const entry = await fileRepository.linkFromUri(
            file.uri,
            file.name,
            file.mimeType,
            file.sizeBytes,
            'shared',
          );
          addFile(entry);
          newEntries.push(entry);
        } catch (error) {
          console.error('[useSharedFiles] Erro ao vincular arquivo da pasta:', file.name, error);
          // Continuar com próximo arquivo em caso de erro
        }
      }
      setLinkedEntries(newEntries);
    } catch (error) {
      console.error('[useSharedFiles] Erro ao alternar pasta vinculada:', error);
      throw error;
    }
  }, [
    linkedFolderEnabled,
    linkedEntries,
    folderFiles,
    fileRepository,
    addFile,
    removeFile,
    toggleLinkedFolderEnabled,
  ]);

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
    linkedFolderUri,
    linkedFolderEnabled,
    folderFiles,
    loadLinkedFolder,
    pickFolder,
    toggleLinkedFolder,
  };
}
