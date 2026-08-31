/**
 * Testes unitários para useSharedFilesStore (Zustand store de arquivos compartilhados).
 *
 * Testa:
 * - addFile: adiciona arquivo à lista, não duplica por id
 * - removeFile: remove arquivo da lista por id
 * - setFiles: substitui lista inteira, converte para DTO
 * - clearFiles: limpa a lista
 * - Conversão FileEntry → FileEntryDto (remove localUri e origin)
 */

import { useSharedFilesStore } from '../sharedFilesStore';
import type { FileEntry, FileEntryDto } from '../../types';

describe('useSharedFilesStore', () => {
  beforeEach(() => {
    // Limpar store entre testes
    useSharedFilesStore.setState({ files: [] });
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

      useSharedFilesStore.getState().addFile(file);

      expect(useSharedFilesStore.getState().files).toHaveLength(1);
      expect(useSharedFilesStore.getState().files[0]).toEqual(file);
    });

    it('deve aceitar FileEntry e remover localUri/origin no DTO', () => {
      const entry: FileEntry = {
        id: 'file-2',
        name: 'imagem.jpg',
        sizeBytes: 2048,
        mimeType: 'image/jpeg',
        localUri: 'file:///private/secret/imagem.jpg',
        origin: 'shared',
        createdAt: 1000,
      };

      useSharedFilesStore.getState().addFile(entry);

      expect(useSharedFilesStore.getState().files).toHaveLength(1);
      const dto = useSharedFilesStore.getState().files[0];

      // Verificar que localUri e origin foram removidos
      expect(dto).not.toHaveProperty('localUri');
      expect(dto).not.toHaveProperty('origin');

      // Verificar que campos públicos estão presentes
      expect(dto.id).toBe('file-2');
      expect(dto.name).toBe('imagem.jpg');
      expect(dto.sizeBytes).toBe(2048);
      expect(dto.mimeType).toBe('image/jpeg');
    });

    it('deve não duplicar arquivo com mesmo id', () => {
      const file1: FileEntryDto = {
        id: 'file-1',
        name: 'documento.pdf',
        sizeBytes: 1024,
        mimeType: 'application/pdf',
        createdAt: 1000,
      };

      const file2: FileEntryDto = {
        id: 'file-1', // Mesmo id
        name: 'outro-nome.pdf',
        sizeBytes: 2048,
        mimeType: 'application/pdf',
        createdAt: 2000,
      };

      useSharedFilesStore.getState().addFile(file1);
      useSharedFilesStore.getState().addFile(file2);

      // Deve ter apenas um arquivo (não duplicou)
      expect(useSharedFilesStore.getState().files).toHaveLength(1);
      expect(useSharedFilesStore.getState().files[0].name).toBe('documento.pdf'); // Mantém o original
    });

    it('deve adicionar múltiplos arquivos com ids diferentes', () => {
      const files = [
        {
          id: 'file-1',
          name: 'doc1.pdf',
          sizeBytes: 1024,
          mimeType: 'application/pdf',
          createdAt: 1000,
        },
        {
          id: 'file-2',
          name: 'doc2.pdf',
          sizeBytes: 2048,
          mimeType: 'application/pdf',
          createdAt: 2000,
        },
      ];

      useSharedFilesStore.getState().addFile(files[0]);
      useSharedFilesStore.getState().addFile(files[1]);

      expect(useSharedFilesStore.getState().files).toHaveLength(2);
      // Mais recente primeiro
      expect(useSharedFilesStore.getState().files[0].id).toBe('file-2');
      expect(useSharedFilesStore.getState().files[1].id).toBe('file-1');
    });
  });

  describe('removeFile', () => {
    it('deve remover arquivo pelo id', () => {
      const file: FileEntryDto = {
        id: 'file-1',
        name: 'documento.pdf',
        sizeBytes: 1024,
        mimeType: 'application/pdf',
        createdAt: 1000,
      };

      useSharedFilesStore.getState().addFile(file);
      expect(useSharedFilesStore.getState().files).toHaveLength(1);

      useSharedFilesStore.getState().removeFile('file-1');
      expect(useSharedFilesStore.getState().files).toHaveLength(0);
    });

    it('deve manter outros arquivos ao remover um', () => {
      const files = [
        {
          id: 'file-1',
          name: 'doc1.pdf',
          sizeBytes: 1024,
          mimeType: 'application/pdf',
          createdAt: 1000,
        },
        {
          id: 'file-2',
          name: 'doc2.pdf',
          sizeBytes: 2048,
          mimeType: 'application/pdf',
          createdAt: 2000,
        },
        {
          id: 'file-3',
          name: 'doc3.pdf',
          sizeBytes: 3072,
          mimeType: 'application/pdf',
          createdAt: 3000,
        },
      ];

      files.forEach((f) => useSharedFilesStore.getState().addFile(f));
      expect(useSharedFilesStore.getState().files).toHaveLength(3);

      useSharedFilesStore.getState().removeFile('file-2');

      expect(useSharedFilesStore.getState().files).toHaveLength(2);
      expect(useSharedFilesStore.getState().files.map((f) => f.id)).toEqual(['file-3', 'file-1']);
    });

    it('deve fazer nada ao remover id inexistente', () => {
      const file: FileEntryDto = {
        id: 'file-1',
        name: 'documento.pdf',
        sizeBytes: 1024,
        mimeType: 'application/pdf',
        createdAt: 1000,
      };

      useSharedFilesStore.getState().addFile(file);
      expect(useSharedFilesStore.getState().files).toHaveLength(1);

      // Tentar remover id inexistente não deve lançar erro
      useSharedFilesStore.getState().removeFile('id-inexistente');
      expect(useSharedFilesStore.getState().files).toHaveLength(1); // Mantém o arquivo original
    });
  });

  describe('setFiles', () => {
    it('deve definir lista de arquivos e converter para DTO', () => {
      const entries: FileEntry[] = [
        {
          id: 'file-1',
          name: 'doc1.pdf',
          sizeBytes: 1024,
          mimeType: 'application/pdf',
          localUri: 'file:///private/doc1.pdf',
          origin: 'shared',
          createdAt: 1000,
        },
        {
          id: 'file-2',
          name: 'doc2.pdf',
          sizeBytes: 2048,
          mimeType: 'application/pdf',
          localUri: 'file:///private/doc2.pdf',
          origin: 'shared',
          createdAt: 2000,
        },
      ];

      useSharedFilesStore.getState().setFiles(entries);

      expect(useSharedFilesStore.getState().files).toHaveLength(2);
      useSharedFilesStore.getState().files.forEach((file) => {
        expect(file).not.toHaveProperty('localUri');
        expect(file).not.toHaveProperty('origin');
      });
    });

    it('deve aceitar FileEntryDto diretamente', () => {
      const dtos: FileEntryDto[] = [
        {
          id: 'file-1',
          name: 'doc.pdf',
          sizeBytes: 1024,
          mimeType: 'application/pdf',
          createdAt: 1000,
        },
      ];

      useSharedFilesStore.getState().setFiles(dtos);
      expect(useSharedFilesStore.getState().files).toHaveLength(1);
      expect(useSharedFilesStore.getState().files[0]).toEqual(dtos[0]);
    });

    it('deve substituir lista inteira (não merge)', () => {
      const file1: FileEntryDto = {
        id: 'file-1',
        name: 'doc1.pdf',
        sizeBytes: 1024,
        mimeType: 'application/pdf',
        createdAt: 1000,
      };

      useSharedFilesStore.getState().addFile(file1);
      expect(useSharedFilesStore.getState().files).toHaveLength(1);

      const newFiles: FileEntryDto[] = [
        {
          id: 'file-2',
          name: 'doc2.pdf',
          sizeBytes: 2048,
          mimeType: 'application/pdf',
          createdAt: 2000,
        },
        {
          id: 'file-3',
          name: 'doc3.pdf',
          sizeBytes: 3072,
          mimeType: 'application/pdf',
          createdAt: 3000,
        },
      ];

      useSharedFilesStore.getState().setFiles(newFiles);
      expect(useSharedFilesStore.getState().files).toHaveLength(2);
      expect(useSharedFilesStore.getState().files.map((f) => f.id)).toEqual(['file-2', 'file-3']);
    });

    it('deve aceitar array vazio para limpar via setFiles', () => {
      const file: FileEntryDto = {
        id: 'file-1',
        name: 'doc.pdf',
        sizeBytes: 1024,
        mimeType: 'application/pdf',
        createdAt: 1000,
      };

      useSharedFilesStore.getState().addFile(file);
      expect(useSharedFilesStore.getState().files).toHaveLength(1);

      useSharedFilesStore.getState().setFiles([]);
      expect(useSharedFilesStore.getState().files).toHaveLength(0);
    });
  });

  describe('clearFiles', () => {
    it('deve limpar a lista de arquivos', () => {
      const files = [
        {
          id: 'file-1',
          name: 'doc1.pdf',
          sizeBytes: 1024,
          mimeType: 'application/pdf',
          createdAt: 1000,
        },
        {
          id: 'file-2',
          name: 'doc2.pdf',
          sizeBytes: 2048,
          mimeType: 'application/pdf',
          createdAt: 2000,
        },
      ];

      files.forEach((f) => useSharedFilesStore.getState().addFile(f));
      expect(useSharedFilesStore.getState().files).toHaveLength(2);

      useSharedFilesStore.getState().clearFiles();
      expect(useSharedFilesStore.getState().files).toHaveLength(0);
    });

    it('deve ser idempotente (chamar múltiplas vezes é seguro)', () => {
      const file: FileEntryDto = {
        id: 'file-1',
        name: 'doc.pdf',
        sizeBytes: 1024,
        mimeType: 'application/pdf',
        createdAt: 1000,
      };

      useSharedFilesStore.getState().addFile(file);
      useSharedFilesStore.getState().clearFiles();
      useSharedFilesStore.getState().clearFiles();
      useSharedFilesStore.getState().clearFiles();

      expect(useSharedFilesStore.getState().files).toHaveLength(0);
    });
  });

  describe('estado inicial', () => {
    it('deve iniciar com lista vazia', () => {
      useSharedFilesStore.setState({ files: [] });
      const state = useSharedFilesStore.getState();

      expect(state.files).toHaveLength(0);
      expect(Array.isArray(state.files)).toBe(true);
    });
  });

  describe('pasta vinculada (T-801 — linkedFolderUri e linkedFolderEnabled)', () => {
    beforeEach(() => {
      useSharedFilesStore.setState({
        files: [],
        linkedFolderUri: null,
        linkedFolderEnabled: false,
      });
    });

    describe('setLinkedFolderUri', () => {
      it('deve definir a URI da pasta vinculada', () => {
        const uri = 'content://tree/primary%3ADownload';

        useSharedFilesStore.getState().setLinkedFolderUri(uri);

        expect(useSharedFilesStore.getState().linkedFolderUri).toBe(uri);
      });

      it('deve aceitar null para limpar a URI', () => {
        const uri = 'content://tree/primary%3ADownload';

        useSharedFilesStore.getState().setLinkedFolderUri(uri);
        expect(useSharedFilesStore.getState().linkedFolderUri).toBe(uri);

        useSharedFilesStore.getState().setLinkedFolderUri(null);
        expect(useSharedFilesStore.getState().linkedFolderUri).toBeNull();
      });

      it('deve substituir a URI anterior quando chamado novamente', () => {
        const uri1 = 'content://tree/primary%3ADownload';
        const uri2 = 'content://tree/primary%3ADocuments';

        useSharedFilesStore.getState().setLinkedFolderUri(uri1);
        expect(useSharedFilesStore.getState().linkedFolderUri).toBe(uri1);

        useSharedFilesStore.getState().setLinkedFolderUri(uri2);
        expect(useSharedFilesStore.getState().linkedFolderUri).toBe(uri2);
      });

      it('não deve afetar o estado de linkedFolderEnabled', () => {
        useSharedFilesStore.setState({ linkedFolderEnabled: true });

        const uri = 'content://tree/primary%3ADownload';
        useSharedFilesStore.getState().setLinkedFolderUri(uri);

        expect(useSharedFilesStore.getState().linkedFolderEnabled).toBe(true);
        expect(useSharedFilesStore.getState().linkedFolderUri).toBe(uri);
      });

      it('não deve afetar a lista de arquivos', () => {
        const file: FileEntryDto = {
          id: 'file-1',
          name: 'doc.pdf',
          sizeBytes: 1024,
          mimeType: 'application/pdf',
          createdAt: 1000,
        };

        useSharedFilesStore.getState().addFile(file);
        expect(useSharedFilesStore.getState().files).toHaveLength(1);

        const uri = 'content://tree/primary%3ADownload';
        useSharedFilesStore.getState().setLinkedFolderUri(uri);

        expect(useSharedFilesStore.getState().files).toHaveLength(1);
        expect(useSharedFilesStore.getState().linkedFolderUri).toBe(uri);
      });
    });

    describe('toggleLinkedFolderEnabled', () => {
      it('deve ativar linkedFolderEnabled quando está false', () => {
        useSharedFilesStore.setState({ linkedFolderEnabled: false });
        expect(useSharedFilesStore.getState().linkedFolderEnabled).toBe(false);

        useSharedFilesStore.getState().toggleLinkedFolderEnabled();

        expect(useSharedFilesStore.getState().linkedFolderEnabled).toBe(true);
      });

      it('deve desativar linkedFolderEnabled quando está true', () => {
        useSharedFilesStore.setState({ linkedFolderEnabled: true });
        expect(useSharedFilesStore.getState().linkedFolderEnabled).toBe(true);

        useSharedFilesStore.getState().toggleLinkedFolderEnabled();

        expect(useSharedFilesStore.getState().linkedFolderEnabled).toBe(false);
      });

      it('deve alternar entre true e false múltiplas vezes', () => {
        useSharedFilesStore.setState({ linkedFolderEnabled: false });

        useSharedFilesStore.getState().toggleLinkedFolderEnabled(); // false → true
        expect(useSharedFilesStore.getState().linkedFolderEnabled).toBe(true);

        useSharedFilesStore.getState().toggleLinkedFolderEnabled(); // true → false
        expect(useSharedFilesStore.getState().linkedFolderEnabled).toBe(false);

        useSharedFilesStore.getState().toggleLinkedFolderEnabled(); // false → true
        expect(useSharedFilesStore.getState().linkedFolderEnabled).toBe(true);
      });

      it('não deve afetar linkedFolderUri', () => {
        const uri = 'content://tree/primary%3ADownload';
        useSharedFilesStore.setState({ linkedFolderUri: uri, linkedFolderEnabled: false });

        useSharedFilesStore.getState().toggleLinkedFolderEnabled();

        expect(useSharedFilesStore.getState().linkedFolderUri).toBe(uri);
        expect(useSharedFilesStore.getState().linkedFolderEnabled).toBe(true);
      });

      it('não deve afetar a lista de arquivos', () => {
        const file: FileEntryDto = {
          id: 'file-1',
          name: 'doc.pdf',
          sizeBytes: 1024,
          mimeType: 'application/pdf',
          createdAt: 1000,
        };

        useSharedFilesStore.getState().addFile(file);
        expect(useSharedFilesStore.getState().files).toHaveLength(1);

        useSharedFilesStore.getState().toggleLinkedFolderEnabled();

        expect(useSharedFilesStore.getState().files).toHaveLength(1);
        expect(useSharedFilesStore.getState().linkedFolderEnabled).toBe(true);
      });
    });

    describe('estado inicial da pasta vinculada', () => {
      it('deve iniciar com linkedFolderUri como null', () => {
        const state = useSharedFilesStore.getState();

        expect(state.linkedFolderUri).toBeNull();
      });

      it('deve iniciar com linkedFolderEnabled como false', () => {
        const state = useSharedFilesStore.getState();

        expect(state.linkedFolderEnabled).toBe(false);
      });
    });

    describe('interação entre linkedFolderUri e linkedFolderEnabled', () => {
      it('é possível ter URI sem estar habilitada (estado intermediário)', () => {
        const uri = 'content://tree/primary%3ADownload';

        useSharedFilesStore.getState().setLinkedFolderUri(uri);
        useSharedFilesStore.setState({ linkedFolderEnabled: false });

        const state = useSharedFilesStore.getState();
        expect(state.linkedFolderUri).toBe(uri);
        expect(state.linkedFolderEnabled).toBe(false);
      });

      it('é possível habilitar e desabilitar com URI presente', () => {
        const uri = 'content://tree/primary%3ADownload';
        useSharedFilesStore.getState().setLinkedFolderUri(uri);

        // Habilitar
        useSharedFilesStore.getState().toggleLinkedFolderEnabled();
        expect(useSharedFilesStore.getState().linkedFolderEnabled).toBe(true);
        expect(useSharedFilesStore.getState().linkedFolderUri).toBe(uri);

        // Desabilitar
        useSharedFilesStore.getState().toggleLinkedFolderEnabled();
        expect(useSharedFilesStore.getState().linkedFolderEnabled).toBe(false);
        expect(useSharedFilesStore.getState().linkedFolderUri).toBe(uri);
      });

      it('limpar URI não deve afetar estado de habilitação', () => {
        const uri = 'content://tree/primary%3ADownload';
        useSharedFilesStore.getState().setLinkedFolderUri(uri);
        useSharedFilesStore.getState().toggleLinkedFolderEnabled();

        expect(useSharedFilesStore.getState().linkedFolderEnabled).toBe(true);

        useSharedFilesStore.getState().setLinkedFolderUri(null);

        expect(useSharedFilesStore.getState().linkedFolderEnabled).toBe(true);
        expect(useSharedFilesStore.getState().linkedFolderUri).toBeNull();
      });
    });

    describe('persistência de estado entre operações', () => {
      it('deve manter linkedFolder quando addFile é chamado', () => {
        const uri = 'content://tree/primary%3ADownload';
        useSharedFilesStore.getState().setLinkedFolderUri(uri);
        useSharedFilesStore.getState().toggleLinkedFolderEnabled();

        const file: FileEntryDto = {
          id: 'file-1',
          name: 'doc.pdf',
          sizeBytes: 1024,
          mimeType: 'application/pdf',
          createdAt: 1000,
        };

        useSharedFilesStore.getState().addFile(file);

        expect(useSharedFilesStore.getState().linkedFolderUri).toBe(uri);
        expect(useSharedFilesStore.getState().linkedFolderEnabled).toBe(true);
        expect(useSharedFilesStore.getState().files).toHaveLength(1);
      });

      it('deve manter linkedFolder quando removeFile é chamado', () => {
        const uri = 'content://tree/primary%3ADownload';
        useSharedFilesStore.getState().setLinkedFolderUri(uri);
        useSharedFilesStore.getState().toggleLinkedFolderEnabled();

        const file: FileEntryDto = {
          id: 'file-1',
          name: 'doc.pdf',
          sizeBytes: 1024,
          mimeType: 'application/pdf',
          createdAt: 1000,
        };

        useSharedFilesStore.getState().addFile(file);
        useSharedFilesStore.getState().removeFile('file-1');

        expect(useSharedFilesStore.getState().linkedFolderUri).toBe(uri);
        expect(useSharedFilesStore.getState().linkedFolderEnabled).toBe(true);
        expect(useSharedFilesStore.getState().files).toHaveLength(0);
      });

      it('deve manter linkedFolder quando clearFiles é chamado', () => {
        const uri = 'content://tree/primary%3ADownload';
        useSharedFilesStore.getState().setLinkedFolderUri(uri);
        useSharedFilesStore.getState().toggleLinkedFolderEnabled();

        const file: FileEntryDto = {
          id: 'file-1',
          name: 'doc.pdf',
          sizeBytes: 1024,
          mimeType: 'application/pdf',
          createdAt: 1000,
        };

        useSharedFilesStore.getState().addFile(file);
        useSharedFilesStore.getState().clearFiles();

        expect(useSharedFilesStore.getState().linkedFolderUri).toBe(uri);
        expect(useSharedFilesStore.getState().linkedFolderEnabled).toBe(true);
        expect(useSharedFilesStore.getState().files).toHaveLength(0);
      });

      it('deve manter linkedFolder quando setFiles é chamado', () => {
        const uri = 'content://tree/primary%3ADownload';
        useSharedFilesStore.getState().setLinkedFolderUri(uri);
        useSharedFilesStore.getState().toggleLinkedFolderEnabled();

        const newFiles: FileEntryDto[] = [
          {
            id: 'file-2',
            name: 'doc2.pdf',
            sizeBytes: 2048,
            mimeType: 'application/pdf',
            createdAt: 2000,
          },
        ];

        useSharedFilesStore.getState().setFiles(newFiles);

        expect(useSharedFilesStore.getState().linkedFolderUri).toBe(uri);
        expect(useSharedFilesStore.getState().linkedFolderEnabled).toBe(true);
        expect(useSharedFilesStore.getState().files).toHaveLength(1);
      });
    });
  });
});
