import { create } from 'zustand';
import type { FileEntry, FileEntryDto } from '../types';

/**
 * Store Zustand para arquivos recebidos via upload.
 *
 * Mantém a lista de arquivos com origin 'received' e fornece ações para
 * atualizar a lista (adicionar, remover, definir completamente).
 *
 * Usa `FileEntryDto` como estado principal (sem `localUri`), mas tipos
 * também aceitam `FileEntry` em operações internas.
 */
interface ReceivedFilesStore {
  /** Lista de arquivos recebidos (DTOs públicos). */
  files: FileEntryDto[];

  /** Adiciona um arquivo à lista de recebidos. */
  addFile: (file: FileEntryDto | FileEntry) => void;

  /** Remove um arquivo da lista de recebidos pelo id. */
  removeFile: (id: string) => void;

  /** Define a lista inteira de recebidos (para popular do repositório). */
  setFiles: (files: (FileEntryDto | FileEntry)[]) => void;

  /** Limpa a lista (para resetar a sessão). */
  clearFiles: () => void;
}

/**
 * Converte um FileEntry para FileEntryDto (remove localUri).
 */
function toDto(file: FileEntryDto | FileEntry): FileEntryDto {
  const { localUri, origin, ...dto } = file as unknown as FileEntry;
  return dto as FileEntryDto;
}

export const useReceivedFilesStore = create<ReceivedFilesStore>((set) => ({
  files: [],

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
}));
