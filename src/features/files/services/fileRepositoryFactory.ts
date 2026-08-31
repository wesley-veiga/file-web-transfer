/**
 * Factory para criar instâncias de FileRepository com injeção de dependência.
 *
 * Uso:
 * - Produção: `createFileRepository()` sem argumentos (usa expo-file-system real via legacy API)
 * - Testes: `createFileRepository(mockFsModule)` com mock de __mocks__/expo-file-system.ts
 *
 * Em produção, importamos de `expo-file-system/legacy` (real); em testes, o mock cobrirá ambos
 * (ver `moduleNameMapper['^expo-file-system/legacy$']` em `jest.config.js`).
 *
 * IMPORTANTE: `expo-file-system` (pacote base, sem `/legacy`) reexporta `readAsStringAsync`,
 * `getInfoAsync`, `writeAsStringAsync` etc. como stubs deprecados que SEMPRE lançam em runtime
 * (ver `node_modules/expo-file-system/src/legacyWarnings.ts`) — não são a API real. Importar
 * essas funções do pacote base (mesmo com type cast para `typeof FileSystemLegacy`) quebra em
 * produção silenciosamente, porque o TypeScript não detecta a troca de implementação por trás
 * do cast. É por isso que o import abaixo é de `expo-file-system/legacy` de verdade.
 */

import * as FileSystemLegacy from 'expo-file-system/legacy';
import { File } from 'expo-file-system';

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
  // Implementa appendToFileAsync usando a API nova de `expo-file-system` (classe
  // `File`, não `/legacy`), que suporta append de verdade via `write(content, { append: true })`.
  // Sem essa API, appendToFileAsync não teria como escrever incrementalmente sem
  // reler+reescrever o arquivo inteiro a cada chunk — o que reintroduziria o
  // problema de memória que o streaming existe para resolver. Por isso, ao
  // contrário do resto deste módulo, aqui NÃO há fallback silencioso: se
  // `File.write` falhar, o erro propaga (o chamador em `apiSetup.ts` já mapeia
  // isso para 500/507 conforme a mensagem).
  //
  // `content` chega aqui como uma string "binary" (latin1): cada char code é
  // exatamente um byte do corpo do upload (ver `nativeHttpModule.ts`, que lê o
  // socket com `chunk.toString('binary')`). Achado em T-701 (teste manual em
  // dispositivo real, jpeg/mov corrompidos ao chegar no host): passar essa
  // string diretamente para `File.write(string, ...)` faz o nativo Android
  // codificar `content.toByteArray()` como UTF-8 por padrão
  // (`FileSystemFile.kt`), reescrevendo todo byte ≥ 0x80 como uma sequência
  // multi-byte — corrompendo qualquer arquivo binário real. Convertendo para
  // `Uint8Array` antes de escrever, o nativo grava os bytes exatos
  // (`File.write(Uint8Array, ...)` não passa por nenhuma codificação de texto).
  async function appendToFileAsync(uri: string, content: string): Promise<void> {
    const file = new File(uri);
    const bytes = new Uint8Array(content.length);
    for (let i = 0; i < content.length; i++) {
      bytes[i] = content.charCodeAt(i) & 0xff;
    }
    await file.write(bytes, { append: true });
  }

  return {
    documentDirectory: FileSystemLegacy.documentDirectory ?? 'file:///document/',
    getInfoAsync: FileSystemLegacy.getInfoAsync,
    readDirectoryAsync: FileSystemLegacy.readDirectoryAsync,
    makeDirectoryAsync: FileSystemLegacy.makeDirectoryAsync,
    writeAsStringAsync: FileSystemLegacy.writeAsStringAsync,
    readAsStringAsync: FileSystemLegacy.readAsStringAsync,
    deleteAsync: FileSystemLegacy.deleteAsync,
    copyAsync: FileSystemLegacy.copyAsync,
    moveAsync: FileSystemLegacy.moveAsync,
    appendToFileAsync,
  };
}
