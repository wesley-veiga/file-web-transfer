/**
 * Formata bytes em unidades legíveis (B, KB, MB, GB, TB).
 * Usa base 1024 (padrão binário).
 *
 * @param bytes - Número de bytes a formatar (se negativo, usa valor absoluto)
 * @returns String formatada, ex: "1.5 KB", "10 MB"
 *
 * @example
 * formatBytes(1536)        // "1.5 KB"
 * formatBytes(1048576)     // "1.0 MB"
 * formatBytes(0)           // "0 B"
 * formatBytes(-512)        // "512 B" (valor absoluto)
 */
export function formatBytes(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB', 'TB'] as const;
  const base = 1024;

  // Garantir valor não negativo
  let size = Math.abs(bytes);

  // Se é zero bytes
  if (size === 0) {
    return '0 B';
  }

  // Encontrar a unidade apropriada
  let unitIndex = 0;
  while (size >= base && unitIndex < units.length - 1) {
    size /= base;
    unitIndex += 1;
  }

  // Determinar número de casas decimais: 0 se >= 10, 1 caso contrário
  const decimals = size >= 10 ? 0 : 1;
  const formatted = size.toFixed(decimals).replace(/\.0$/, '');

  return `${formatted} ${units[unitIndex]}`;
}
