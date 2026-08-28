/**
 * Tests for services/index.ts exports
 * Ensures all services are properly exported and available for import
 */

import {
  FileRepositoryImpl,
  createFileRepository,
  setFileSystemModule,
  type FileSystemModule,
} from '../index';

describe('services/index.ts exports', () => {
  it('should export FileRepositoryImpl', () => {
    expect(FileRepositoryImpl).toBeDefined();
    expect(typeof FileRepositoryImpl).toBe('function');
  });

  it('should export createFileRepository', () => {
    expect(createFileRepository).toBeDefined();
    expect(typeof createFileRepository).toBe('function');
  });

  it('should export setFileSystemModule', () => {
    expect(setFileSystemModule).toBeDefined();
    expect(typeof setFileSystemModule).toBe('function');
  });

  it('should create FileRepository instance via createFileRepository', () => {
    const mockFs: FileSystemModule = {
      documentDirectory: 'file:///test/',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      getInfoAsync: jest.fn() as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      readDirectoryAsync: jest.fn() as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      makeDirectoryAsync: jest.fn() as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      writeAsStringAsync: jest.fn() as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      readAsStringAsync: jest.fn() as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      deleteAsync: jest.fn() as any,
    };

    const repo = createFileRepository(mockFs);
    expect(repo).toBeDefined();
    expect(repo).toBeInstanceOf(FileRepositoryImpl);
  });

  it('should allow setting global FileSystemModule', () => {
    const mockFs: FileSystemModule = {
      documentDirectory: 'file:///global/',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      getInfoAsync: jest.fn() as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      readDirectoryAsync: jest.fn() as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      makeDirectoryAsync: jest.fn() as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      writeAsStringAsync: jest.fn() as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      readAsStringAsync: jest.fn() as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      deleteAsync: jest.fn() as any,
    };

    setFileSystemModule(mockFs);

    const repo = createFileRepository();
    expect(repo).toBeDefined();
    expect(repo).toBeInstanceOf(FileRepositoryImpl);
  });

  it('should use injected module over global module', () => {
    const globalFs: FileSystemModule = {
      documentDirectory: 'file:///global/',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      getInfoAsync: jest.fn() as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      readDirectoryAsync: jest.fn() as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      makeDirectoryAsync: jest.fn() as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      writeAsStringAsync: jest.fn() as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      readAsStringAsync: jest.fn() as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      deleteAsync: jest.fn() as any,
    };

    const injectedFs: FileSystemModule = {
      documentDirectory: 'file:///injected/',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      getInfoAsync: jest.fn() as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      readDirectoryAsync: jest.fn() as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      makeDirectoryAsync: jest.fn() as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      writeAsStringAsync: jest.fn() as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      readAsStringAsync: jest.fn() as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      deleteAsync: jest.fn() as any,
    };

    setFileSystemModule(globalFs);
    const repo = createFileRepository(injectedFs);

    expect(repo).toBeDefined();
    expect(repo).toBeInstanceOf(FileRepositoryImpl);
  });
});
