/**
 * Testes unitários para useReceivedFilesStore (Zustand store de arquivos recebidos).
 *
 * Testa:
 * - addFile: adiciona arquivo à lista, não duplica por id, insere no início
 * - removeFile: remove arquivo da lista por id
 * - setFiles: substitui lista inteira, converte para DTO
 * - clearFiles: limpa a lista
 * - Conversão FileEntry → FileEntryDto (remove localUri e origin)
 */

import { useReceivedFilesStore } from '../receivedFilesStore';
import type { FileEntry, FileEntryDto } from '../../types';

describe('useReceivedFilesStore', () => {
  beforeEach(() => {
    useReceivedFilesStore.setState({ files: [] });
  });

  describe('addFile', () => {
    it('deve adicionar um arquivo à lista', () => {
      const file: FileEntryDto = {
        id: 'file-1',
        name: 'documento.pdf',
        sizeBytes: 1024,
        mimeType: 'application/pdf',
        createdAt: Date.now(),
      };

      useReceivedFilesStore.getState().addFile(file);

      expect(useReceivedFilesStore.getState().files).toHaveLength(1);
      expect(useReceivedFilesStore.getState().files[0]).toEqual(file);
    });

    it('deve aceitar FileEntry e remover localUri/origin no DTO', () => {
      const entry: FileEntry = {
        id: 'file-2',
        name: 'imagem.jpg',
        sizeBytes: 2048,
        mimeType: 'image/jpeg',
        localUri: 'file:///private/secret/imagem.jpg',
        origin: 'received',
        createdAt: 1000,
      };

      useReceivedFilesStore.getState().addFile(entry);

      const dto = useReceivedFilesStore.getState().files[0];
      expect(dto).not.toHaveProperty('localUri');
      expect(dto).not.toHaveProperty('origin');
      expect(dto.id).toBe('file-2');
      expect(dto.name).toBe('imagem.jpg');
    });

    it('não duplica arquivos com o mesmo id', () => {
      const file: FileEntryDto = {
        id: 'file-1',
        name: 'documento.pdf',
        sizeBytes: 1024,
        mimeType: 'application/pdf',
        createdAt: Date.now(),
      };

      useReceivedFilesStore.getState().addFile(file);
      useReceivedFilesStore.getState().addFile(file);

      expect(useReceivedFilesStore.getState().files).toHaveLength(1);
    });

    it('insere arquivos no início da lista (mais recente primeiro)', () => {
      const file1: FileEntryDto = {
        id: 'file-1',
        name: 'documento.pdf',
        sizeBytes: 1024,
        mimeType: 'application/pdf',
        createdAt: Date.now(),
      };
      const file2: FileEntryDto = {
        id: 'file-2',
        name: 'imagem.jpg',
        sizeBytes: 2048,
        mimeType: 'image/jpeg',
        createdAt: Date.now(),
      };

      useReceivedFilesStore.getState().addFile(file1);
      useReceivedFilesStore.getState().addFile(file2);

      expect(useReceivedFilesStore.getState().files).toEqual([file2, file1]);
    });
  });

  describe('removeFile', () => {
    it('remove o item certo pelo id, mantém os outros', () => {
      const file1: FileEntryDto = {
        id: 'file-1',
        name: 'documento.pdf',
        sizeBytes: 1024,
        mimeType: 'application/pdf',
        createdAt: Date.now(),
      };
      const file2: FileEntryDto = {
        id: 'file-2',
        name: 'imagem.jpg',
        sizeBytes: 2048,
        mimeType: 'image/jpeg',
        createdAt: Date.now(),
      };

      useReceivedFilesStore.getState().addFile(file1);
      useReceivedFilesStore.getState().addFile(file2);
      useReceivedFilesStore.getState().removeFile('file-1');

      expect(useReceivedFilesStore.getState().files).toEqual([file2]);
    });

    it('não quebra com id inexistente', () => {
      useReceivedFilesStore.getState().removeFile('non-existent-id');

      expect(useReceivedFilesStore.getState().files).toHaveLength(0);
    });
  });

  describe('setFiles', () => {
    it('substitui a lista inteira, convertendo cada item para DTO', () => {
      const entries: FileEntry[] = [
        {
          id: 'file-1',
          name: 'documento.pdf',
          sizeBytes: 1024,
          mimeType: 'application/pdf',
          localUri: 'file:///private/documento.pdf',
          origin: 'received',
          createdAt: 1000,
        },
        {
          id: 'file-2',
          name: 'imagem.jpg',
          sizeBytes: 2048,
          mimeType: 'image/jpeg',
          localUri: 'file:///private/imagem.jpg',
          origin: 'received',
          createdAt: 2000,
        },
      ];

      useReceivedFilesStore.getState().setFiles(entries);

      const files = useReceivedFilesStore.getState().files;
      expect(files).toHaveLength(2);
      expect(files[0]).not.toHaveProperty('localUri');
      expect(files[0]).not.toHaveProperty('origin');
    });

    it('esvazia a lista com setFiles([])', () => {
      const file: FileEntryDto = {
        id: 'file-1',
        name: 'documento.pdf',
        sizeBytes: 1024,
        mimeType: 'application/pdf',
        createdAt: Date.now(),
      };

      useReceivedFilesStore.getState().addFile(file);
      useReceivedFilesStore.getState().setFiles([]);

      expect(useReceivedFilesStore.getState().files).toHaveLength(0);
    });
  });

  describe('clearFiles', () => {
    it('zera files para []', () => {
      const file: FileEntryDto = {
        id: 'file-1',
        name: 'documento.pdf',
        sizeBytes: 1024,
        mimeType: 'application/pdf',
        createdAt: Date.now(),
      };

      useReceivedFilesStore.getState().addFile(file);
      useReceivedFilesStore.getState().clearFiles();

      expect(useReceivedFilesStore.getState().files).toHaveLength(0);
    });
  });
});
