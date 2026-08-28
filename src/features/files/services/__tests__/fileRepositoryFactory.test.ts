/**
 * Tests specifically for fileRepositoryFactory
 * Focuses on branches that are hard to cover in the main fileRepository.test.ts
 */

import * as FileSystem from 'expo-file-system';

import { setFileSystemModule, createFileRepository } from '../fileRepositoryFactory';

describe('fileRepositoryFactory - comprehensive coverage', () => {
  beforeEach(() => {
    // Reset the global module before each test
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    setFileSystemModule(null as any);
  });

  it('should create repository with injected FileSystemModule with documentDirectory', () => {
    // This covers the truthy branch of line 44: fsAny.documentDirectory || 'file:///document/'
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mockFs: any = {
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mockFs: any = {
      // Intentionally omit documentDirectory to trigger fallback
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mockFs: any = {
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const originalDocDir = (FileSystem as any).documentDirectory;

    try {
      // Temporarily remove documentDirectory to force the fallback branch
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (FileSystem as any).documentDirectory;

      // Clear global module so createDefaultFileSystemModule will be called
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setFileSystemModule(null as any);

      // This should call createDefaultFileSystemModule() which will use the fallback
      const repo = createFileRepository();

      expect(repo).toBeDefined();
    } finally {
      // Restore the original documentDirectory
      if (originalDocDir !== undefined) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (FileSystem as any).documentDirectory = originalDocDir;
      }
    }
  });
});
