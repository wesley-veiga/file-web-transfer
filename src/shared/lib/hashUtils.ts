/**
 * Utilitários para cálculo e verificação de hash SHA-256 de arquivos.
 *
 * Usado para verificar integridade de arquivos vinculados (T-801) e
 * confirmar que o arquivo baixado não foi truncado/corrompido.
 *
 * Implementação segura contra corrupção binária: buffers são convertidos para
 * base64 antes de hashear, evitando reinterpretação de bytes como UTF-8.
 */

import * as Crypto from 'expo-crypto';
import { Buffer } from 'buffer';

/**
 * Calcula o hash SHA-256 de uma string ou buffer.
 *
 * Segurança: buffers binários são convertidos para base64 antes de hashear,
 * preservando cada byte (evita corrupção binária que aconteceria com UTF-8).
 *
 * @param data - Conteúdo (string ou Buffer binário)
 * @returns Promise que resolve para hash SHA-256 em hexadecimal (lowercase)
 */
export async function hashSha256(data: string | Buffer): Promise<string> {
  let dataToHash: string;

  if (Buffer.isBuffer(data)) {
    // Converter buffer para base64 para evitar corrupção binária.
    // UTF-8 implicito `.toString()` mutilaria bytes que não formam sequência válida.
    dataToHash = data.toString('base64');
  } else {
    dataToHash = data;
  }

  // Calcular hash SHA-256 via expo-crypto (v57.0.0+)
  const base64Hash = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    dataToHash,
    { encoding: Crypto.CryptoEncoding.BASE64 },
  );

  // Converter base64 para hexadecimal (formato padrão para SHA-256)
  const hashBuffer = Buffer.from(base64Hash, 'base64');
  return hashBuffer.toString('hex');
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
