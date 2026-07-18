/**
 * Gerador de identificadores de sessão humanos.
 *
 * Produz strings no formato `<palavra>-<número>` (ex.: "maçã-42").
 * Determinístico dado um RNG injetável — mesmos valores do RNG produzem mesmo resultado.
 * Padrão: Math.random em produção.
 */

const PORTUGUESE_WORDS = [
  // Frutas
  'maçã',
  'pera',
  'laranja',
  'limão',
  'manga',
  'abacaxi',
  'melancia',
  'melão',
  'morango',
  'uva',
  // Animais
  'gato',
  'cão',
  'pássaro',
  'peixe',
  'leão',
  'elefante',
  'zebra',
  'girafa',
  'coelho',
  'raposa',
  // Cores
  'azul',
  'vermelho',
  'verde',
  'amarelo',
  'roxo',
  'rosa',
  'preto',
  'branco',
  'cinza',
  'laranja',
  // Objetos/elementos naturais
  'sol',
  'lua',
  'estrela',
  'nuvem',
  'árvore',
  'flor',
  'pedra',
  'água',
  'fogo',
  'vento',
];

/**
 * Gera um identificador de sessão humano no formato `<palavra>-<número>`.
 *
 * @param rngFn - Função injectable que retorna um número aleatório entre 0 (inclusive) e 1 (exclusivo).
 *                Padrão: `Math.random`. Usada para injetar seed em testes.
 * @returns String no formato `<palavra>-<número>` (ex.: "maçã-42")
 *
 * @example
 * // Em produção (com Math.random)
 * const sessionId = generateSessionId(); // ex.: "gato-17"
 *
 * // Em testes (com seed determinístico)
 * const deterministicId = generateSessionId(() => 0.25); // sempre "pera-25"
 */
export function generateSessionId(rngFn: () => number = Math.random): string {
  // Seleciona palavra aleatória da lista
  const wordIndex = Math.floor(rngFn() * PORTUGUESE_WORDS.length);
  const word = PORTUGUESE_WORDS[wordIndex];

  // Gera número de 0-99
  const number = Math.floor(rngFn() * 100);

  return `${word}-${String(number).padStart(2, '0')}`;
}
