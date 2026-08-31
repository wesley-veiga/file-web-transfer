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
import { hashSha256, hashesEqual } from '../hashUtils';

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
});
