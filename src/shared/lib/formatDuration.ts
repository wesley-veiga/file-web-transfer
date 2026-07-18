/**
 * Formata duração em segundos para formato legível (ex: "2m 30s", "1h 5m").
 *
 * @param seconds - Duração em segundos (se negativo, usa valor absoluto)
 * @returns String formatada:
 *   - < 60s: "45s"
 *   - >= 60s, < 3600s: "2m 30s"
 *   - >= 3600s: "1h 5m 30s"
 *
 * @example
 * formatDuration(45)       // "45s"
 * formatDuration(150)      // "2m 30s"
 * formatDuration(3665)     // "1h 1m 5s"
 * formatDuration(0)        // "0s"
 * formatDuration(-60)      // "1m" (valor absoluto)
 */
export function formatDuration(seconds: number): string {
  // Garantir valor não negativo
  let remaining = Math.abs(Math.floor(seconds));

  // Casos especiais
  if (remaining === 0) {
    return '0s';
  }

  const parts: string[] = [];

  // Horas
  if (remaining >= 3600) {
    const hours = Math.floor(remaining / 3600);
    parts.push(`${hours}h`);
    remaining %= 3600;
  }

  // Minutos
  if (remaining >= 60) {
    const minutes = Math.floor(remaining / 60);
    parts.push(`${minutes}m`);
    remaining %= 60;
  }

  // Segundos
  if (remaining > 0 || parts.length === 0) {
    parts.push(`${remaining}s`);
  }

  return parts.join(' ');
}
