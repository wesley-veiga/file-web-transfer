/**
 * Testes de handlers do componente ReceivedFilesScreen (T-303).
 *
 * Testa:
 * - Estado vazio / com itens
 * - Carregamento ao montar (loadReceivedFiles)
 * - handleOpenPress: chama openFile, mostra Alert em erro
 * - handleSharePress: chama shareFile, mostra Alert em erro
 * - handleRemovePress: mostra Alert de confirmação, chama removeFile ao confirmar
 */

import React from 'react';
import { render, fireEvent, cleanup, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { ReceivedFilesScreen } from '../ReceivedFilesScreen';
import { useReceivedFilesStore } from '../../store/receivedFilesStore';
import { useReceivedFiles } from '../../hooks/useReceivedFiles';
import type { FileEntryDto } from '../../types';

jest.mock('../../hooks/useReceivedFiles', () => ({
  useReceivedFiles: jest.fn(),
}));
const mockUseReceivedFiles = useReceivedFiles as jest.MockedFunction<typeof useReceivedFiles>;

const createMockDto = (overrides?: Partial<FileEntryDto>): FileEntryDto => ({
  id: 'file-1',
  name: 'documento.pdf',
  sizeBytes: 2048,
  mimeType: 'application/pdf',
  createdAt: Date.now(),
  ...overrides,
});

describe('ReceivedFilesScreen handlers (T-303)', () => {
  let mockOpenFile: jest.Mock;
  let mockShareFile: jest.Mock;
  let mockRemoveFile: jest.Mock;
  let mockLoadReceivedFiles: jest.Mock;

  beforeEach(() => {
    cleanup();
    jest.clearAllMocks();

    mockOpenFile = jest.fn().mockResolvedValue(undefined);
    mockShareFile = jest.fn().mockResolvedValue(undefined);
    mockRemoveFile = jest.fn().mockResolvedValue(undefined);
    mockLoadReceivedFiles = jest.fn().mockResolvedValue(undefined);

    mockUseReceivedFiles.mockReturnValue({
      files: [],
      openFile: mockOpenFile,
      shareFile: mockShareFile,
      removeFile: mockRemoveFile,
      loadReceivedFiles: mockLoadReceivedFiles,
    });

    useReceivedFilesStore.setState({ files: [] });
  });

  afterEach(() => {
    cleanup();
  });

  describe('estado vazio', () => {
    it('exibe mensagem de lista vazia quando não há arquivos recebidos', async () => {
      const { getByText } = await render(<ReceivedFilesScreen />);

      expect(getByText('Nenhum arquivo recebido')).toBeTruthy();
      await waitFor(() => expect(mockLoadReceivedFiles).toHaveBeenCalled());
    });
  });

  describe('estado com itens', () => {
    it('exibe nome e tamanho de cada arquivo recebido', async () => {
      useReceivedFilesStore.setState({
        files: [createMockDto({ name: 'relatorio.pdf', sizeBytes: 1024 })],
      });

      const { getByText, queryByText } = await render(<ReceivedFilesScreen />);

      expect(getByText('relatorio.pdf')).toBeTruthy();
      expect(queryByText('Nenhum arquivo recebido')).toBeNull();
    });
  });

  describe('carregamento ao montar', () => {
    it('chama loadReceivedFiles ao montar a tela', async () => {
      await render(<ReceivedFilesScreen />);

      await waitFor(() => expect(mockLoadReceivedFiles).toHaveBeenCalledTimes(1));
    });
  });

  describe('handleOpenPress', () => {
    beforeEach(() => {
      useReceivedFilesStore.setState({
        files: [createMockDto({ id: 'file-42', name: 'foto.png' })],
      });
    });

    it('chama openFile com o id correto ao pressionar "Abrir"', async () => {
      const { getByText } = await render(<ReceivedFilesScreen />);

      fireEvent.press(getByText('Abrir').parent!);

      await waitFor(() => expect(mockOpenFile).toHaveBeenCalledWith('file-42'));
    });

    it('mostra Alert de erro quando openFile rejeita', async () => {
      const alertSpy = jest.spyOn(Alert, 'alert');
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      mockOpenFile.mockRejectedValueOnce(new Error('Open failed'));

      const { getByText } = await render(<ReceivedFilesScreen />);
      fireEvent.press(getByText('Abrir').parent!);

      await waitFor(() =>
        expect(alertSpy).toHaveBeenCalledWith('Erro', 'Não foi possível abrir "foto.png".'),
      );
      consoleErrorSpy.mockRestore();
    });
  });

  describe('handleSharePress', () => {
    beforeEach(() => {
      useReceivedFilesStore.setState({
        files: [createMockDto({ id: 'file-42', name: 'foto.png' })],
      });
    });

    it('chama shareFile com o id correto ao pressionar "Compartilhar"', async () => {
      const { getByText } = await render(<ReceivedFilesScreen />);

      fireEvent.press(getByText('Compartilhar').parent!);

      await waitFor(() => expect(mockShareFile).toHaveBeenCalledWith('file-42'));
    });

    it('mostra Alert de erro quando shareFile rejeita', async () => {
      const alertSpy = jest.spyOn(Alert, 'alert');
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      mockShareFile.mockRejectedValueOnce(new Error('Share failed'));

      const { getByText } = await render(<ReceivedFilesScreen />);
      fireEvent.press(getByText('Compartilhar').parent!);

      await waitFor(() =>
        expect(alertSpy).toHaveBeenCalledWith('Erro', 'Não foi possível compartilhar "foto.png".'),
      );
      consoleErrorSpy.mockRestore();
    });
  });

  describe('handleRemovePress', () => {
    beforeEach(() => {
      useReceivedFilesStore.setState({
        files: [createMockDto({ id: 'file-42', name: 'foto.png' })],
      });
    });

    it('mostra Alert de confirmação e chama removeFile ao confirmar "Remover"', async () => {
      const alertSpy = jest.spyOn(Alert, 'alert');
      const { getByText } = await render(<ReceivedFilesScreen />);

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
      const { getByText } = await render(<ReceivedFilesScreen />);

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

      const { getByText } = await render(<ReceivedFilesScreen />);
      fireEvent.press(getByText('Remover').parent!);

      const buttons = alertSpy.mock.calls[0][2] as { text: string; onPress?: () => void }[];
      const confirmBtn = buttons.find((b) => b.text === 'Remover');
      await confirmBtn!.onPress!();

      await waitFor(() => expect(consoleErrorSpy).toHaveBeenCalled());
      expect(alertSpy).toHaveBeenCalledWith('Erro', 'Não foi possível remover o arquivo.');
      consoleErrorSpy.mockRestore();
    });
  });
});
