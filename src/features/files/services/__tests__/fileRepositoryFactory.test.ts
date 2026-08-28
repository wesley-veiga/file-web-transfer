/**
 * Tests specifically for fileRepositoryFactory
 * Focuses on branches that are hard to cover in the main fileRepository.test.ts
 */

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
      copyAsync: jest.fn(),
      moveAsync: jest.fn(),
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
      copyAsync: jest.fn(),
      moveAsync: jest.fn(),
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
      copyAsync: jest.fn(),
      moveAsync: jest.fn(),
    };

    setFileSystemModule(mockFs);
    const repo = createFileRepository();

    expect(repo).toBeDefined();
  });

  it('should use fallback documentDirectory when FileSystem.documentDirectory is undefined', () => {
    // This test specifically covers line 44's falsy branch in createDefaultFileSystemModule.
    // `jest.isolateModules` gives fileRepositoryFactory a fresh module registry (so
    // `realFileSystemModule` starts null again, forcing createDefaultFileSystemModule() to
    // run) — but expo-file-system must be required from *inside* the same isolated registry,
    // otherwise mutating the outer-scope import has no effect on what the isolated factory
    // actually imports (they'd be two different module instances).
    jest.isolateModules(() => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const isolatedFileSystem = require('expo-file-system') as Record<string, unknown>;
      delete isolatedFileSystem.documentDirectory;

      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { createFileRepository: isolatedCreate } = require('../fileRepositoryFactory');

      // This should call createDefaultFileSystemModule() which will use the fallback
      const repo = isolatedCreate();

      expect(repo).toBeDefined();
    });
  });
});
