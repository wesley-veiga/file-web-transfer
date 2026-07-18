/**
 * Mock manual do módulo `expo-file-system` (T-003 · Infra de testes).
 *
 * Jest carrega automaticamente qualquer arquivo em `__mocks__/<pacote>.ts` (adjacente a
 * `node_modules`) sempre que um teste importar esse pacote — não é necessário chamar
 * `jest.mock('expo-file-system')` manualmente. Ver https://jestjs.io/docs/manual-mocks.
 *
 * Cobre principalmente a API "clássica" (equivalente a `expo-file-system/legacy` no SDK 57+),
 * que é a forma mais simples de ler/escrever/apagar arquivos por URI — usada tipicamente pelas
 * features de upload/download (`features/transfer`, `features/files`). Também expõe stubs
 * mínimos de `File`/`Directory` (API nova do SDK 57+) para o caso de alguma feature futura
 * adotá-la; ajustem/estendam conforme a necessidade real de cada tarefa.
 *
 * Todas as funções são `jest.fn()` com uma implementação padrão "feliz" (sucesso, sem I/O real).
 * Em um teste específico, sobrescreva o comportamento com
 * `(FileSystem.readAsStringAsync as jest.Mock).mockResolvedValueOnce(...)` etc.
 */

export enum EncodingType {
  UTF8 = 'utf8',
  Base64 = 'base64',
}

export const documentDirectory = 'file:///mock-sandbox/documents/';
export const cacheDirectory = 'file:///mock-sandbox/cache/';
export const bundleDirectory = 'file:///mock-sandbox/bundle/';

export interface MockFileInfo {
  exists: boolean;
  uri: string;
  isDirectory: boolean;
  size: number;
  modificationTime: number;
}

export function createMockFileInfo(overrides: Partial<MockFileInfo> = {}): MockFileInfo {
  return {
    exists: true,
    uri: 'file:///mock-sandbox/documents/mock-file.txt',
    isDirectory: false,
    size: 0,
    modificationTime: 0,
    ...overrides,
  };
}

export const getInfoAsync = jest.fn(async (fileUri: string) => createMockFileInfo({ uri: fileUri }));

export const readAsStringAsync = jest.fn(async (_fileUri: string) => '');

export const writeAsStringAsync = jest.fn(async (_fileUri: string, _contents: string) => undefined);

export const deleteAsync = jest.fn(async (_fileUri: string) => undefined);

export const makeDirectoryAsync = jest.fn(async (_dirUri: string) => undefined);

export const readDirectoryAsync = jest.fn(async (_dirUri: string): Promise<string[]> => []);

export const copyAsync = jest.fn(async (_options: { from: string; to: string }) => undefined);

export const moveAsync = jest.fn(async (_options: { from: string; to: string }) => undefined);

export const getFreeDiskStorageAsync = jest.fn(async () => Number.MAX_SAFE_INTEGER);

// --- Stubs mínimos da API nova (File/Directory) — expandir quando alguma feature adotá-la. ---

export class Directory {
  uri: string;
  exists = true;

  constructor(...segments: (string | Directory)[]) {
    this.uri = segments.map((segment) => (segment instanceof Directory ? segment.uri : segment)).join('/');
  }

  create = jest.fn();
  delete = jest.fn();
  list = jest.fn(() => []);
}

export class File {
  uri: string;
  exists = true;
  size = 0;

  constructor(...segments: (string | Directory | File)[]) {
    this.uri = segments
      .map((segment) => (segment instanceof Directory || segment instanceof File ? segment.uri : segment))
      .join('/');
  }

  create = jest.fn();
  delete = jest.fn();
  text = jest.fn(async () => '');
  bytes = jest.fn(async () => new Uint8Array());
  write = jest.fn();
}

export const Paths = {
  document: new Directory(documentDirectory),
  cache: new Directory(cacheDirectory),
};
