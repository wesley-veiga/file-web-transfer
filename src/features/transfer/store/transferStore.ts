import * as Crypto from 'expo-crypto';
import { create } from 'zustand';
import type { StoreApi, UseBoundStore } from 'zustand';
import type { Transfer, TransferDirection, TransferStatus } from '../types';
import type { SpeedSample } from '../services/speedCalculator';
import { appendSpeedSample, calculateMovingAverageSpeed } from '../services/speedCalculator';

/**
 * Store Zustand da feature de transferências (HU-07 — Acompanhar transferências).
 *
 * Responsabilidades: fila de transferências, progresso, velocidade (média móvel),
 * transições de status e cancelamento em massa ao parar o servidor.
 *
 * Sem I/O real: quem reporta progresso (T-602, as rotas HTTP instrumentadas) e
 * quem chama `cancelAllActive()` (T-201/serverStore, ao parar o servidor) fica
 * de fora deste módulo — apenas a agregação de estado vive aqui.
 *
 * Relógio e gerador de id são injetáveis via `createTransferStore(deps)` para
 * que o `testador` consiga mockar tempo determinístico na lógica de velocidade
 * (Princípio III). `useTransferStore` é a instância padrão usada em produção.
 */

/** Dados necessários para enfileirar uma nova transferência. */
export interface EnqueueTransferInput {
  /** uuid; gerado automaticamente se omitido. */
  id?: string;
  direction: TransferDirection;
  fileName: string;
  /** null se o cliente não informou Content-Length. */
  sizeBytes: number | null;
  peerIp: string;
}

/** Dependências injetáveis do store (testabilidade). */
export interface TransferStoreDeps {
  /** Relógio injetável (epoch ms). Padrão: `Date.now`. */
  now: () => number;
  /** Gerador de id injetável. Padrão: `Crypto.randomUUID`. */
  generateId: () => string;
}

const defaultDeps: TransferStoreDeps = {
  now: () => Date.now(),
  generateId: () => Crypto.randomUUID(),
};

/** Transições de status válidas (mesmo padrão de `serverStore`). */
type StatusTransition = `${TransferStatus}→${TransferStatus}`;

const VALID_TRANSITIONS: StatusTransition[] = [
  'queued→active',
  'queued→completed',
  'queued→failed',
  'queued→cancelled',
  'active→completed',
  'active→failed',
  'active→cancelled',
];

function isValidStatusTransition(from: TransferStatus, to: TransferStatus): boolean {
  return VALID_TRANSITIONS.includes(`${from}→${to}`);
}

/** Status considerados "em andamento" — alvo de `cancelAllActive()`. */
function isActiveStatus(status: TransferStatus): boolean {
  return status === 'queued' || status === 'active';
}

export interface TransferStore {
  /** Fila de transferências da sessão atual (ordem de chegada — FIFO). */
  transfers: Transfer[];

  /** Enfileira uma nova transferência (status inicial: `queued`). Retorna o id. */
  enqueue: (input: EnqueueTransferInput) => string;

  /** Marca o início efetivo da transferência: `queued` → `active`. */
  start: (id: string) => void;

  /**
   * Reporta progresso de bytes transferidos.
   *
   * Promove `queued` → `active` automaticamente na primeira chamada (defensivo,
   * caso quem instrumenta as rotas não chame `start()` explicitamente).
   * Recalcula `speedBps` como média móvel dos deltas de progresso.
   */
  reportProgress: (id: string, transferredBytes: number) => void;

  /** Marca conclusão: `queued`/`active` → `completed`. */
  complete: (id: string) => void;

  /** Marca falha: `queued`/`active` → `failed`, com mensagem já traduzida. */
  fail: (id: string, errorMessage: string) => void;

  /** Cancela uma transferência específica: `queued`/`active` → `cancelled`. */
  cancel: (id: string) => void;

  /**
   * Cancela todas as transferências em andamento (`queued`/`active`) de uma vez.
   * Chamada externamente ao parar o servidor (HU-07 / critério "Parar com
   * transferências ativas").
   */
  cancelAllActive: () => void;

  /** Limpa a fila inteira (histórico só persiste durante a sessão do servidor). */
  reset: () => void;
}

/**
 * Cria uma nova instância do store de transferências.
 *
 * @param deps Dependências injetáveis (relógio, gerador de id). Em produção,
 *             usar os padrões (omitir). Em teste, injetar um relógio mockado.
 */
export function createTransferStore(
  deps: Partial<TransferStoreDeps> = {},
): UseBoundStore<StoreApi<TransferStore>> {
  const { now, generateId } = { ...defaultDeps, ...deps };

  // Amostras de velocidade por transferência — estado interno, não exposto
  // via `Transfer` (que só expõe o `speedBps` já agregado). Vive no closure
  // da factory para que cada instância de store tenha seu próprio histórico,
  // isolando testes entre si.
  let speedSamples: Record<string, SpeedSample[]> = {};

  function transition(
    set: (fn: (state: TransferStore) => Partial<TransferStore>) => void,
    id: string,
    to: TransferStatus,
    patch: (transfer: Transfer) => Partial<Transfer>,
  ): void {
    set((state) => {
      const transfer = state.transfers.find((t) => t.id === id);
      if (!transfer) {
        console.warn(`[TransferStore] Transferência não encontrada: ${id}`);
        return state;
      }

      if (!isValidStatusTransition(transfer.status, to)) {
        console.warn(`[TransferStore] Transição inválida: ${transfer.status} → ${to} (${id})`);
        return state;
      }

      return {
        transfers: state.transfers.map((t) =>
          t.id === id ? { ...t, ...patch(t), status: to } : t,
        ),
      };
    });
  }

  return create<TransferStore>((set, get) => ({
    transfers: [],

    enqueue: (input) => {
      const id = input.id ?? generateId();
      const transfer: Transfer = {
        id,
        direction: input.direction,
        fileName: input.fileName,
        sizeBytes: input.sizeBytes,
        transferredBytes: 0,
        status: 'queued',
        peerIp: input.peerIp,
        startedAt: now(),
        finishedAt: null,
        speedBps: null,
        errorMessage: null,
      };

      speedSamples[id] = [];

      set((state) => ({
        transfers: [...state.transfers, transfer],
      }));

      return id;
    },

    start: (id) => {
      transition(set, id, 'active', () => ({}));
    },

    reportProgress: (id, transferredBytes) => {
      const transfer = get().transfers.find((t) => t.id === id);
      if (!transfer) {
        console.warn(`[TransferStore] Transferência não encontrada: ${id}`);
        return;
      }

      if (transfer.status !== 'queued' && transfer.status !== 'active') {
        console.warn(
          `[TransferStore] Progresso ignorado para transferência finalizada (${transfer.status}): ${id}`,
        );
        return;
      }

      const clamped =
        transfer.sizeBytes !== null
          ? Math.min(transferredBytes, transfer.sizeBytes)
          : transferredBytes;
      const timestamp = now();

      const samples = appendSpeedSample(speedSamples[id] ?? [], {
        timestamp,
        transferredBytes: clamped,
      });
      speedSamples[id] = samples;
      const speedBps = calculateMovingAverageSpeed(samples);

      set((state) => ({
        transfers: state.transfers.map((t) =>
          t.id === id ? { ...t, status: 'active', transferredBytes: clamped, speedBps } : t,
        ),
      }));
    },

    complete: (id) => {
      transition(set, id, 'completed', () => ({ finishedAt: now() }));
    },

    fail: (id, errorMessage) => {
      transition(set, id, 'failed', () => ({ finishedAt: now(), errorMessage }));
    },

    cancel: (id) => {
      transition(set, id, 'cancelled', () => ({ finishedAt: now() }));
    },

    cancelAllActive: () => {
      const finishedAt = now();
      set((state) => ({
        transfers: state.transfers.map((t) =>
          isActiveStatus(t.status) ? { ...t, status: 'cancelled', finishedAt } : t,
        ),
      }));
    },

    reset: () => {
      speedSamples = {};
      set({ transfers: [] });
    },
  }));
}

/** Instância padrão do store, usada em produção (app real). */
export const useTransferStore = createTransferStore();
