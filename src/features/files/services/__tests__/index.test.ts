/**
 * Tests for services/index.ts exports
 * Ensures all services are properly exported and available for import
 */

import {
  FileRepositoryImpl,
  createFileRepository,
  setFileSystemModule,
  SharingServiceImpl,
  createSharingService,
  setSharingModule,
} from '../index';
import { createMockFileSystemModule } from '../../../../__mocks__/testHelpers';

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
    const mockFs = createMockFileSystemModule();
    mockFs.documentDirectory = 'file:///test/';

    const repo = createFileRepository(mockFs);
    expect(repo).toBeDefined();
    expect(repo).toBeInstanceOf(FileRepositoryImpl);
  });

  it('should allow setting global FileSystemModule', () => {
    const mockFs = createMockFileSystemModule();
    mockFs.documentDirectory = 'file:///global/';

    setFileSystemModule(mockFs);

    const repo = createFileRepository();
    expect(repo).toBeDefined();
    expect(repo).toBeInstanceOf(FileRepositoryImpl);
  });

  it('should use injected module over global module', () => {
    const globalFs = createMockFileSystemModule();
    globalFs.documentDirectory = 'file:///global/';

    const injectedFs = createMockFileSystemModule();
    injectedFs.documentDirectory = 'file:///injected/';

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
