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
 * Em produção, usa API nova (`File`/`FileHandle`) de `expo-file-system` (SDK 57+)
 * para suportar operações de append eficiente (streaming upload).
 * Em testes, o mock cobrirá ambas as APIs.
 *
 * Conforme ADR-001 Seção 5: a escrita incremental é crítica para uploads streaming.
 * A API nova (`File.write()` com `{ append: true }`) permite isso sem bufferizar tudo em memória.
 * Ref: https://docs.expo.dev/versions/v57.0.0/sdk/filesystem/
 */
function createDefaultFileSystemModule(): FileSystemModule {
  // Type cast para sinalizar que usamos API legacy (expo-file-system/legacy em produção, mock em testes)
  const fsLegacy = FileSystem as unknown as typeof FileSystemLegacy;

  // Implementa appendToFileAsync usando a API nova de `expo-file-system`
  // SDK 57 fornece `File` class com suporte a append via `File.write(content, { append: true })`
  async function appendToFileAsync(uri: string, content: string): Promise<void> {
    try {
      // Tentar usar API nova: File class com write({ append: true })
      // Ref: https://docs.expo.dev/versions/v57.0.0/sdk/filesystem/
      const File = (FileSystem as unknown as Record<string, unknown>).File;

      if (typeof File === 'function') {
        // API nova disponível
        const file = new (File as new (uri: string) => unknown)(uri);
        const writeMethod = (file as Record<string, unknown>).write as
          ((content: string, options?: Record<string, unknown>) => Promise<void>) | undefined;

        if (writeMethod) {
          await writeMethod.call(file, content, { append: true });
          return;
        }
      }
    } catch {
      // Fallback: se API nova não está disponível, usa legacy
    }

    // Fallback: ler conteúdo existente, adicionar novo, escrever tudo (menos eficiente, mas funciona)
    // Nota: em produção, isso deve ser raro; API nova deve estar disponível em SDK 57+
    try {
      const existing = await fsLegacy.readAsStringAsync(uri);
      await fsLegacy.writeAsStringAsync(uri, existing + content);
    } catch {
      // Se o arquivo não existe, criar novo com o conteúdo
      await fsLegacy.writeAsStringAsync(uri, content);
    }
  }

  return {
    documentDirectory: fsLegacy.documentDirectory ?? 'file:///document/',
    getInfoAsync: fsLegacy.getInfoAsync,
    readDirectoryAsync: fsLegacy.readDirectoryAsync,
    makeDirectoryAsync: fsLegacy.makeDirectoryAsync,
    writeAsStringAsync: fsLegacy.writeAsStringAsync,
    readAsStringAsync: fsLegacy.readAsStringAsync,
    deleteAsync: fsLegacy.deleteAsync,
    copyAsync: fsLegacy.copyAsync,
    moveAsync: fsLegacy.moveAsync,
    appendToFileAsync,
  };
}
