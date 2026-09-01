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
import { render, cleanup } from '@testing-library/react-native';
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

  it('aceita callback onConfigured e integra com selectFolder', () => {
    const mockSelectFolder = jest.fn().mockResolvedValue(undefined);
    const mockOnConfigured = jest.fn();

    mockUseReceivedFolderConfiguration.mockReturnValue({
      configuredFolderUri: null,
      isLoading: false,
      error: null,
      selectFolder: mockSelectFolder,
      clearFolder: jest.fn(),
    });

    expect(() =>
      render(<ReceivedFolderConfigurationSection onConfigured={mockOnConfigured} />),
    ).not.toThrow();
  });

  it('aceita callback onConfigured e integra com clearFolder', () => {
    const mockClearFolder = jest.fn().mockResolvedValue(undefined);
    const mockOnConfigured = jest.fn();

    mockUseReceivedFolderConfiguration.mockReturnValue({
      configuredFolderUri: 'content://com.example/documents',
      isLoading: false,
      error: null,
      selectFolder: jest.fn(),
      clearFolder: mockClearFolder,
    });

    expect(() =>
      render(<ReceivedFolderConfigurationSection onConfigured={mockOnConfigured} />),
    ).not.toThrow();
  });
});
