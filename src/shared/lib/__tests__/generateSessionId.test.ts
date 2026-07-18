/**
 * Testes completos para generateSessionId (T-104).
 *
 * Cobre:
 * - Formato completo com regex rigoroso
 * - Todas as 40 posições alcançáveis na lista
 * - Determinismo com RNG injetado
 * - Colisões sob Math.random real
 * - Edge cases de RNG (0, próximo de 1, valores fracionários)
 * - Cobertura 100% do módulo
 *
 * Nota: A lista tem 40 items, mas "laranja" aparece 2 vezes,
 * portanto 39 palavras únicas são alcançáveis.
 */

import { generateSessionId } from '../generateSessionId';

describe('generateSessionId', () => {
  describe('formato', () => {
    it('retorna string no formato <palavra>-<número>', () => {
      const id = generateSessionId(() => 0);

      // Estrutura: não-vazio + hífen + exatamente 2 dígitos
      expect(id).toMatch(/^.+-\d{2}$/);
    });

    it('número sempre tem exatamente 2 dígitos com padding zero', () => {
      // Número 0
      const id0 = generateSessionId(() => 0.005); // 0.005 * 100 = 0
      expect(id0).toMatch(/-00$/);

      // Número 5
      const id5 = generateSessionId(() => 0.05); // 0.05 * 100 = 5
      expect(id5).toMatch(/-05$/);

      // Número 42
      const id42 = generateSessionId(() => 0.42); // 0.42 * 100 = 42
      expect(id42).toMatch(/-42$/);

      // Número 99
      const id99 = generateSessionId(() => 0.99); // 0.99 * 100 = 99
      expect(id99).toMatch(/-99$/);
    });

    it('parte da palavra contém apenas caracteres válidos (português com acentos)', () => {
      for (let i = 0; i < 100; i++) {
        // Testa com valores aleatórios do RNG
        const id = generateSessionId(() => Math.random());

        // Regex: palavra com caracteres latinos (incluindo acentos) + hífen + 2 dígitos
        expect(id).toMatch(/^[a-záàâãéèêíïóôõöúçñ]+-\d{2}$/);
      }
    });

    it('cada ID retornado é uma string não vazia', () => {
      const id = generateSessionId();

      expect(typeof id).toBe('string');
      expect(id.length).toBeGreaterThan(0);
    });
  });

  describe('cobertura de palavras', () => {
    it('todas as 40 posições da lista são alcançáveis', () => {
      const generatedWords = new Map<string, number[]>();

      // Para cada posição, injetamos um RNG que força seu índice
      for (let wordIndex = 0; wordIndex < 40; wordIndex++) {
        let callCount = 0;
        const rngFn = () => {
          callCount++;
          if (callCount === 1) {
            // Primeira chamada: retorna valor que força o índice
            // Math.floor(rng * 40) = wordIndex
            // Logo: rng = (wordIndex + 0.5) / 40
            return (wordIndex + 0.5) / 40;
          }
          // Segunda chamada: número 0
          return 0;
        };

        const id = generateSessionId(rngFn);
        const [word] = id.split('-');

        if (!generatedWords.has(word)) {
          generatedWords.set(word, []);
        }
        generatedWords.get(word)!.push(wordIndex);
      }

      // Verifica que todas as 40 posições geraram alguma palavra
      const totalPositions = Array.from(generatedWords.values()).reduce(
        (sum, indices) => sum + indices.length,
        0,
      );
      expect(totalPositions).toBe(40);

      // Esperamos pelo menos 39 palavras únicas (pois "laranja" aparece 2x)
      expect(generatedWords.size).toBeGreaterThanOrEqual(39);
    });

    it('índice 0 de palavra retorna a primeira palavra (maçã)', () => {
      const id = generateSessionId(() => 0); // 0 * 40 = 0 → maçã
      expect(id).toMatch(/^maçã-\d{2}$/);
    });

    it('índice próximo ao fim da lista retorna última palavra (vento)', () => {
      // (39.5) / 40 = 0.9875 → Math.floor(0.9875 * 40) = 39 (última)
      const id = generateSessionId(() => 0.9875);
      expect(id).toMatch(/^vento-\d{2}$/);
    });
  });

  describe('números (0-99)', () => {
    it('número 0 é gerado com valor RNG 0.000', () => {
      const id = generateSessionId(() => 0);

      expect(id).toMatch(/-00$/);
    });

    it('número 1 é gerado com valor RNG 0.01', () => {
      const id = generateSessionId(() => 0.01);
      expect(id).toMatch(/-01$/);
    });

    it('número 50 é gerado com valor RNG 0.50', () => {
      const id = generateSessionId(() => 0.5);
      expect(id).toMatch(/-50$/);
    });

    it('número 99 é gerado com valor RNG 0.99', () => {
      const id = generateSessionId(() => 0.99);
      expect(id).toMatch(/-99$/);
    });

    it('todos os números 0-99 são alcançáveis', () => {
      const generatedNumbers = new Set<number>();

      for (let num = 0; num < 100; num++) {
        let callCount = 0;
        const rng = () => {
          callCount++;
          if (callCount === 1) return 0; // Palavra: primeira
          return (num + 0.5) / 100; // Número desejado
        };
        const id = generateSessionId(rng);
        const [, numberPart] = id.split('-');

        generatedNumbers.add(parseInt(numberPart, 10));
      }

      expect(generatedNumbers.size).toBe(100);
      for (let i = 0; i < 100; i++) {
        expect(generatedNumbers.has(i)).toBe(true);
      }
    });
  });

  describe('determinismo', () => {
    it('mesma seed de RNG sempre produz o mesmo resultado', () => {
      const rng = () => 0.42;

      const id1 = generateSessionId(rng);
      const id2 = generateSessionId(rng);
      const id3 = generateSessionId(rng);

      expect(id1).toBe(id2);
      expect(id2).toBe(id3);
    });

    it('RNGs com valores diferentes produzem resultados diferentes na maioria dos casos', () => {
      const ids = new Set<string>();

      // 40 posições diferentes para palavras, com números fixos
      for (let wordPos = 0; wordPos < 40; wordPos++) {
        let callCount = 0;
        const rng = () => {
          callCount++;
          if (callCount === 1) return (wordPos + 0.5) / 40; // Palavra diferente
          return 0; // Número fixo (0)
        };
        ids.add(generateSessionId(rng));
      }

      // Com 40 posições diferentes de palavras, esperamos 40 IDs (ou 39 únicos se laranja repetir)
      // Mas como os IDs são gerados sequencialmente de positions 0-39, esperamos mínimo 39
      expect(ids.size).toBeGreaterThanOrEqual(39);
    });

    it('primeira chamada do RNG seleciona palavra, segunda seleciona número', () => {
      const callSequence: number[] = [];

      const mockRng = () => {
        if (callSequence.length === 0) {
          callSequence.push(0.25); // Primeira: palavra no índice ~25%
          return 0.25;
        } else {
          callSequence.push(0.5); // Segunda: número 50
          return 0.5;
        }
      };

      const id = generateSessionId(mockRng);

      // Verifica que RNG foi chamado exatamente 2 vezes
      expect(callSequence.length).toBe(2);
      // Verifica que o número é 50
      expect(id).toMatch(/-50$/);
    });

    it('mesmo padrão de RNG sequencial sempre produz mesmos IDs', () => {
      const rngFactory = () => {
        const values = [0.1, 0.3, 0.5, 0.7, 0.9];
        let index = 0;
        return () => values[index++ % values.length];
      };

      const rng1 = rngFactory();
      const ids1 = [generateSessionId(rng1), generateSessionId(rng1), generateSessionId(rng1)];

      const rng2 = rngFactory();
      const ids2 = [generateSessionId(rng2), generateSessionId(rng2), generateSessionId(rng2)];

      expect(ids1).toEqual(ids2);
    });
  });

  describe('default RNG (Math.random)', () => {
    it('sem argumentos usa Math.random', () => {
      const id = generateSessionId(); // Sem argumentos

      expect(typeof id).toBe('string');
      expect(id).toMatch(/^[a-záàâãéèêíïóôõöúçñ]+-\d{2}$/);
    });

    it('chamadas sucessivas tendem a produzir IDs diferentes', () => {
      const ids = new Set<string>();

      // Gera 20 IDs com Math.random
      for (let i = 0; i < 20; i++) {
        ids.add(generateSessionId());
      }

      // Esperamos alta unicidade com Math.random
      // Probabilidade de colisão em 20 gerações: (40 palavras * 100 números = 4000 combinações)
      // é negligenciável
      expect(ids.size).toBeGreaterThanOrEqual(18);
    });
  });

  describe('colisões e unicidade', () => {
    it('taxa de colisão com 1000 gerações é razoável', () => {
      const ids: string[] = [];

      for (let i = 0; i < 1000; i++) {
        ids.push(generateSessionId());
      }

      const uniqueIds = new Set(ids);
      const collisionRate = (ids.length - uniqueIds.size) / ids.length;

      // Com 40 posições * 100 números = 4000 possibilidades,
      // a taxa esperada de colisão em 1000 gerações é ~10-12%
      // (usando birthday paradox com 39 palavras únicas)
      expect(collisionRate).toBeLessThan(0.15);
      // Esperamos pelo menos 85% de IDs únicos
      expect(uniqueIds.size).toBeGreaterThanOrEqual(850);
    });

    it('mesmo com 1000 gerações, gera um bom número de IDs únicos', () => {
      const ids = new Set<string>();

      for (let i = 0; i < 1000; i++) {
        ids.add(generateSessionId());
      }

      // Com 4000 possibilidades teóricas, esperamos boa diversidade
      expect(ids.size).toBeGreaterThan(700);
    });
  });

  describe('edge cases de RNG', () => {
    it('RNG com exatamente 0 não causa índice fora dos limites', () => {
      const id = generateSessionId(() => 0);

      expect(id).toMatch(/^maçã-00$/);
    });

    it('RNG muito próximo de 1 (0.999999) não causa índice fora dos limites', () => {
      const id = generateSessionId(() => 0.999999);

      // Math.floor(0.999999 * 40) = 39 (última palavra)
      // Math.floor(0.999999 * 100) = 99
      expect(id).toMatch(/^vento-99$/);
    });

    it('RNG com valores bem distribuídos não causa erro', () => {
      const testValues = [0, 0.001, 0.01, 0.1, 0.25, 0.5, 0.75, 0.9, 0.99, 0.999, 0.9999];

      testValues.forEach((val) => {
        expect(() => generateSessionId(() => val)).not.toThrow();
        const id = generateSessionId(() => val);
        expect(id).toMatch(/^[a-záàâãéèêíïóôõöúçñ]+-\d{2}$/);
      });
    });
  });

  describe('integração: sequência de RNG para múltiplas gerações', () => {
    it('sequência de 10 RNGs diferentes gera 10 IDs determinísticos', () => {
      const rngSequence = [
        () => 0.0,
        () => 0.1,
        () => 0.2,
        () => 0.3,
        () => 0.4,
        () => 0.5,
        () => 0.6,
        () => 0.7,
        () => 0.8,
        () => 0.9,
      ];

      const ids = rngSequence.map((rng) => generateSessionId(rng));

      // Todos devem ser strings válidas
      ids.forEach((id) => {
        expect(id).toMatch(/^[a-záàâãéèêíïóôõöúçñ]+-\d{2}$/);
      });

      // Todos devem ser diferentes (10 RNGs diferentes → 10 IDs diferentes)
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(10);
    });
  });

  describe('contrato de API', () => {
    it('sessionId é sempre uma string', () => {
      for (let i = 0; i < 20; i++) {
        const id = generateSessionId();
        expect(typeof id).toBe('string');
      }
    });

    it('sessionId não contém espaços ou caracteres de controle', () => {
      for (let i = 0; i < 20; i++) {
        const id = generateSessionId();
        expect(/\s/.test(id)).toBe(false);
        expect(/[\x00-\x1F\x7F]/.test(id)).toBe(false);
      }
    });

    it('sessionId tem comprimento consistente (palavras + hífen + 2 dígitos)', () => {
      const ids = new Set<number>();

      for (let i = 0; i < 100; i++) {
        const id = generateSessionId();
        ids.add(id.length);
      }

      // Comprimentos devem estar entre min(palavra) + 1 + 2 e max(palavra) + 1 + 2
      // Menor palavra: "cão" (3) → 3 + 1 + 2 = 6
      // Maior palavra: "melancia", "abacaxi", "pássaro" (8) → 8 + 1 + 2 = 11
      ids.forEach((len) => {
        expect(len).toBeGreaterThanOrEqual(6);
        expect(len).toBeLessThanOrEqual(11);
      });
    });
  });
});
