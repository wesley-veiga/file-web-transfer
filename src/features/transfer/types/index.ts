/**
 * Tipos de domínio da feature de transferências (HU-07 — Acompanhar transferências).
 *
 * Fonte única de verdade entre app e web-ui (Princípio II), conforme
 * Seção 3 de `transferir.md`.
 */

/** Direção do ponto de vista do host: upload = recebendo, download = enviando. */
export type TransferDirection = 'upload' | 'download';

/** Ciclo de vida de uma transferência. */
export type TransferStatus = 'queued' | 'active' | 'completed' | 'failed' | 'cancelled';

export interface Transfer {
  /** uuid */
  id: string;
  direction: TransferDirection;
  fileName: string;
  /** Tamanho total em bytes; null se o cliente não informou Content-Length. */
  sizeBytes: number | null;
  transferredBytes: number;
  status: TransferStatus;
  /** IP do dispositivo convidado. */
  peerIp: string;
  /** epoch ms */
  startedAt: number;
  /** epoch ms; null enquanto não finalizada. */
  finishedAt: number | null;
  /** Bytes/s, média móvel; null enquanto `queued` ou sem amostras suficientes. */
  speedBps: number | null;
  errorMessage: string | null;
}
