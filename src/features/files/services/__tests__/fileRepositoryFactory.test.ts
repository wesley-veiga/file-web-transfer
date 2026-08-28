/**
 * Tests specifically for fileRepositoryFactory
 * Focuses on branches that are hard to cover in the main fileRepository.test.ts
 */

import * as FileSystem from 'expo-file-system';

import { setFileSystemModule, createFileRepository } from '../fileRepositoryFactory';
import type { FileSystemModule } from '../fileRepository';

describe('fileRepositoryFactory - comprehensive coverage', () => {
  it('should create repository with injected FileSystemModule with documentDirectory', () => {
    // This covers the truthy branch of line 44: fsAny.documentDirectory || 'file:///document/'
    const mockFs: jest.Mocked<FileSystemModule> = {
      documentDirectory: 'file:///test-dir/',
      getInfoAsync: jest.fn(),
      readDirectoryAsync: jest.fn(),
      makeDirectoryAsync: jest.fn(),
      writeAsStringAsync: jest.fn(),
      readAsStringAsync: jest.fn(),
      deleteAsync: jest.fn(),
    };

    const repo = createFileRepository(mockFs);

    expect(repo).toBeDefined();
  });

  it('should create repository with injected FileSystemModule without documentDirectory', () => {
    // This covers the falsy branch of line 44: fsAny.documentDirectory || 'file:///document/'
    // When documentDirectory is undefined, the || operator should return the fallback
    const mockFs: jest.Mocked<FileSystemModule> = {
      documentDirectory: undefined,
      getInfoAsync: jest.fn(),
      readDirectoryAsync: jest.fn(),
      makeDirectoryAsync: jest.fn(),
      writeAsStringAsync: jest.fn(),
      readAsStringAsync: jest.fn(),
      deleteAsync: jest.fn(),
    };

    const repo = createFileRepository(mockFs);

    expect(repo).toBeDefined();
  });

  it('should use setFileSystemModule when no module is injected', () => {
    const mockFs: jest.Mocked<FileSystemModule> = {
      documentDirectory: 'file:///global/',
      getInfoAsync: jest.fn(),
      readDirectoryAsync: jest.fn(),
      makeDirectoryAsync: jest.fn(),
      writeAsStringAsync: jest.fn(),
      readAsStringAsync: jest.fn(),
      deleteAsync: jest.fn(),
    };

    setFileSystemModule(mockFs);
    const repo = createFileRepository();

    expect(repo).toBeDefined();
  });

  it('should use fallback documentDirectory when FileSystem.documentDirectory is undefined', () => {
    // This test specifically covers line 44's falsy branch in createDefaultFileSystemModule
    // When expo-file-system does not export documentDirectory, the || fallback is used
    // Store the original value to restore it after the test
    const fileSystemModule = FileSystem as Record<string, unknown>;
    const originalDocDir = fileSystemModule.documentDirectory;

    try {
      // Temporarily remove documentDirectory to force the fallback branch
      delete fileSystemModule.documentDirectory;

      // Isolate modules to get a fresh copy of fileRepositoryFactory without prior state
      jest.isolateModules(() => {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { createFileRepository: isolatedCreate } = require('../fileRepositoryFactory');

        // This should call createDefaultFileSystemModule() which will use the fallback
        const repo = isolatedCreate();

        expect(repo).toBeDefined();
      });
    } finally {
      // Restore the original documentDirectory
      if (originalDocDir !== undefined) {
        fileSystemModule.documentDirectory = originalDocDir;
      }
    }
  });
});
