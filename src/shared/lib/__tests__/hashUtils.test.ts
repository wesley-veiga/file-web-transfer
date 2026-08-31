/**
 * Testes unitários para utilitários de hash SHA-256.
 *
 * Testa:
 * - hashesEqual: comparar hashes com case-insensitivity
 *
 * NOTA: hashSha256 é mocada nos testes porque é uma função de API nativa
 * que seria implementada em produção com expo-crypto. Os testes verificam
 * apenas a lógica de comparação e igualdade de hashes.
 */

import { hashesEqual } from '../hashUtils';

describe('hashUtils', () => {
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
  });
});
