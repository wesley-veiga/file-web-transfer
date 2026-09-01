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
 * Constantes de arredondamento SHA-256 (as 32 primeiras bits das partes
 * fracionárias das raízes cúbicas dos primeiros 64 números primos) — FIPS
 * 180-4, seção 4.2.2. Valores públicos e fixos pela especificação do
 * algoritmo, iguais em qualquer implementação correta.
 */
const SHA256_K: readonly number[] = [
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
];

/**
 * Valores iniciais do hash SHA-256 (as 32 primeiras bits das partes
 * fracionárias das raízes quadradas dos 8 primeiros números primos) — FIPS
 * 180-4, seção 5.3.3.
 */
const SHA256_H0: readonly number[] = [
  0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
];

function rotr(x: number, n: number): number {
  return (x >>> n) | (x << (32 - n));
}

/**
 * SHA-256 incremental, puro TypeScript, sem dependências nativas.
 *
 * Por quê uma implementação própria em vez de `expo-crypto` ou uma lib
 * externa: `expo-crypto` (`Crypto.digestStringAsync`/`Crypto.digest`) só
 * expõe digest "de uma vez só" — não tem `.update()`/estado incremental
 * (confirmado lendo `node_modules/expo-crypto/build/Crypto.d.ts` e
 * `Crypto.types.d.ts` na v57.0.2). Rehashear cada bloco separadamente com
 * `hashSha256()` NÃO produz o hash do arquivo inteiro (cada chamada é
 * criptograficamente independente das outras) — a única forma correta é
 * manter estado (`h`, bloco parcial, contador de bytes) entre chamadas,
 * exatamente como `crypto.createHash('sha256')` do Node faz.
 *
 * Optou-se por escrever a implementação em vez de adicionar uma
 * dependência nova (ex.: `js-sha256`, `hash.js`): SHA-256 é um algoritmo
 * curto e totalmente especificado (FIPS 180-4, ~100 linhas de lógica),
 * puro JS (roda igual em Android/iOS/web, sem binding nativo), e evitar
 * mais uma dependência de terceiros para algo usado em verificação de
 * integridade de arquivo é a opção mais simples que atende ao princípio
 * de minimizar superfície de dependências (constituição, Governança). A
 * implementação foi validada byte a byte contra `crypto.createHash`
 * nativo do Node (Node embute uma implementação de referência de SHA-256)
 * para entradas vazias, em todos os tamanhos de borda do bloco de 64 bytes
 * (55/56/63/64/65/119/120 bytes) e para binário aleatório de alguns MB
 * dividido em chunks de tamanhos variados — mesmos casos que os testes
 * unitários desta função exercitam.
 */
export class IncrementalSha256 {
  private readonly h: Int32Array = Int32Array.from(SHA256_H0);
  private readonly block: Uint8Array = new Uint8Array(64);
  private readonly w: Int32Array = new Int32Array(64);
  private blockLen = 0;
  /** Total de bytes processados até agora (soma de todos os `update()`). */
  private totalLen = 0;
  private finalized = false;

  /**
   * Alimenta mais um bloco de bytes ao cálculo do hash. Pode ser chamado
   * quantas vezes forem necessárias, em qualquer tamanho de chunk — o
   * resultado final de `digest()` é o SHA-256 da concatenação de todos os
   * chunks passados a `update()`, na ordem em que foram passados.
   *
   * @throws Error se chamado depois de `digest()`
   */
  update(chunk: Uint8Array): void {
    if (this.finalized) {
      throw new Error('IncrementalSha256: update() chamado após digest()');
    }

    this.totalLen += chunk.length;

    let offset = 0;
    while (offset < chunk.length) {
      const need = 64 - this.blockLen;
      const take = Math.min(need, chunk.length - offset);
      this.block.set(chunk.subarray(offset, offset + take), this.blockLen);
      this.blockLen += take;
      offset += take;

      if (this.blockLen === 64) {
        this.processBlock(this.block);
        this.blockLen = 0;
      }
    }
  }

  /**
   * Finaliza o cálculo (aplica o padding do FIPS 180-4 sobre o bloco
   * parcial pendente) e retorna o hash SHA-256 de todo o conteúdo
   * acumulado via `update()`, em hexadecimal minúsculo.
   *
   * Só pode ser chamado uma vez; chamar `update()` depois de `digest()`
   * lança erro (instância não é reutilizável — criar uma nova para outro
   * hash).
   */
  digest(): string {
    if (this.finalized) {
      throw new Error('IncrementalSha256: digest() já foi chamado');
    }
    this.finalized = true;

    // Comprimento total em bits, como par de palavras de 32 bits (big-endian),
    // exigido pelo padding do FIPS 180-4. `totalLen` é um `number` (double);
    // seguro até bem além de qualquer tamanho de arquivo realista (2^53 bits).
    const bitLen = this.totalLen * 8;
    const hi = Math.floor(bitLen / 0x100000000) >>> 0;
    const lo = bitLen >>> 0;

    const padBlock = new Uint8Array(64);
    padBlock.set(this.block.subarray(0, this.blockLen));
    padBlock[this.blockLen] = 0x80;

    // Se não sobra espaço para os 8 bytes de comprimento neste bloco,
    // processa este bloco (só com o bit de padding) e continua num novo.
    if (this.blockLen >= 56) {
      this.processBlock(padBlock);
      padBlock.fill(0);
    }

    padBlock[56] = (hi >>> 24) & 0xff;
    padBlock[57] = (hi >>> 16) & 0xff;
    padBlock[58] = (hi >>> 8) & 0xff;
    padBlock[59] = hi & 0xff;
    padBlock[60] = (lo >>> 24) & 0xff;
    padBlock[61] = (lo >>> 16) & 0xff;
    padBlock[62] = (lo >>> 8) & 0xff;
    padBlock[63] = lo & 0xff;

    this.processBlock(padBlock);

    let hex = '';
    for (let i = 0; i < 8; i++) {
      const word = this.h[i] ?? 0;
      hex += (word >>> 0).toString(16).padStart(8, '0');
    }
    return hex;
  }

  /** Processa um único bloco de 64 bytes, atualizando o estado interno `h`. */
  private processBlock(block: Uint8Array): void {
    const w = this.w;

    for (let i = 0; i < 16; i++) {
      const base = i * 4;
      w[i] =
        ((block[base] ?? 0) << 24) |
        ((block[base + 1] ?? 0) << 16) |
        ((block[base + 2] ?? 0) << 8) |
        (block[base + 3] ?? 0);
    }
    for (let i = 16; i < 64; i++) {
      const wim15 = w[i - 15] ?? 0;
      const wim2 = w[i - 2] ?? 0;
      const s0 = rotr(wim15, 7) ^ rotr(wim15, 18) ^ (wim15 >>> 3);
      const s1 = rotr(wim2, 17) ^ rotr(wim2, 19) ^ (wim2 >>> 10);
      w[i] = ((w[i - 16] ?? 0) + s0 + (w[i - 7] ?? 0) + s1) | 0;
    }

    let a = this.h[0] ?? 0;
    let b = this.h[1] ?? 0;
    let c = this.h[2] ?? 0;
    let d = this.h[3] ?? 0;
    let e = this.h[4] ?? 0;
    let f = this.h[5] ?? 0;
    let g = this.h[6] ?? 0;
    let hh = this.h[7] ?? 0;

    for (let i = 0; i < 64; i++) {
      const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const ch = (e & f) ^ (~e & g);
      const temp1 = (hh + S1 + ch + (SHA256_K[i] ?? 0) + (w[i] ?? 0)) | 0;
      const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (S0 + maj) | 0;

      hh = g;
      g = f;
      f = e;
      e = (d + temp1) | 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) | 0;
    }

    this.h[0] = ((this.h[0] ?? 0) + a) | 0;
    this.h[1] = ((this.h[1] ?? 0) + b) | 0;
    this.h[2] = ((this.h[2] ?? 0) + c) | 0;
    this.h[3] = ((this.h[3] ?? 0) + d) | 0;
    this.h[4] = ((this.h[4] ?? 0) + e) | 0;
    this.h[5] = ((this.h[5] ?? 0) + f) | 0;
    this.h[6] = ((this.h[6] ?? 0) + g) | 0;
    this.h[7] = ((this.h[7] ?? 0) + hh) | 0;
  }
}

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
 * Tamanho de cada bloco lido do arquivo por `hashFileSha256`. Mesma ordem de
 * grandeza usada em `DOWNLOAD_CHUNK_BYTES` (`src/bootstrap/apiSetup.ts`,
 * T-804) — mantém o pico de memória por chamada limitado a um múltiplo
 * pequeno e constante desse valor (bloco base64 + `Buffer` decodificado +
 * estado interno do hasher, todos O(1) em relação ao tamanho do arquivo),
 * em vez de escalar com o tamanho do arquivo inteiro.
 */
const HASH_CHUNK_BYTES = 1024 * 1024;

/**
 * Fatia mínima de um módulo de filesystem necessária para ler um arquivo em
 * blocos e obter seu tamanho. Definida aqui (não importada de
 * `features/files/services/fileRepository.ts`) porque `shared/` nunca importa
 * de `features/` (constituição, Princípio IV) — mas é estruturalmente
 * compatível com `FileSystemModule` daquele arquivo (e com o módulo real do
 * `expo-file-system`), então a mesma instância pode ser passada diretamente.
 */
export interface HashableFileSystem {
  getInfoAsync: (uri: string) => Promise<{ exists: boolean; size?: number }>;
  readAsStringAsync: (
    uri: string,
    options?: { encoding?: 'utf8' | 'base64'; position?: number; length?: number },
  ) => Promise<string>;
}

/**
 * Calcula o hash SHA-256 de um arquivo lendo-o em blocos (nunca o arquivo
 * inteiro em memória de uma vez — nem como string base64, nem como Buffer).
 *
 * Reutilizável: usado por `moveReceivedFileToConfiguredFolder` (T-802/T-805)
 * para verificar integridade sem `OutOfMemoryError` em arquivo grande, e
 * disponível para qualquer outro ponto que precise do mesmo padrão no
 * futuro (ver T-805, critério de pronto).
 *
 * Mesmo padrão de leitura em blocos usado em `readFileBlock`
 * (`src/bootstrap/apiSetup.ts`, T-804): `readAsStringAsync` com
 * `{ encoding: 'base64', position, length }`, decodificando cada bloco
 * isoladamente e alimentando-o a um `IncrementalSha256` — nunca acumulando
 * blocos anteriores em memória.
 *
 * @param uri - URI (ou caminho) do arquivo a hashear
 * @param fsModule - Módulo de filesystem (real ou mock nos testes)
 * @param chunkBytes - Tamanho do bloco de leitura (padrão: `HASH_CHUNK_BYTES`)
 * @returns Promise que resolve para o hash SHA-256 em hexadecimal (lowercase)
 * @throws Error se o arquivo não existir, ou se qualquer leitura de bloco falhar
 *   (inclusive no meio do streaming, não só no início — nunca hash parcial
 *   silencioso de um arquivo cuja leitura falhou)
 */
export async function hashFileSha256(
  uri: string,
  fsModule: HashableFileSystem,
  chunkBytes: number = HASH_CHUNK_BYTES,
): Promise<string> {
  const info = await fsModule.getInfoAsync(uri);
  if (!info.exists || info.size === undefined) {
    throw new Error(`Arquivo não encontrado para cálculo de hash: ${uri}`);
  }

  const totalBytes = info.size;
  const hasher = new IncrementalSha256();

  let position = 0;
  while (position < totalBytes) {
    const length = Math.min(chunkBytes, totalBytes - position);

    let decoded: Buffer;
    try {
      const base64Block = await fsModule.readAsStringAsync(uri, {
        encoding: 'base64',
        position,
        length,
      });
      decoded = Buffer.from(base64Block, 'base64');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro desconhecido';
      throw new Error(
        `Falha ao ler bloco do arquivo para cálculo de hash (offset ${position}/${totalBytes}): ${message}`,
      );
    }

    if (decoded.length === 0) {
      // Proteção contra loop infinito: leitura não avançou (ex.: arquivo
      // truncado/alterado durante o cálculo do hash).
      throw new Error(
        `Leitura de bloco vazia ao calcular hash (offset ${position}/${totalBytes}): ${uri}`,
      );
    }

    hasher.update(decoded);
    position += decoded.length;
  }

  return hasher.digest();
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
