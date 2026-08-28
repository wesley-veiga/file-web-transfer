/**
 * Testes unitários para SharedFilesScreen.tsx (T-302).
 *
 * Testa:
 * - Renderização básica com diferentes estados
 */

import React from 'react';
import { render } from '@testing-library/react-native';
import { SharedFilesScreen } from '../SharedFilesScreen';
import type { FileRepository, FileSystemModule } from '../../services/fileRepository';
import type * as DocumentPicker from 'expo-document-picker';

describe('SharedFilesScreen Component', () => {
  describe('Renderização', () => {
    it('deve renderizar sem falhar com props vazias', () => {
      expect(() => render(<SharedFilesScreen />)).not.toThrow();
    });

    it('deve renderizar com fileRepository injetado', () => {
      const mockFileRepository = {
        save: jest.fn(),
        saveFromUri: jest.fn(),
        list: jest.fn(),
        remove: jest.fn(),
        toDto: jest.fn(),
      } as unknown as FileRepository;

      expect(() => render(<SharedFilesScreen fileRepository={mockFileRepository} />)).not.toThrow();
    });

    it('deve renderizar com fileSystemModule injetado', () => {
      const mockFileSystemModule = {
        documentDirectory: 'file:///mock/',
        getInfoAsync: jest.fn(),
        readDirectoryAsync: jest.fn(),
        makeDirectoryAsync: jest.fn(),
        writeAsStringAsync: jest.fn(),
        readAsStringAsync: jest.fn(),
        deleteAsync: jest.fn(),
        copyAsync: jest.fn(),
        moveAsync: jest.fn(),
      } as unknown as FileSystemModule;

      expect(() =>
        render(<SharedFilesScreen fileSystemModule={mockFileSystemModule} />),
      ).not.toThrow();
    });

    it('deve renderizar com documentPickerModule injetado', () => {
      const mockDocumentPickerModule = {
        getDocumentAsync: jest.fn(),
      } as unknown as typeof DocumentPicker;

      expect(() =>
        render(<SharedFilesScreen documentPickerModule={mockDocumentPickerModule} />),
      ).not.toThrow();
    });

    it('deve renderizar com todas as props injetadas', () => {
      const mockFileRepository = {
        save: jest.fn(),
        saveFromUri: jest.fn(),
        list: jest.fn(),
        remove: jest.fn(),
        toDto: jest.fn(),
      } as unknown as FileRepository;

      const mockFileSystemModule = {
        documentDirectory: 'file:///mock/',
        getInfoAsync: jest.fn(),
        readDirectoryAsync: jest.fn(),
        makeDirectoryAsync: jest.fn(),
        writeAsStringAsync: jest.fn(),
        readAsStringAsync: jest.fn(),
        deleteAsync: jest.fn(),
        copyAsync: jest.fn(),
        moveAsync: jest.fn(),
      } as unknown as FileSystemModule;

      const mockDocumentPickerModule = {
        getDocumentAsync: jest.fn(),
      } as unknown as typeof DocumentPicker;

      expect(() =>
        render(
          <SharedFilesScreen
            fileRepository={mockFileRepository}
            fileSystemModule={mockFileSystemModule}
            documentPickerModule={mockDocumentPickerModule}
          />,
        ),
      ).not.toThrow();
    });
  });
});
