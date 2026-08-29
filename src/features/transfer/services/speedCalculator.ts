/**
 * Cálculo de velocidade média móvel para transferências (HU-07).
 *
 * Função pura: recebe as amostras já coletadas e uma janela de tempo,
 * devolve a velocidade em bytes/s. Nenhuma dependência de relógio real —
 * os timestamps são sempre fornecidos por quem chama (store), que por sua
 * vez recebe um relógio injetável. Isso mantém a lógica 100% testável.
 */

/** Uma amostra de progresso: bytes acumulados transferidos em um instante. */
export interface SpeedSample {
  /** epoch ms */
  timestamp: number;
  /** Total de bytes transferidos até este instante (cumulativo, não delta). */
  transferredBytes: number;
}

/** Janela padrão da média móvel: 3 s (cobre confortavelmente o requisito de atualização a cada 500 ms). */
export const DEFAULT_SPEED_WINDOW_MS = 3000;

/**
 * Calcula a velocidade média móvel (bytes/s) a partir de uma lista de amostras
 * ordenadas por timestamp crescente.
 *
 * Estratégia: usa a amostra mais recente e a amostra mais antiga dentro da
 * janela `windowMs` (ou, se nenhuma amostra anterior cair dentro da janela,
 * a amostra imediatamente anterior à mais recente) como base de comparação.
 * Velocidade = delta de bytes / delta de tempo.
 *
 * @param samples Amostras ordenadas por timestamp crescente (mínimo 2 para um resultado).
 * @param windowMs Tamanho da janela da média móvel, em ms.
 * @returns Velocidade em bytes/s, ou `null` se não houver amostras suficientes
 *          ou o intervalo de tempo entre elas for zero/negativo.
 */
export function calculateMovingAverageSpeed(
  samples: readonly SpeedSample[],
  windowMs: number = DEFAULT_SPEED_WINDOW_MS,
): number | null {
  if (samples.length < 2) {
    return null;
  }

  const latest = samples[samples.length - 1];
  const cutoff = latest.timestamp - windowMs;

  // Amostras dentro da janela (excluindo a mais recente, que é a referência).
  const withinWindow = samples.slice(0, -1).filter((sample) => sample.timestamp >= cutoff);

  // Se nenhuma amostra cai dentro da janela (transferência lenta/intervalos grandes),
  // usa a amostra imediatamente anterior como base — ainda produz uma velocidade válida.
  const base = withinWindow.length > 0 ? withinWindow[0] : samples[samples.length - 2];

  const deltaBytes = latest.transferredBytes - base.transferredBytes;
  const deltaMs = latest.timestamp - base.timestamp;

  if (deltaMs <= 0) {
    return null;
  }

  return (deltaBytes / deltaMs) * 1000;
}

/**
 * Máxima idade (em relação à amostra mais recente) que uma amostra pode ter
 * antes de ser descartada do histórico, para não crescer sem limite durante
 * transferências longas. Deve ser maior que a janela da média móvel.
 */
export const DEFAULT_SAMPLE_RETENTION_MS = DEFAULT_SPEED_WINDOW_MS * 2;

/**
 * Adiciona uma amostra ao histórico e descarta amostras antigas demais
 * (fora de `retentionMs` em relação à amostra mais recente).
 *
 * Função pura: devolve um novo array, não modifica `samples`.
 */
export function appendSpeedSample(
  samples: readonly SpeedSample[],
  sample: SpeedSample,
  retentionMs: number = DEFAULT_SAMPLE_RETENTION_MS,
): SpeedSample[] {
  const cutoff = sample.timestamp - retentionMs;
  return [...samples.filter((existing) => existing.timestamp >= cutoff), sample];
}
