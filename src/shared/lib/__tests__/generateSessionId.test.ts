/**
 * Testes smoke para generateSessionId (T-104).
 *
 * Verifica:
 * - Formato correto (<palavra>-<número>)
 * - Determinismo com RNG injetado
 * - Funcionamento com Math.random padrão
 */

import { generateSessionId } from '../generateSessionId';

describe('generateSessionId', () => {
  describe('formato', () => {
    it('retorna string no formato <palavra>-<número>', () => {
      const id = generateSessionId(() => 0);

      // Verifica estrutura básica: palavra-número
      expect(id).toMatch(/^[a-záàâãéèêíïóôõöúçñ]+-\d{2}$/);
    });

    it('número sempre tem 2 dígitos (com padding zero)', () => {
      // RNG que produz número baixo (ex: 5)
      const id1 = generateSessionId(() => 0.05); // 0.05 * 100 = 5
      expect(id1).toMatch(/-05$/);

      // RNG que produz número alto (ex: 99)
      const id2 = generateSessionId(() => 0.99); // 0.99 * 100 = 99.x
      expect(id2).toMatch(/-99$/);
    });
  });

  describe('determinismo', () => {
    it('mesma seed produz sempre o mesmo resultado', () => {
      const rng = () => 0.42;

      const id1 = generateSessionId(rng);
      const id2 = generateSessionId(rng);
      const id3 = generateSessionId(rng);

      expect(id1).toBe(id2);
      expect(id2).toBe(id3);
    });

    it('RNGs diferentes produzem resultados diferentes (na maioria dos casos)', () => {
      const id1 = generateSessionId(() => 0.1);
      const id2 = generateSessionId(() => 0.9);

      expect(id1).not.toBe(id2);
    });

    it('primeira chamada do RNG seleciona a palavra, segunda seleciona o número', () => {
      let callCount = 0;
      const mockRng = () => {
        callCount++;
        if (callCount === 1) return 0.25; // Primeira chamada: seleciona palavra ~25% da lista
        if (callCount === 2) return 0.5;  // Segunda chamada: número = 50
        return 0;
      };

      const id = generateSessionId(mockRng);

      // Palavra no índice ~25% de 40 = índice 10
      // Número = 50
      expect(callCount).toBe(2);
      expect(id).toContain('-50');
    });
  });

  describe('default RNG (Math.random)', () => {
    it('sem argumento usa Math.random', () => {
      const id = generateSessionId(); // Sem argumentos

      expect(typeof id).toBe('string');
      expect(id).toMatch(/^[a-záàâãéèêíïóôõöúçñ]+-\d{2}$/);
    });

    it('cada chamada sem seed tende a produzir IDs diferentes', () => {
      // Com Math.random real, a probabilidade de colisão é muito baixa
      const ids = new Set<string>();

      for (let i = 0; i < 10; i++) {
        ids.add(generateSessionId());
      }

      // Esperamos pelo menos 8 IDs únicos em 10 gerations (colisões improváveis)
      expect(ids.size).toBeGreaterThanOrEqual(8);
    });
  });

  describe('edge cases', () => {
    it('RNG com valor exatamente 0 seleciona primeira palavra e número 0', () => {
      const id = generateSessionId(() => 0);

      expect(id).toMatch(/^maçã-00$/);
    });

    it('RNG com valor próximo de 1 (0.999...) seleciona última palavra e número 99', () => {
      const id = generateSessionId(() => 0.9999);

      expect(id).toMatch(/-99$/); // Última palavra é "vento" ou próxima
    });
  });
});
