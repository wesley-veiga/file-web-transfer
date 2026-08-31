/**
 * Helpers para criar mocks completos nas testes.
 *
 * Fornece factories para mocks de módulos que seguem as interfaces
 * do projeto, incluindo todos os métodos (novos e antigos).
 *
 * Uso:
 *   import { createMockHttpModule, createMockFileRepository } from '../__mocks__/testHelpers';
 *   const mockHttpModule = createMockHttpModule();
 *   const mockFileRepository = createMockFileRepository();
 */

import type { HttpModule, HttpServerResponse } from '../features/server/services/httpModule';
import type { FileRepository, FileSystemModule } from '../features/files/services/fileRepository';
import type { FileEntry } from '../features/files/types';

/**
 * Cria um mock completo do HttpModule com todos os métodos.
 */
export function createMockHttpModule(): jest.Mocked<HttpModule> {
  return {
    start: jest.fn(),
    stop: jest.fn(),
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addUploadListener: jest.fn(),
    removeUploadListener: jest.fn(),
    isRunning: jest.fn(() => false),
  };
}

/**
 * Cria um mock completo do FileRepository com todos os métodos.
 */
export function createMockFileRepository(): jest.Mocked<FileRepository> {
  return {
    save: jest.fn(),
    saveFromUri: jest.fn(),
    linkFromUri: jest.fn(),
    getLinkedFolderUri: jest.fn().mockResolvedValue(null),
    setLinkedFolderUri: jest.fn(),
    getReceivedFolderUri: jest.fn().mockResolvedValue(null),
    setReceivedFolderUri: jest.fn(),
    list: jest.fn(),
    remove: jest.fn(),
    toDto: jest.fn((entry: FileEntry) => ({
      id: entry.id,
      name: entry.name,
      sizeBytes: entry.sizeBytes,
      mimeType: entry.mimeType,
      createdAt: entry.createdAt,
    })),
    beginStreamedWrite: jest.fn(),
    moveReceivedFileToConfiguredFolder: jest
      .fn()
      .mockImplementation((entry) => Promise.resolve(entry)),
  };
}

/**
 * Cria um mock completo do FileSystemModule com todos os métodos.
 */
export function createMockFileSystemModule(): jest.Mocked<FileSystemModule> {
  return {
    documentDirectory: 'file:///document/',
    getInfoAsync: jest.fn(),
    readDirectoryAsync: jest.fn(),
    makeDirectoryAsync: jest.fn(),
    writeAsStringAsync: jest.fn(),
    readAsStringAsync: jest.fn(),
    deleteAsync: jest.fn(),
    copyAsync: jest.fn(),
    moveAsync: jest.fn(),
    appendToFileAsync: jest.fn(),
  };
}
