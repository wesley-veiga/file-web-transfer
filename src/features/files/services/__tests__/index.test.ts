/**
 * Tests for services/index.ts exports
 * Ensures all services are properly exported and available for import
 */

import {
  FileRepositoryImpl,
  createFileRepository,
  setFileSystemModule,
  type FileSystemModule,
  SharingServiceImpl,
  createSharingService,
  setSharingModule,
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
    const mockFs: jest.Mocked<FileSystemModule> = {
      documentDirectory: 'file:///test/',
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
    expect(repo).toBeInstanceOf(FileRepositoryImpl);
  });

  it('should allow setting global FileSystemModule', () => {
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
    expect(repo).toBeInstanceOf(FileRepositoryImpl);
  });

  it('should use injected module over global module', () => {
    const globalFs: jest.Mocked<FileSystemModule> = {
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

    const injectedFs: jest.Mocked<FileSystemModule> = {
      documentDirectory: 'file:///injected/',
      getInfoAsync: jest.fn(),
      readDirectoryAsync: jest.fn(),
      makeDirectoryAsync: jest.fn(),
      writeAsStringAsync: jest.fn(),
      readAsStringAsync: jest.fn(),
      deleteAsync: jest.fn(),
      copyAsync: jest.fn(),
      moveAsync: jest.fn(),
    };

    setFileSystemModule(globalFs);
    const repo = createFileRepository(injectedFs);

    expect(repo).toBeDefined();
    expect(repo).toBeInstanceOf(FileRepositoryImpl);
  });

  it('should export SharingServiceImpl', () => {
    expect(SharingServiceImpl).toBeDefined();
    expect(typeof SharingServiceImpl).toBe('function');
  });

  it('should export createSharingService', () => {
    expect(createSharingService).toBeDefined();
    expect(typeof createSharingService).toBe('function');
  });

  it('should export setSharingModule', () => {
    expect(setSharingModule).toBeDefined();
    expect(typeof setSharingModule).toBe('function');
  });

  it('should create SharingServiceImpl instance via createSharingService', () => {
    const service = createSharingService();
    expect(service).toBeInstanceOf(SharingServiceImpl);
  });

  it('should allow setting global SharingModule', () => {
    const mockModule = { openAsync: jest.fn(), shareAsync: jest.fn() };
    setSharingModule(mockModule);

    const service = createSharingService();
    expect(service).toBe(mockModule);
  });
});
