import { create } from 'zustand';
import type { FileEntry, FileEntryDto } from '../types';

/**
 * Store Zustand para arquivos compartilhados pelo host.
 *
 * Mantém a lista de arquivos com origin 'shared' e fornece ações para
 * atualizar a lista (adicionar, remover, definir completamente).
 *
 * Também gerencia o estado da pasta vinculada (T-801 — "compartilhar por
 * pasta sem duplicar"): URI da pasta, IDs dos arquivos atualmente habilitados
 * dessa pasta, e toggle global para habilitar/desabilitar toda a pasta.
 *
 * Usa `FileEntryDto` como estado principal (sem `localUri`), mas tipos
 * também aceitam `FileEntry` em operações internas.
 */
interface SharedFilesStore {
  /** Lista de arquivos compartilhados (DTOs públicos). */
  files: FileEntryDto[];

  /** URI da pasta vinculada (T-801), ou null se nenhuma pasta foi vinculada. */
  linkedFolderUri: string | null;

  /**
   * `true` quando a pasta vinculada está HABILITADA para compartilhamento
   * (todos os arquivos da pasta são expostos na rota de download).
   * `false` quando está DESABILITADA (nenhum arquivo da pasta é expostos).
   * Quando false e houver arquivos da pasta no `files`, o comportamento
   * esperado é removê-los do compartilhamento.
   */
  linkedFolderEnabled: boolean;

  /** Adiciona um arquivo à lista de compartilhados. */
  addFile: (file: FileEntryDto | FileEntry) => void;

  /** Remove um arquivo da lista de compartilhados pelo id. */
  removeFile: (id: string) => void;

  /** Define a lista inteira de compartilhados (para popular do repositório). */
  setFiles: (files: (FileEntryDto | FileEntry)[]) => void;

  /** Limpa a lista (para resetar a sessão). */
  clearFiles: () => void;

  /** Define a URI da pasta vinculada (T-801). */
  setLinkedFolderUri: (uri: string | null) => void;

  /** Alterna o estado de habilitação da pasta vinculada (T-801). */
  toggleLinkedFolderEnabled: () => void;
}

/**
 * Converte um FileEntry para FileEntryDto (remove localUri).
 */
function toDto(file: FileEntryDto | FileEntry): FileEntryDto {
  const { localUri, origin, ...dto } = file as unknown as FileEntry;
  return dto as FileEntryDto;
}

export const useSharedFilesStore = create<SharedFilesStore>((set) => ({
  files: [],
  linkedFolderUri: null,
  linkedFolderEnabled: false,

  addFile: (file) => {
    set((state) => {
      const dto = toDto(file);
      // Não adicionar duplicata se já existir
      if (state.files.some((f) => f.id === dto.id)) {
        return state;
      }
      return {
        files: [dto, ...state.files], // Mais recente primeiro
      };
    });
  },

  removeFile: (id) => {
    set((state) => ({
      files: state.files.filter((f) => f.id !== id),
    }));
  },

  setFiles: (files) => {
    set({
      files: files.map(toDto),
    });
  },

  clearFiles: () => {
    set({
      files: [],
    });
  },

  setLinkedFolderUri: (uri) => {
    set({
      linkedFolderUri: uri,
    });
  },

  toggleLinkedFolderEnabled: () => {
    set((state) => ({
      linkedFolderEnabled: !state.linkedFolderEnabled,
    }));
  },
}));
