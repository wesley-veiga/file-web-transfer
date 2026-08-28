/**
 * Factory para criar instâncias de FileRepository com injeção de dependência.
 *
 * Uso:
 * - Produção: `createFileRepository()` sem argumentos (usa expo-file-system real)
 * - Testes: `createFileRepository(mockFsModule)` com mock
 */

import * as FileSystem from 'expo-file-system';

import type { FileSystemModule, FileRepository } from './fileRepository';
import { FileRepositoryImpl } from './fileRepository';

// Placeholder para o módulo FileSystem real (será setado durante inicialização)
let realFileSystemModule: FileSystemModule | null = null;

/**
 * Define o módulo FileSystem real a ser usado em produção.
 * Será chamado uma vez durante a inicialização do app.
 */
export function setFileSystemModule(module: FileSystemModule): void {
  realFileSystemModule = module;
}

/**
 * Cria instância do FileRepository.
 *
 * @param fsModule Módulo FileSystem a usar (padrão: módulo real em produção)
 * @returns Nova instância de FileRepository
 */
export function createFileRepository(fsModule?: FileSystemModule): FileRepository {
  const module = fsModule ?? realFileSystemModule ?? createDefaultFileSystemModule();

  return new FileRepositoryImpl(module);
}

/**
 * Cria o módulo FileSystem padrão usando expo-file-system real.
 */
function createDefaultFileSystemModule(): FileSystemModule {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fsAny = FileSystem as any;
  return {
    documentDirectory: fsAny.documentDirectory || 'file:///document/',
    getInfoAsync: FileSystem.getInfoAsync,
    readDirectoryAsync: FileSystem.readDirectoryAsync,
    makeDirectoryAsync: FileSystem.makeDirectoryAsync,
    writeAsStringAsync: FileSystem.writeAsStringAsync,
    readAsStringAsync: FileSystem.readAsStringAsync,
    deleteAsync: FileSystem.deleteAsync,
  };
}
