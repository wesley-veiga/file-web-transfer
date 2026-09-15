/**
 * Test suite for ReceivedFolderConfigurationSection component (T-802).
 *
 * Tests all UI states and user interactions:
 * - Loading state
 * - No folder configured state
 * - Folder configured state
 * - Error message state
 * - selectFolder button press
 * - clearFolder button press
 */

import React from 'react';
import { render, cleanup, fireEvent, waitFor } from '@testing-library/react-native';
import { ReceivedFolderConfigurationSection } from '../ReceivedFolderConfigurationSection';
import { useReceivedFolderConfiguration } from '../../hooks/useReceivedFolderConfiguration';

jest.mock('../../hooks/useReceivedFolderConfiguration', () => ({
  useReceivedFolderConfiguration: jest.fn(),
}));

const mockUseReceivedFolderConfiguration = useReceivedFolderConfiguration as jest.MockedFunction<
  typeof useReceivedFolderConfiguration
>;

describe('ReceivedFolderConfigurationSection (T-802)', () => {
  beforeEach(() => {
    cleanup();
    jest.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('exibe indicador de carregamento quando isLoading = true', () => {
    mockUseReceivedFolderConfiguration.mockReturnValue({
      configuredFolderUri: null,
      isLoading: true,
      error: null,
      selectFolder: jest.fn(),
      clearFolder: jest.fn(),
    });

    expect(() => render(<ReceivedFolderConfigurationSection />)).not.toThrow();
  });

  it('exibe título e botão "Escolher Pasta" quando sem pasta configurada', () => {
    mockUseReceivedFolderConfiguration.mockReturnValue({
      configuredFolderUri: null,
      isLoading: false,
      error: null,
      selectFolder: jest.fn(),
      clearFolder: jest.fn(),
    });

    expect(() => render(<ReceivedFolderConfigurationSection />)).not.toThrow();
  });

  it('exibe pasta configurada com botões "Mudar Pasta" e "Limpar"', () => {
    mockUseReceivedFolderConfiguration.mockReturnValue({
      configuredFolderUri:
        'content://com.android.externalstorage.documents/tree/primary%3ADocuments',
      isLoading: false,
      error: null,
      selectFolder: jest.fn(),
      clearFolder: jest.fn(),
    });

    expect(() => render(<ReceivedFolderConfigurationSection />)).not.toThrow();
  });

  it('exibe caixa vermelha com mensagem de erro', () => {
    mockUseReceivedFolderConfiguration.mockReturnValue({
      configuredFolderUri: null,
      isLoading: false,
      error: 'Permissão negada para acessar pasta',
      selectFolder: jest.fn(),
      clearFolder: jest.fn(),
    });

    expect(() => render(<ReceivedFolderConfigurationSection />)).not.toThrow();
  });

  it('chama onConfigured quando selectFolder retorna true (pasta configurada com sucesso)', async () => {
    const mockSelectFolder = jest.fn().mockResolvedValue(true);
    const mockOnConfigured = jest.fn();

    mockUseReceivedFolderConfiguration.mockReturnValue({
      configuredFolderUri: null,
      isLoading: false,
      error: null,
      selectFolder: mockSelectFolder,
      clearFolder: jest.fn(),
    });

    const { getByText } = await render(
      <ReceivedFolderConfigurationSection onConfigured={mockOnConfigured} />,
    );

    fireEvent.press(getByText('Escolher Pasta'));

    await waitFor(() => expect(mockSelectFolder).toHaveBeenCalled());
    await waitFor(() => expect(mockOnConfigured).toHaveBeenCalledTimes(1));
  });

  it('NÃO chama onConfigured quando selectFolder retorna false (usuário cancelou o SAF)', async () => {
    // Regressão (achado em uso real, T-802/T-911): cancelar o seletor de pasta do SAF,
    // ou ele falhar, nunca deve fechar a seção de configuração — o usuário precisa
    // continuar vendo a tela (e, se houver, a mensagem de erro) em vez de ser jogado
    // de volta à tela de Receber sem explicação nenhuma.
    const mockSelectFolder = jest.fn().mockResolvedValue(false);
    const mockOnConfigured = jest.fn();

    mockUseReceivedFolderConfiguration.mockReturnValue({
      configuredFolderUri: null,
      isLoading: false,
      error: null,
      selectFolder: mockSelectFolder,
      clearFolder: jest.fn(),
    });

    const { getByText } = await render(
      <ReceivedFolderConfigurationSection onConfigured={mockOnConfigured} />,
    );

    fireEvent.press(getByText('Escolher Pasta'));

    await waitFor(() => expect(mockSelectFolder).toHaveBeenCalled());
    expect(mockOnConfigured).not.toHaveBeenCalled();
  });

  it('chama onConfigured quando clearFolder retorna true', async () => {
    const mockClearFolder = jest.fn().mockResolvedValue(true);
    const mockOnConfigured = jest.fn();

    mockUseReceivedFolderConfiguration.mockReturnValue({
      configuredFolderUri: 'content://com.example/documents',
      isLoading: false,
      error: null,
      selectFolder: jest.fn(),
      clearFolder: mockClearFolder,
    });

    const { getByText } = await render(
      <ReceivedFolderConfigurationSection onConfigured={mockOnConfigured} />,
    );

    fireEvent.press(getByText('Limpar'));

    await waitFor(() => expect(mockClearFolder).toHaveBeenCalled());
    await waitFor(() => expect(mockOnConfigured).toHaveBeenCalledTimes(1));
  });

  it('NÃO chama onConfigured quando clearFolder retorna false (erro ao limpar)', async () => {
    const mockClearFolder = jest.fn().mockResolvedValue(false);
    const mockOnConfigured = jest.fn();

    mockUseReceivedFolderConfiguration.mockReturnValue({
      configuredFolderUri: 'content://com.example/documents',
      isLoading: false,
      error: null,
      selectFolder: jest.fn(),
      clearFolder: mockClearFolder,
    });

    const { getByText } = await render(
      <ReceivedFolderConfigurationSection onConfigured={mockOnConfigured} />,
    );

    fireEvent.press(getByText('Limpar'));

    await waitFor(() => expect(mockClearFolder).toHaveBeenCalled());
    expect(mockOnConfigured).not.toHaveBeenCalled();
  });

  it('não lança quando onConfigured não é fornecido e selectFolder retorna true', async () => {
    const mockSelectFolder = jest.fn().mockResolvedValue(true);

    mockUseReceivedFolderConfiguration.mockReturnValue({
      configuredFolderUri: null,
      isLoading: false,
      error: null,
      selectFolder: mockSelectFolder,
      clearFolder: jest.fn(),
    });

    const { getByText } = await render(<ReceivedFolderConfigurationSection />);

    fireEvent.press(getByText('Escolher Pasta'));

    await waitFor(() => expect(mockSelectFolder).toHaveBeenCalled());
  });
});
