/**
 * Handlers test suite for SharedFilesScreen component (T-302)
 *
 * Tests button press handlers and store wiring that execute real logic:
 * - handleSharePress: abre o document picker via pickAndShareFiles
 * - handleRemovePress: mostra Alert de confirmação e chama removeFile
 * - useEffect de carregamento: chama loadSharedFiles ao montar
 * - Estados vazio/com itens
 */

import React from 'react';
import { render, fireEvent, cleanup, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { SharedFilesScreen } from '../SharedFilesScreen';
import { useSharedFilesStore } from '../../store/sharedFilesStore';
import { useSharedFiles } from '../../hooks/useSharedFiles';
import type { FileEntryDto } from '../../types';

jest.mock('../../hooks/useSharedFiles', () => ({
  useSharedFiles: jest.fn(),
}));
jest.mock('@/shared/components', () => ({
  ...jest.requireActual('@/shared/components'),
  FileItemThumbnail: () => null,
}));

const mockUseSharedFiles = useSharedFiles as jest.MockedFunction<typeof useSharedFiles>;

const createMockDto = (overrides?: Partial<FileEntryDto>): FileEntryDto => ({
  id: 'file-1',
  name: 'documento.pdf',
  sizeBytes: 2048,
  mimeType: 'application/pdf',
  createdAt: Date.now(),
  ...overrides,
});

describe('SharedFilesScreen handlers (T-302)', () => {
  let mockPickAndShareFiles: jest.Mock;
  let mockRemoveFile: jest.Mock;
  let mockLoadSharedFiles: jest.Mock;

  beforeEach(() => {
    cleanup();
    jest.clearAllMocks();

    mockPickAndShareFiles = jest.fn().mockResolvedValue(undefined);
    mockRemoveFile = jest.fn().mockResolvedValue(undefined);
    mockLoadSharedFiles = jest.fn().mockResolvedValue(undefined);

    mockUseSharedFiles.mockReturnValue({
      files: [],
      pickAndShareFiles: mockPickAndShareFiles,
      removeFile: mockRemoveFile,
      loadSharedFiles: mockLoadSharedFiles,
      linkedFolderUri: null,
      linkedFolderEnabled: false,
      folderFiles: [],
      loadLinkedFolder: jest.fn().mockResolvedValue(undefined),
      pickFolder: jest.fn().mockResolvedValue(undefined),
      toggleLinkedFolder: jest.fn().mockResolvedValue(undefined),
    });

    useSharedFilesStore.setState({ files: [] });
  });

  afterEach(() => {
    cleanup();
  });

  describe('estado vazio', () => {
    it('exibe mensagem de lista vazia quando não há arquivos compartilhados', async () => {
      const { getByText } = await render(<SharedFilesScreen />);

      expect(getByText('Nenhum arquivo compartilhado')).toBeTruthy();
      await waitFor(() => expect(mockLoadSharedFiles).toHaveBeenCalled());
    });
  });

  describe('estado com itens', () => {
    it('exibe nome e tamanho de cada arquivo compartilhado', async () => {
      useSharedFilesStore.setState({
        files: [createMockDto({ name: 'relatorio.pdf', sizeBytes: 1024 })],
      });

      const { getByText, queryByText } = await render(<SharedFilesScreen />);

      expect(getByText('relatorio.pdf')).toBeTruthy();
      expect(queryByText('Nenhum arquivo compartilhado')).toBeNull();
    });
  });

  describe('carregamento ao montar', () => {
    it('chama loadSharedFiles ao montar a tela', async () => {
      await render(<SharedFilesScreen />);

      await waitFor(() => expect(mockLoadSharedFiles).toHaveBeenCalledTimes(1));
    });

    it('chama loadLinkedFolder ao montar a tela (T-701)', async () => {
      const mockLoadLinkedFolder = jest.fn().mockResolvedValue(undefined);
      mockUseSharedFiles.mockReturnValue({
        files: [],
        pickAndShareFiles: mockPickAndShareFiles,
        removeFile: mockRemoveFile,
        loadSharedFiles: mockLoadSharedFiles,
        linkedFolderUri: null,
        linkedFolderEnabled: false,
        folderFiles: [],
        loadLinkedFolder: mockLoadLinkedFolder,
        pickFolder: jest.fn().mockResolvedValue(undefined),
        toggleLinkedFolder: jest.fn().mockResolvedValue(undefined),
      });

      await render(<SharedFilesScreen />);

      await waitFor(() => expect(mockLoadLinkedFolder).toHaveBeenCalledTimes(1));
    });
  });

  describe('handleSharePress', () => {
    it('chama pickAndShareFiles ao pressionar "Compartilhar arquivos"', async () => {
      const { getByText } = await render(<SharedFilesScreen />);

      fireEvent.press(getByText('Compartilhar arquivos').parent!);

      await waitFor(() => expect(mockPickAndShareFiles).toHaveBeenCalled());
    });

    it('loga erro e mostra Alert quando pickAndShareFiles rejeita', async () => {
      const alertSpy = jest.spyOn(Alert, 'alert');
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      mockPickAndShareFiles.mockRejectedValueOnce(new Error('Picker failed'));

      const { getByText } = await render(<SharedFilesScreen />);
      fireEvent.press(getByText('Compartilhar arquivos').parent!);

      await waitFor(() => expect(consoleErrorSpy).toHaveBeenCalled());
      expect(alertSpy).toHaveBeenCalledWith(
        'Erro',
        'Não foi possível abrir o seletor de arquivos.',
      );
      consoleErrorSpy.mockRestore();
    });
  });

  describe('handleRemovePress', () => {
    beforeEach(() => {
      useSharedFilesStore.setState({
        files: [createMockDto({ id: 'file-42', name: 'foto.png' })],
      });
    });

    it('mostra Alert de confirmação e chama removeFile ao confirmar "Remover"', async () => {
      const alertSpy = jest.spyOn(Alert, 'alert');
      const { getByText } = await render(<SharedFilesScreen />);

      fireEvent.press(getByText('Remover').parent!);

      expect(alertSpy).toHaveBeenCalled();
      const [, message, buttons] = alertSpy.mock.calls[0] as [
        string,
        string,
        { text: string; onPress?: () => void }[],
      ];
      expect(message).toContain('foto.png');

      const confirmBtn = buttons.find((b) => b.text === 'Remover');
      await confirmBtn!.onPress!();

      expect(mockRemoveFile).toHaveBeenCalledWith('file-42');
    });

    it('não chama removeFile ao cancelar a confirmação', async () => {
      const alertSpy = jest.spyOn(Alert, 'alert');
      const { getByText } = await render(<SharedFilesScreen />);

      fireEvent.press(getByText('Remover').parent!);

      const buttons = alertSpy.mock.calls[0][2] as { text: string; onPress?: () => void }[];
      const cancelBtn = buttons.find((b) => b.text === 'Cancelar');

      expect(cancelBtn?.onPress).toBeUndefined();
      expect(mockRemoveFile).not.toHaveBeenCalled();
    });

    it('loga erro e mostra Alert quando removeFile rejeita', async () => {
      const alertSpy = jest.spyOn(Alert, 'alert');
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      mockRemoveFile.mockRejectedValueOnce(new Error('Remove failed'));

      const { getByText } = await render(<SharedFilesScreen />);
      fireEvent.press(getByText('Remover').parent!);

      const buttons = alertSpy.mock.calls[0][2] as { text: string; onPress?: () => void }[];
      const confirmBtn = buttons.find((b) => b.text === 'Remover');
      await confirmBtn!.onPress!();

      await waitFor(() => expect(consoleErrorSpy).toHaveBeenCalled());
      expect(alertSpy).toHaveBeenCalledWith('Erro', 'Não foi possível remover o arquivo.');
      consoleErrorSpy.mockRestore();
    });
  });

  describe('pasta vinculada (T-801 — compartilhar por pasta sem duplicar)', () => {
    const folderFile = {
      uri: 'content://.../foto.jpg',
      name: 'foto.jpg',
      mimeType: 'image/jpeg',
      sizeBytes: 2048,
    };

    it('mostra "Vincular pasta" quando nenhuma pasta está vinculada', async () => {
      const { getByText } = await render(<SharedFilesScreen />);

      expect(getByText('Vincular pasta')).toBeTruthy();
    });

    it('mostra "Trocar pasta" quando já há uma pasta vinculada', async () => {
      mockUseSharedFiles.mockReturnValue({
        files: [],
        pickAndShareFiles: mockPickAndShareFiles,
        removeFile: mockRemoveFile,
        loadSharedFiles: mockLoadSharedFiles,
        linkedFolderUri: 'content://tree/primary%3ADownload',
        linkedFolderEnabled: false,
        folderFiles: [],
        loadLinkedFolder: jest.fn().mockResolvedValue(undefined),
        pickFolder: jest.fn().mockResolvedValue(undefined),
        toggleLinkedFolder: jest.fn().mockResolvedValue(undefined),
      });

      const { getByText } = await render(<SharedFilesScreen />);

      expect(getByText('Trocar pasta')).toBeTruthy();
    });

    it('chama pickFolder ao pressionar "Vincular pasta"', async () => {
      const mockPickFolder = jest.fn().mockResolvedValue(undefined);
      mockUseSharedFiles.mockReturnValue({
        files: [],
        pickAndShareFiles: mockPickAndShareFiles,
        removeFile: mockRemoveFile,
        loadSharedFiles: mockLoadSharedFiles,
        linkedFolderUri: null,
        linkedFolderEnabled: false,
        folderFiles: [],
        loadLinkedFolder: jest.fn().mockResolvedValue(undefined),
        pickFolder: mockPickFolder,
        toggleLinkedFolder: jest.fn().mockResolvedValue(undefined),
      });

      const { getByText } = await render(<SharedFilesScreen />);
      fireEvent.press(getByText('Vincular pasta').parent!);

      await waitFor(() => expect(mockPickFolder).toHaveBeenCalled());
    });

    it('loga erro e mostra Alert quando pickFolder rejeita', async () => {
      const alertSpy = jest.spyOn(Alert, 'alert');
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      const mockPickFolder = jest.fn().mockRejectedValue(new Error('SAF failed'));
      mockUseSharedFiles.mockReturnValue({
        files: [],
        pickAndShareFiles: mockPickAndShareFiles,
        removeFile: mockRemoveFile,
        loadSharedFiles: mockLoadSharedFiles,
        linkedFolderUri: null,
        linkedFolderEnabled: false,
        folderFiles: [],
        loadLinkedFolder: jest.fn().mockResolvedValue(undefined),
        pickFolder: mockPickFolder,
        toggleLinkedFolder: jest.fn().mockResolvedValue(undefined),
      });

      const { getByText } = await render(<SharedFilesScreen />);
      fireEvent.press(getByText('Vincular pasta').parent!);

      await waitFor(() => expect(consoleErrorSpy).toHaveBeenCalled());
      expect(alertSpy).toHaveBeenCalledWith('Erro', 'Não foi possível vincular a pasta.');
      consoleErrorSpy.mockRestore();
    });

    it('não mostra a seção de arquivos da pasta quando nenhuma está vinculada', async () => {
      const { queryByText } = await render(<SharedFilesScreen />);

      expect(queryByText('Arquivos da pasta vinculada')).toBeNull();
    });

    it('lista os arquivos da pasta vinculada quando existe (T-801)', async () => {
      mockUseSharedFiles.mockReturnValue({
        files: [],
        pickAndShareFiles: mockPickAndShareFiles,
        removeFile: mockRemoveFile,
        loadSharedFiles: mockLoadSharedFiles,
        linkedFolderUri: 'content://tree/primary%3ADownload',
        linkedFolderEnabled: false,
        folderFiles: [folderFile],
        loadLinkedFolder: jest.fn().mockResolvedValue(undefined),
        pickFolder: jest.fn().mockResolvedValue(undefined),
        toggleLinkedFolder: jest.fn().mockResolvedValue(undefined),
      });

      const { getByText, queryByText } = await render(<SharedFilesScreen />);

      expect(getByText('Arquivos da pasta vinculada')).toBeTruthy();
      expect(getByText('foto.jpg')).toBeTruthy();
      // T-801: o botão de toggle é renderizado (seu label depende do status do servidor)
      expect(queryByText(/Habilitar|Desabilitar|Iniciar servidor/)).toBeTruthy();
    });

    it('mostra estado vazio quando a pasta vinculada não tem arquivos', async () => {
      mockUseSharedFiles.mockReturnValue({
        files: [],
        pickAndShareFiles: mockPickAndShareFiles,
        removeFile: mockRemoveFile,
        loadSharedFiles: mockLoadSharedFiles,
        linkedFolderUri: 'content://tree/primary%3ADownload',
        linkedFolderEnabled: false,
        folderFiles: [],
        loadLinkedFolder: jest.fn().mockResolvedValue(undefined),
        pickFolder: jest.fn().mockResolvedValue(undefined),
        toggleLinkedFolder: jest.fn().mockResolvedValue(undefined),
      });

      const { getByText } = await render(<SharedFilesScreen />);

      expect(getByText('Nenhum arquivo encontrado nessa pasta.')).toBeTruthy();
    });
  });
});
