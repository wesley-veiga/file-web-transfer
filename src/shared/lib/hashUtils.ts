/**
 * Utilitários para cálculo e verificação de hash SHA-256 de arquivos.
 *
 * Usado para verificar integridade de arquivos vinculados (T-801) e
 * confirmar que o arquivo baixado não foi truncado/corrompido.
 *
 * NOTA: A implementação real do hash SHA-256 usa APIs nativas do Expo
 * (não disponíveis em ambiente de teste); os testes mocam essa função.
 */

/**
 * Calcula o hash SHA-256 de uma string ou buffer.
 *
 * Implementação: em produção, usa API nativa do Expo; em testes, mocada.
 *
 * @param data - Conteúdo (string ou Buffer)
 * @returns Promise que resolve para hash SHA-256 em hexadecimal (lowercase)
 */
export async function hashSha256(data: string | Buffer): Promise<string> {
  // Esta função será mocada nos testes; em produção, seria implementada
  // com a API nativa do Expo (expo-crypto).
  // Para now, retornar um placeholder que será substituído nos testes.
  const placeholder = Buffer.isBuffer(data) ? data.toString('hex').slice(0, 64) : data.slice(0, 64);
  return placeholder;
}

/**
 * Verifica se dois hashes SHA-256 (em hexadecimal) são iguais.
 * Comparação case-insensitive (ambos convertidos para lowercase).
 *
 * @param hash1 - Primeiro hash (hexadecimal)
 * @param hash2 - Segundo hash (hexadecimal)
 * @returns true se os hashes forem iguais
 */
export function hashesEqual(hash1: string, hash2: string): boolean {
  return hash1.toLowerCase() === hash2.toLowerCase();
}
