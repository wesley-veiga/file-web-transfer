/**
 * Hook para gerenciar a configuração da pasta de recebidos (T-802).
 *
 * Permite ao usuário escolher uma pasta externa (via SAF) onde os arquivos
 * recebidos serão salvos, e persistir essa escolha.
 */

import { useCallback, useState, useMemo, useEffect } from 'react';
import { createFileRepository } from '../services/fileRepositoryFactory';
import type { FileRepository, FileSystemModule } from '../services/fileRepository';
import {
  requestFolderAccess,
  createDefaultFolderSharingModule,
} from '../services/folderSharingService';
import type { FolderSharingModule } from '../services/folderSharingService';

interface UseReceivedFolderConfigurationOptions {
  /** Para injetar mock em testes. */
  fileRepository?: FileRepository;
  /** Para injetar mock de FileSystemModule em testes. */
  fileSystemModule?: FileSystemModule;
  /** Para injetar mock de FolderSharingModule (SAF) em testes. */
  folderSharingModule?: FolderSharingModule;
}

export interface UseReceivedFolderConfigurationReturn {
  /** URI da pasta configurada, ou null se nenhuma foi configurada */
  configuredFolderUri: string | null;
  /** true enquanto está carregando a configuração inicial */
  isLoading: boolean;
  /** Mensagem de erro, se houver */
  error: string | null;
  /** Abre o seletor de pasta do SAF e configura a pasta */
  selectFolder: () => Promise<void>;
  /** Remove a pasta configurada (volta a usar a sandbox) */
  clearFolder: () => Promise<void>;
}

export function useReceivedFolderConfiguration(
  options?: UseReceivedFolderConfigurationOptions,
): UseReceivedFolderConfigurationReturn {
  const fileRepository = useMemo(
    () => options?.fileRepository ?? createFileRepository(options?.fileSystemModule),
    [options?.fileRepository, options?.fileSystemModule],
  );

  const folderSharingModule = useMemo(
    () => options?.folderSharingModule ?? createDefaultFolderSharingModule(),
    [options?.folderSharingModule],
  );

  const [configuredFolderUri, setConfiguredFolderUri] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Carregar configuração inicial
  useEffect(() => {
    (async () => {
      try {
        const uri = await fileRepository.getReceivedFolderUri();
        setConfiguredFolderUri(uri);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Erro desconhecido';
        setError(message);
      } finally {
        setIsLoading(false);
      }
    })();
  }, [fileRepository]);

  const selectFolder = useCallback(async () => {
    setError(null);
    try {
      const folderUri = await requestFolderAccess(folderSharingModule);

      if (folderUri) {
        await fileRepository.setReceivedFolderUri(folderUri);
        setConfiguredFolderUri(folderUri);
      }
      // Se cancelado pelo usuário (folderUri === null), não atualiza nada
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao acessar a pasta';
      setError(message);
    }
  }, [fileRepository, folderSharingModule]);

  const clearFolder = useCallback(async () => {
    setError(null);
    try {
      await fileRepository.setReceivedFolderUri(null);
      setConfiguredFolderUri(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao limpar configuração';
      setError(message);
    }
  }, [fileRepository]);

  return {
    configuredFolderUri,
    isLoading,
    error,
    selectFolder,
    clearFolder,
  };
}
