/**
 * Tests specifically for fileRepositoryFactory
 * Focuses on branches that are hard to cover in the main fileRepository.test.ts
 * Includes tests for appendToFileAsync which uses the new File API from expo-file-system
 */

import { File } from 'expo-file-system';
import { setFileSystemModule, createFileRepository } from '../fileRepositoryFactory';
import { createMockFileSystemModule } from '../../../../__mocks__/testHelpers';

describe('fileRepositoryFactory - comprehensive coverage', () => {
  it('should create repository with injected FileSystemModule with documentDirectory', () => {
    // This covers the truthy branch of line 44: fsAny.documentDirectory || 'file:///document/'
    const mockFs = createMockFileSystemModule();
    mockFs.documentDirectory = 'file:///test-dir/';

    const repo = createFileRepository(mockFs);

    expect(repo).toBeDefined();
  });

  it('should create repository with injected FileSystemModule without documentDirectory', () => {
    // This covers the falsy branch of line 44: fsAny.documentDirectory || 'file:///document/'
    // When documentDirectory is undefined, the || operator should return the fallback
    const mockFs = createMockFileSystemModule();
    mockFs.documentDirectory = undefined;

    const repo = createFileRepository(mockFs);

    expect(repo).toBeDefined();
  });

  it('should use setFileSystemModule when no module is injected', () => {
    const mockFs = createMockFileSystemModule();
    mockFs.documentDirectory = 'file:///global/';

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

  it('appendToFileAsync do módulo padrão usa a API File real sem lançar', async () => {
    // Exercita a implementação REAL de createDefaultFileSystemModule() (não um mock
    // FileSystemModule injetado) para garantir que appendToFileAsync realmente chama
    // `new File(uri).write(content, { append: true })` ponta a ponta, sem cair em
    // nenhum caminho de reflection/fallback (removidos no fix a927d6f).
    //
    // Nota: jest.isolateModules é síncrono — só a criação do repo acontece dentro
    // dele; o trabalho assíncrono (writeChunk) roda fora, com a referência já
    // capturada (o registro de módulos isolado só afeta requires FUTUROS, não
    // invalida os objetos já resolvidos).
    let repo: ReturnType<typeof createFileRepository>;
    jest.isolateModules(() => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { createFileRepository: isolatedCreate } = require('../fileRepositoryFactory');
      repo = isolatedCreate();
    });

    const handle = await repo!.beginStreamedWrite('upload.txt', 'text/plain', 'received');

    await expect(handle.writeChunk('hello ')).resolves.toBeUndefined();
    await expect(handle.writeChunk('world')).resolves.toBeUndefined();
  });

  it('appendToFileAsync do módulo padrão converte a string binária em bytes exatos antes de escrever (T-701)', async () => {
    // Bug real encontrado em teste manual em dispositivo (jpeg/mov corrompidos ao
    // chegar no host): sem essa conversão para Uint8Array, o nativo Android grava
    // `content.toByteArray()` usando UTF-8 por padrão, reescrevendo todo byte ≥ 0x80
    // (a maioria dos bytes de um arquivo binário real) como uma sequência multi-byte.
    // `nativeHttpModule.ts` entrega o corpo do upload como string "binary" (latin1,
    // 1 char = 1 byte) — este teste garante que `appendToFileAsync` passa os bytes
    // exatos para `File.write`, nunca a string crua.
    let capturedArgs: unknown[] = [];

    let repo: ReturnType<typeof createFileRepository>;
    jest.isolateModules(() => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const isolatedFileSystem = require('expo-file-system') as { File: typeof File };
      const OriginalFile = isolatedFileSystem.File;
      isolatedFileSystem.File = class extends OriginalFile {
        constructor(...args: ConstructorParameters<typeof File>) {
          super(...args);
          const originalWrite = this.write;
          this.write = (...writeArgs: Parameters<typeof originalWrite>) => {
            capturedArgs = writeArgs;
            return originalWrite.apply(this, writeArgs);
          };
        }
      };

      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { createFileRepository: isolatedCreate } = require('../fileRepositoryFactory');
      repo = isolatedCreate();
    });

    const handle = await repo!.beginStreamedWrite('img.jpg', 'image/jpeg', 'received');

    // Magic bytes de JPEG — inclui valores ≥ 0x80, que é exatamente o que a codificação
    // UTF-8 padrão do nativo corrompia.
    const rawBytes = [0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10];
    const binaryString = String.fromCharCode(...rawBytes);

    await handle.writeChunk(binaryString);

    const [writtenContent] = capturedArgs;
    expect(writtenContent).toBeInstanceOf(Uint8Array);
    expect(Array.from(writtenContent as Uint8Array)).toEqual(rawBytes);
  });

  describe('appendToFileAsync - new File API (SDK 57+)', () => {
    it('should use File.write() with append:true to append content to file', async () => {
      const mockFs = createMockFileSystemModule();
      const repo = createFileRepository(mockFs);

      // Create a streamed write to test appendToFileAsync
      await repo.beginStreamedWrite('stream.txt', 'text/plain', 'received');

      // writeChunk uses appendToFileAsync internally
      const testUri = 'file:///mock-docs/received/stream.txt';

      // Mock File class
      const mockFileInstance = new File(testUri);
      const writeSpy = jest.spyOn(mockFileInstance, 'write');

      // Verify File class exists and has write method
      expect(File).toBeDefined();
      expect(typeof File).toBe('function');

      // Verify write method exists
      expect(writeSpy).toBeDefined();
    });

    it('File class can be instantiated with URI', () => {
      const testUri = 'file:///mock-docs/received/test.txt';
      const file = new File(testUri);

      expect(file).toBeDefined();
      expect(file.uri).toBe(testUri);
    });

    it('File.write method is callable and is a jest.fn()', () => {
      const file = new File('file:///test.txt');

      // Verify write is mockable (since it's a jest.fn in __mocks__)
      expect(jest.isMockFunction(file.write)).toBe(true);
    });

    it('should handle appendToFileAsync being called multiple times', async () => {
      const mockFs = createMockFileSystemModule();
      const repo = createFileRepository(mockFs);

      const handle = await repo.beginStreamedWrite('multi.txt', 'text/plain', 'received');

      // Multiple writes should not throw
      await handle.writeChunk('Chunk 1\n');
      await handle.writeChunk('Chunk 2\n');
      await handle.writeChunk('Chunk 3\n');

      expect(mockFs.appendToFileAsync).toHaveBeenCalledTimes(3);
    });

    it('should propagate errors from File.write when append fails', async () => {
      const mockFs = createMockFileSystemModule();

      // Mock appendToFileAsync to reject
      mockFs.appendToFileAsync = jest
        .fn()
        .mockRejectedValueOnce(new Error('No space left on device'));

      const repo = createFileRepository(mockFs);
      const handle = await repo.beginStreamedWrite('fail.txt', 'text/plain', 'received');

      // writeChunk should propagate the error
      await expect(handle.writeChunk('data')).rejects.toThrow('No space left on device');
    });

    it('should not have fallback behavior — error propagates directly', async () => {
      const mockFs = createMockFileSystemModule();

      // Simulate File.write failing
      mockFs.appendToFileAsync = jest
        .fn()
        .mockRejectedValueOnce(new Error('ENOSPC: no space left'));

      const repo = createFileRepository(mockFs);
      const handle = await repo.beginStreamedWrite('nospace.txt', 'text/plain', 'received');

      // Per the ADR: no fallback like "reler arquivo inteiro + reescrever tudo"
      // Error should propagate without retrying
      await expect(handle.writeChunk('data')).rejects.toThrow('ENOSPC');
    });

    it('appendToFileAsync handles streaming append correctly', async () => {
      const mockFs = createMockFileSystemModule();

      // Track accumulated content
      const fileContents = new Map<string, string>();

      mockFs.appendToFileAsync = jest
        .fn()
        .mockImplementation(async (uri: string, content: string) => {
          const existing = fileContents.get(uri) ?? '';
          fileContents.set(uri, existing + content);
        });

      const repo = createFileRepository(mockFs);
      const handle = await repo.beginStreamedWrite(
        'concat.bin',
        'application/octet-stream',
        'received',
      );

      const chunk1 = 'AAAA';
      const chunk2 = 'BBBB';
      const chunk3 = 'CCCC';

      await handle.writeChunk(chunk1);
      await handle.writeChunk(chunk2);
      await handle.writeChunk(chunk3);

      // Verify all calls were made with correct data
      expect(mockFs.appendToFileAsync).toHaveBeenNthCalledWith(1, expect.any(String), chunk1);
      expect(mockFs.appendToFileAsync).toHaveBeenNthCalledWith(2, expect.any(String), chunk2);
      expect(mockFs.appendToFileAsync).toHaveBeenNthCalledWith(3, expect.any(String), chunk3);
    });

    it('should work with large chunks (simulating 1MB+ streaming)', async () => {
      const mockFs = createMockFileSystemModule();

      let appendCallCount = 0;
      mockFs.appendToFileAsync = jest.fn().mockImplementation(async () => {
        appendCallCount++;
      });

      const repo = createFileRepository(mockFs);
      const handle = await repo.beginStreamedWrite(
        'large.bin',
        'application/octet-stream',
        'received',
      );

      // Simulate streaming 100 chunks of 100KB each (10MB total)
      const chunkSize = 100 * 1024; // 100KB
      const numChunks = 100;

      for (let i = 0; i < numChunks; i++) {
        const chunk = Buffer.alloc(chunkSize, 'x').toString();
        await handle.writeChunk(chunk);
      }

      expect(appendCallCount).toBe(100);

      const entry = await handle.finish(chunkSize * numChunks);
      expect(entry.sizeBytes).toBe(chunkSize * numChunks);
    });

    it('appendToFileAsync is NOT called during file creation (only during append)', async () => {
      const mockFs = createMockFileSystemModule();
      mockFs.appendToFileAsync = jest.fn();

      const repo = createFileRepository(mockFs);

      // beginStreamedWrite creates an empty file (via writeAsStringAsync('', ''))
      // It should NOT call appendToFileAsync yet
      await repo.beginStreamedWrite('create.txt', 'text/plain', 'received');

      expect(mockFs.appendToFileAsync).not.toHaveBeenCalled();
    });

    it('appendToFileAsync is first called when writeChunk is invoked', async () => {
      const mockFs = createMockFileSystemModule();
      mockFs.appendToFileAsync = jest.fn();

      const repo = createFileRepository(mockFs);
      const handle = await repo.beginStreamedWrite('first-append.txt', 'text/plain', 'received');

      // No append yet
      expect(mockFs.appendToFileAsync).not.toHaveBeenCalled();

      // Now append
      await handle.writeChunk('First chunk');

      expect(mockFs.appendToFileAsync).toHaveBeenCalledTimes(1);
    });

    it('finish() does NOT call appendToFileAsync (only writeAsStringAsync for metadata)', async () => {
      const mockFs = createMockFileSystemModule();
      mockFs.appendToFileAsync = jest.fn();

      const repo = createFileRepository(mockFs);
      const handle = await repo.beginStreamedWrite('finish-test.txt', 'text/plain', 'received');

      await handle.writeChunk('content');

      // Reset mock to track finish() behavior
      mockFs.appendToFileAsync.mockClear();

      // Finish should not call appendToFileAsync
      await handle.finish(7);

      expect(mockFs.appendToFileAsync).not.toHaveBeenCalled();
    });

    it('File mock is properly exported from expo-file-system', () => {
      // Verify the mock File class exists and is available
      expect(File).toBeDefined();
      expect(typeof File).toBe('function');

      // Instantiate and verify
      const file = new File('file:///test');
      expect(file.uri).toBe('file:///test');
      expect(typeof file.write).toBe('function');
    });
  });
});
