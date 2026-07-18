/**
 * Formata velocidade de transferência em unidades legíveis (B/s, KB/s, MB/s, GB/s).
 * Usa base 1024 (padrão binário), similar a formatBytes mas com "/s" no final.
 *
 * @param bytesPerSecond - Velocidade em bytes por segundo
 * @returns String formatada, ex: "1.5 MB/s", "512 KB/s"
 *
 * @example
 * formatSpeed(1536)        // "1.5 KB/s"
 * formatSpeed(1048576)     // "1.0 MB/s"
 * formatSpeed(0)           // "0 B/s"
 * formatSpeed(-512)        // "512 B/s" (usa valor absoluto)
 */
export function formatSpeed(bytesPerSecond: number): string {
  const units = ['B/s', 'KB/s', 'MB/s', 'GB/s'] as const;
  const base = 1024;

  // Garantir valor não negativo
  let speed = Math.abs(bytesPerSecond);

  // Se é zero
  if (speed === 0) {
    return '0 B/s';
  }

  // Encontrar a unidade apropriada
  let unitIndex = 0;
  while (speed >= base && unitIndex < units.length - 1) {
    speed /= base;
    unitIndex += 1;
  }

  // Determinar número de casas decimais: 0 se >= 10, 1 caso contrário
  const decimals = speed >= 10 ? 0 : 1;
  const formatted = speed.toFixed(decimals).replace(/\.0$/, '');

  return `${formatted} ${units[unitIndex]}`;
}
