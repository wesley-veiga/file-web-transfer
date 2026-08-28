/**
 * Factory para criar instâncias de FileRepository com injeção de dependência.
 *
 * Uso:
 * - Produção: `createFileRepository()` sem argumentos (usa expo-file-system real via legacy API)
 * - Testes: `createFileRepository(mockFsModule)` com mock de __mocks__/expo-file-system.ts
 *
 * Em produção, importamos de `expo-file-system/legacy` (real); em testes, o mock cobrirá ambos.
 */

import * as FileSystem from 'expo-file-system';
import type * as FileSystemLegacy from 'expo-file-system/legacy';

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
 *
 * Em produção, FileSystem é carregado da API legacy; em testes, do mock que cobrirá ambos.
 * Usamos type cast para indicar ao TypeScript que o módulo runtime expõe a API legacy.
 */
function createDefaultFileSystemModule(): FileSystemModule {
  // Type cast para sinalizar que usamos API legacy (expo-file-system/legacy em produção, mock em testes)
  const fsLegacy = FileSystem as unknown as typeof FileSystemLegacy;

  return {
    documentDirectory: fsLegacy.documentDirectory ?? 'file:///document/',
    getInfoAsync: fsLegacy.getInfoAsync,
    readDirectoryAsync: fsLegacy.readDirectoryAsync,
    makeDirectoryAsync: fsLegacy.makeDirectoryAsync,
    writeAsStringAsync: fsLegacy.writeAsStringAsync,
    readAsStringAsync: fsLegacy.readAsStringAsync,
    deleteAsync: fsLegacy.deleteAsync,
  };
}
