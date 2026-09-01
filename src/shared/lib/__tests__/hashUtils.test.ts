/**
 * Testes unitários para utilitários de hash SHA-256.
 *
 * Testa:
 * - hashSha256: cálculo de hash SHA-256
 * - hashesEqual: comparar hashes com case-insensitivity
 *
 * Nota: expo-crypto é mocado para testes (módulo nativo não funciona em Jest).
 * Em produção, usa API real do Expo.
 */

// jest.mock() deve estar no topo (requer require() que é nativo em Jest)
jest.mock('expo-crypto', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const crypto = require('crypto');

  return {
    digestStringAsync: jest.fn(async (_algorithm: unknown, data: string, _options: unknown) => {
      // Simular SHA-256: gerar hash base64 determinístico da string
      // Isso é um mock para testes; em produção, usa API real do Expo
      const hash = crypto.createHash('sha256').update(data).digest('base64');
      return hash;
    }),
    CryptoDigestAlgorithm: {
      SHA256: 'SHA256',
    },
    CryptoEncoding: {
      BASE64: 'BASE64',
    },
  };
});

// eslint-disable-next-line import/first
import { createHash } from 'crypto';
// eslint-disable-next-line import/first
import {
  hashSha256,
  hashesEqual,
  IncrementalSha256,
  hashFileSha256,
  type HashableFileSystem,
} from '../hashUtils';

describe('hashUtils', () => {
  describe('hashSha256', () => {
    it('deve retornar uma string (placeholder) quando chamado com string', async () => {
      const result = await hashSha256('conteúdo de teste');

      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });

    it('deve retornar uma string (placeholder) quando chamado com Buffer', async () => {
      const buffer = Buffer.from('conteúdo de teste');
      const result = await hashSha256(buffer);

      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });

    it('deve retornar sempre uma string (hex)', async () => {
      const result1 = await hashSha256('teste1');
      const result2 = await hashSha256('teste2');

      expect(typeof result1).toBe('string');
      expect(typeof result2).toBe('string');
      // Strings não deveriam estar vazias
      expect(result1.length).toBeGreaterThan(0);
      expect(result2.length).toBeGreaterThan(0);
    });

    it('deve ser determinístico (mesma entrada, mesmo resultado)', async () => {
      const input = 'conteúdo fixo para teste de determinismo';
      const hash1 = await hashSha256(input);
      const hash2 = await hashSha256(input);

      expect(hash1).toBe(hash2);
    });

    it('deve produzir hashes diferentes para entradas diferentes', async () => {
      const hash1 = await hashSha256('entrada 1');
      const hash2 = await hashSha256('entrada 2');

      expect(hash1).not.toBe(hash2);
    });

    it('deve lidar com string vazia', async () => {
      const result = await hashSha256('');

      expect(typeof result).toBe('string');
    });

    it('deve lidar com Buffer vazio', async () => {
      const emptyBuffer = Buffer.from('');
      const result = await hashSha256(emptyBuffer);

      expect(typeof result).toBe('string');
    });

    it('deve lidar com string com caracteres especiais', async () => {
      const result = await hashSha256('🔐 café français');

      expect(typeof result).toBe('string');
    });

    it('deve lidar com Buffer de tamanho grande', async () => {
      const largeBuffer = Buffer.alloc(1024 * 1024); // 1 MB
      largeBuffer.fill('a');

      const result = await hashSha256(largeBuffer);

      expect(typeof result).toBe('string');
    });

    it('deve ser assíncrono (retornar Promise)', () => {
      const result = hashSha256('teste');

      expect(result).toBeInstanceOf(Promise);
    });

    it('deve resolver corretamente com await', async () => {
      const hash = await hashSha256('teste');

      expect(typeof hash).toBe('string');
    });
  });

  describe('hashesEqual', () => {
    it('deve retornar true para hashes iguais (mesma case)', () => {
      const hash1 = 'abc123def456';
      const hash2 = 'abc123def456';

      expect(hashesEqual(hash1, hash2)).toBe(true);
    });

    it('deve retornar true para hashes iguais (case-insensitive)', () => {
      const hash1 = 'ABC123DEF456';
      const hash2 = 'abc123def456';

      expect(hashesEqual(hash1, hash2)).toBe(true);
    });

    it('deve retornar false para hashes diferentes', () => {
      const hash1 = 'abc123def456';
      const hash2 = 'xyz789aaa000';

      expect(hashesEqual(hash1, hash2)).toBe(false);
    });

    it('deve lidar com strings vazias', () => {
      expect(hashesEqual('', '')).toBe(true);
      expect(hashesEqual('', 'abc123')).toBe(false);
    });

    it('deve ser case-insensitive com SHA-256 típicos', () => {
      // Exemplo de hash SHA-256 típico
      const hash1 = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
      const hash2 = 'E3B0C44298FC1C149AFBF4C8996FB92427AE41E4649B934CA495991B7852B855';

      expect(hashesEqual(hash1, hash2)).toBe(true);
    });

    it('deve comparar corretamente hashes com tamanho diferente', () => {
      expect(hashesEqual('abc', 'abcd')).toBe(false);
      expect(hashesEqual('abc', 'abc')).toBe(true);
    });

    it('deve ser sensível a diferenças de conteúdo mesmo com case diferente', () => {
      expect(hashesEqual('abcd', 'abce')).toBe(false);
      expect(hashesEqual('ABCD', 'abce')).toBe(false);
    });

    it('deve lidar com hashes muito longos', () => {
      const longHash = 'a'.repeat(256);
      const longHash2 = 'a'.repeat(256);
      const longHash3 = 'b'.repeat(256);

      expect(hashesEqual(longHash, longHash2)).toBe(true);
      expect(hashesEqual(longHash, longHash3)).toBe(false);
    });

    it('deve ser simétrico: hashesEqual(a, b) === hashesEqual(b, a)', () => {
      const hash1 = 'ABC123';
      const hash2 = 'abc123';

      expect(hashesEqual(hash1, hash2)).toBe(hashesEqual(hash2, hash1));
    });

    it('deve comparar hashes com números hexadecimais', () => {
      const hex1 = '0123456789abcdef';
      const hex2 = '0123456789ABCDEF';

      expect(hashesEqual(hex1, hex2)).toBe(true);
    });
  });

  describe('integração entre hashSha256 e hashesEqual', () => {
    it('deve ser possível comparar resultados de hashSha256', async () => {
      const input = 'mesmo conteúdo para teste';
      const hash1 = await hashSha256(input);
      const hash2 = await hashSha256(input);

      expect(hashesEqual(hash1, hash2)).toBe(true);
    });

    it('deve retornar false ao comparar hashes de entradas diferentes', async () => {
      const hash1 = await hashSha256('entrada A');
      const hash2 = await hashSha256('entrada B');

      expect(hashesEqual(hash1, hash2)).toBe(false);
    });

    it('deve validar arquivo original vs arquivo baixado (caso de uso T-801)', async () => {
      // Simular verificação de integridade: hash do arquivo original deve
      // ser igual ao hash do arquivo baixado pelo convidado
      const originalFileContent = 'conteúdo original do arquivo compartilhado';
      const downloadedFileContent = 'conteúdo original do arquivo compartilhado';
      const corruptedFileContent = 'conteúdo corrompido do arquivo';

      const originalHash = await hashSha256(originalFileContent);
      const downloadedHash = await hashSha256(downloadedFileContent);
      const corruptedHash = await hashSha256(corruptedFileContent);

      // Arquivo baixado intacto: hashes são iguais
      expect(hashesEqual(originalHash, downloadedHash)).toBe(true);

      // Arquivo corrompido: hashes são diferentes
      expect(hashesEqual(originalHash, corruptedHash)).toBe(false);
    });
  });

  /**
   * Testes formais de `IncrementalSha256` e `hashFileSha256` (T-805).
   *
   * `IncrementalSha256` é uma implementação própria de SHA-256 puro
   * TypeScript (não usa `expo-crypto`, que não expõe API incremental — ver
   * comentário da classe em `hashUtils.ts`). Por isso estes testes comparam
   * diretamente contra `crypto.createHash('sha256')` do Node (implementação
   * de referência), em vez de depender do mock de `expo-crypto` do topo
   * deste arquivo (que só é usado por `hashSha256`).
   */
  describe('IncrementalSha256', () => {
    it('hash de conteúdo vazio bate com o vetor de referência conhecido do SHA-256', () => {
      const hasher = new IncrementalSha256();

      // Vetor de referência bem conhecido do SHA-256 da string vazia,
      // confirmado independentemente via `crypto.createHash('sha256')` do Node.
      expect(hasher.digest()).toBe(
        'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      );
    });

    it('hash de "abc" bate com o vetor de referência conhecido do SHA-256', () => {
      const hasher = new IncrementalSha256();
      hasher.update(Buffer.from('abc', 'utf8'));

      // Vetor de referência bem conhecido do SHA-256 de "abc", confirmado
      // independentemente via `crypto.createHash('sha256')` do Node.
      expect(hasher.digest()).toBe(
        'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
      );
    });

    it.each([0, 1, 54, 55, 56, 57, 63, 64, 65, 119, 120, 121, 1000])(
      'hash de conteúdo determinístico de %i bytes bate com crypto.createHash de referência do Node (bordas do bloco de 64 bytes)',
      (size) => {
        const data = Buffer.alloc(size);
        for (let i = 0; i < size; i++) {
          data[i] = (i * 7 + 3) % 256;
        }

        const hasher = new IncrementalSha256();
        hasher.update(data);

        expect(hasher.digest()).toBe(createHash('sha256').update(data).digest('hex'));
      },
    );

    it('hash calculado via múltiplas chamadas update() pequenas é idêntico ao hash de uma única chamada update() do conteúdo inteiro', () => {
      const data = Buffer.alloc(5000);
      for (let i = 0; i < data.length; i++) {
        data[i] = (i * 13 + 5) % 256;
      }

      const single = new IncrementalSha256();
      single.update(data);
      const singleCallHash = single.digest();

      const chunked = new IncrementalSha256();
      const chunkSizes = [1, 3, 7, 13, 64, 63, 65, 1000, 500, 33];
      let offset = 0;
      let chunkIndex = 0;
      while (offset < data.length) {
        const size = chunkSizes[chunkIndex % chunkSizes.length] ?? 1;
        chunkIndex++;
        const end = Math.min(offset + size, data.length);
        chunked.update(data.subarray(offset, end));
        offset = end;
      }
      const multipleCallsHash = chunked.digest();

      expect(multipleCallsHash).toBe(singleCallHash);
      expect(multipleCallsHash).toBe(createHash('sha256').update(data).digest('hex'));
    });

    it('binário aleatório de alguns MB em chunks de tamanhos variados bate com crypto.createHash de referência do Node', () => {
      // Gerador determinístico (não usa Math.random) para o teste ser
      // reprodutível, mas ainda cobrir um padrão de bytes "aleatório" real
      // (não uma sequência trivial repetitiva).
      let seed = 0x2545f491;
      const next = (): number => {
        seed = (seed * 1103515245 + 12345) >>> 0;
        return seed & 0xff;
      };

      const data = Buffer.alloc(3 * 1024 * 1024 + 777); // ~3MB, tamanho não múltiplo de bloco
      for (let i = 0; i < data.length; i++) {
        data[i] = next();
      }

      const hasher = new IncrementalSha256();
      const chunkSizes = [4096, 1, 65536, 63, 1024 * 1024, 17];
      let offset = 0;
      let chunkIndex = 0;
      while (offset < data.length) {
        const size = chunkSizes[chunkIndex % chunkSizes.length] ?? 4096;
        chunkIndex++;
        const end = Math.min(offset + size, data.length);
        hasher.update(data.subarray(offset, end));
        offset = end;
      }

      expect(hasher.digest()).toBe(createHash('sha256').update(data).digest('hex'));
    });

    it('update() chamado após digest() lança erro (instância não é reutilizável)', () => {
      const hasher = new IncrementalSha256();
      hasher.digest();

      expect(() => hasher.update(Buffer.from('x'))).toThrow(/update\(\) chamado após digest\(\)/);
    });

    it('digest() chamado uma segunda vez lança erro', () => {
      const hasher = new IncrementalSha256();
      hasher.digest();

      expect(() => hasher.digest()).toThrow(/digest\(\) já foi chamado/);
    });
  });

  describe('hashFileSha256', () => {
    /**
     * Cria um `HashableFileSystem` de mock que simula um arquivo real: mantém
     * `content` em memória e responde a `readAsStringAsync` respeitando
     * `position`/`length` (fatiando o buffer de verdade), ao contrário dos
     * mocks de `fileRepository.test.ts` que ignoram esses parâmetros — aqui
     * é justamente isso que precisa ser exercitado, já que é o mecanismo que
     * evita materializar o arquivo inteiro em memória de uma vez.
     */
    function createBufferFsModule(content: Buffer): {
      fs: HashableFileSystem;
      readCalls: { position: number; length: number }[];
    } {
      const readCalls: { position: number; length: number }[] = [];

      const fs: HashableFileSystem = {
        getInfoAsync: jest.fn(async (): Promise<{ exists: boolean; size?: number }> => ({
          exists: true,
          size: content.length,
        })),
        readAsStringAsync: jest.fn(
          async (
            _uri: string,
            options?: { encoding?: 'utf8' | 'base64'; position?: number; length?: number },
          ): Promise<string> => {
            const position = options?.position ?? 0;
            const length = options?.length ?? content.length - position;
            readCalls.push({ position, length });
            return content.subarray(position, position + length).toString('base64');
          },
        ),
      };

      return { fs, readCalls };
    }

    it('arquivo vazio produz o hash de conteúdo vazio sem nenhuma chamada de leitura', async () => {
      const { fs, readCalls } = createBufferFsModule(Buffer.alloc(0));

      const hash = await hashFileSha256('file:///vazio.bin', fs);

      expect(hash).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
      expect(readCalls).toHaveLength(0);
    });

    it('arquivo menor que o tamanho de bloco é lido em uma única chamada', async () => {
      const content = Buffer.from('conteúdo pequeno de arquivo', 'utf8');
      const { fs, readCalls } = createBufferFsModule(content);

      const hash = await hashFileSha256('file:///pequeno.txt', fs);

      expect(hash).toBe(createHash('sha256').update(content).digest('hex'));
      expect(readCalls).toEqual([{ position: 0, length: content.length }]);
    });

    it('arquivo maior que um bloco é lido em múltiplas chamadas com position/length corretos, e o hash bate com o de IncrementalSha256 do conteúdo inteiro', async () => {
      const content = Buffer.alloc(2500);
      for (let i = 0; i < content.length; i++) {
        content[i] = (i * 37 + 11) % 256;
      }

      const { fs, readCalls } = createBufferFsModule(content);
      const chunkBytes = 1000; // força 3 blocos: 1000 + 1000 + 500

      const hash = await hashFileSha256('file:///grande.bin', fs, chunkBytes);

      const referenceHasher = new IncrementalSha256();
      referenceHasher.update(content);
      const referenceHash = referenceHasher.digest();

      expect(hash).toBe(referenceHash);
      expect(hash).toBe(createHash('sha256').update(content).digest('hex'));

      expect(readCalls).toEqual([
        { position: 0, length: 1000 },
        { position: 1000, length: 1000 },
        { position: 2000, length: 500 },
      ]);
    });

    it('propaga erro explícito quando o arquivo não existe (sem tentar ler)', async () => {
      const fs: HashableFileSystem = {
        getInfoAsync: jest.fn(async () => ({ exists: false })),
        readAsStringAsync: jest.fn(),
      };

      await expect(hashFileSha256('file:///nao-existe.bin', fs)).rejects.toThrow(/não encontrado/);
      expect(fs.readAsStringAsync).not.toHaveBeenCalled();
    });

    it('propaga erro explícito quando a leitura de um bloco falha, mesmo no meio do arquivo (não só no primeiro bloco)', async () => {
      const content = Buffer.alloc(2000, 1);

      const fs: HashableFileSystem = {
        getInfoAsync: jest.fn(async () => ({ exists: true, size: content.length })),
        readAsStringAsync: jest
          .fn()
          .mockResolvedValueOnce(content.subarray(0, 1000).toString('base64'))
          .mockRejectedValueOnce(new Error('Falha de I/O simulada')),
      };

      await expect(hashFileSha256('file:///falha-no-meio.bin', fs, 1000)).rejects.toThrow(
        /Falha ao ler bloco do arquivo para cálculo de hash \(offset 1000\/2000\)/,
      );
    });

    it('erro não-instância de Error na leitura de bloco vira "Erro desconhecido"', async () => {
      const fs: HashableFileSystem = {
        getInfoAsync: jest.fn(async () => ({ exists: true, size: 10 })),
        readAsStringAsync: jest.fn().mockRejectedValue('permission denied (string, não Error)'),
      };

      await expect(hashFileSha256('file:///falha-nao-error.bin', fs)).rejects.toThrow(
        /Erro desconhecido/,
      );
    });

    it('lança erro se uma leitura retornar bloco vazio antes do fim esperado (proteção contra loop infinito em arquivo truncado)', async () => {
      const fs: HashableFileSystem = {
        getInfoAsync: jest.fn(async () => ({ exists: true, size: 100 })),
        readAsStringAsync: jest.fn(async () => ''),
      };

      await expect(hashFileSha256('file:///truncado.bin', fs)).rejects.toThrow(
        /Leitura de bloco vazia/,
      );
    });

    it('usa o tamanho de bloco padrão (não requer chunkBytes explícito) para arquivos pequenos', async () => {
      const content = Buffer.from('abc', 'utf8');
      const { fs } = createBufferFsModule(content);

      const hash = await hashFileSha256('file:///abc.txt', fs);

      expect(hash).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
    });
  });
});
