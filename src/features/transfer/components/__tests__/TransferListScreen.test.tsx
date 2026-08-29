/**
 * Suíte de testes completa do TransferListScreen (T-603, HU-07 — Acompanhar
 * transferências).
 *
 * Cobre:
 * - Estado vazio (nenhuma transferência no store).
 * - Os 5 status de transferência (`queued`, `active`, `completed`, `failed`,
 *   `cancelled`) e seus rótulos/mensagens complementares.
 * - Rótulo de direção do ponto de vista do host (`upload` → "Recebendo",
 *   `download` → "Enviando").
 * - Cálculo de progresso (`getProgressPercent`/`getProgressLabel`, indiretamente
 *   via texto renderizado): percentual arredondado com `sizeBytes` conhecido,
 *   ausência de percentual com `sizeBytes: null`, divisão por zero evitada com
 *   `sizeBytes` zero/negativo, e clamp em 100% quando `transferredBytes`
 *   excede `sizeBytes` (situação anômala).
 * - Ausência de velocidade quando `speedBps` é `null` durante `active`.
 * - Isolamento de `errorMessage` entre itens da lista.
 * - Renderização simultânea de múltiplos itens com status variados.
 * - Reatividade: a tela atualiza automaticamente após ações no store
 *   (`reportProgress`, `complete`), sem re-render manual, provando que o
 *   seletor Zustand funciona.
 *
 * `render()` de `@testing-library/react-native` é assíncrono neste projeto —
 * todo teste usa `await render(...)` (ver `ReceivedFilesScreen.test.tsx`).
 */

import React from 'react';
import { render, cleanup, act } from '@testing-library/react-native';
import { TransferListScreen } from '../TransferListScreen';
import { useTransferStore } from '../../store/transferStore';
import type { Transfer } from '../../types';

/** Epoch fixo — nunca usamos `Date.now()` real em dados de teste. */
const FIXED_TIME = 1_700_000_000_000;

function makeTransfer(overrides: Partial<Transfer> = {}): Transfer {
  return {
    id: 't-1',
    direction: 'upload',
    fileName: 'arquivo.bin',
    sizeBytes: 1000,
    transferredBytes: 0,
    status: 'queued',
    peerIp: '192.168.0.10',
    startedAt: FIXED_TIME,
    finishedAt: null,
    speedBps: null,
    errorMessage: null,
    ...overrides,
  };
}

describe('TransferListScreen (T-603)', () => {
  afterEach(() => {
    cleanup();
    useTransferStore.getState().reset();
  });

  describe('estado vazio', () => {
    it('exibe mensagem e instrução quando não há transferências no store', async () => {
      useTransferStore.setState({ transfers: [] });

      const { getByText } = await render(<TransferListScreen />);

      expect(getByText('Nenhuma transferência ainda')).toBeTruthy();
      expect(getByText('Compartilhe o link ao lado para começar')).toBeTruthy();
    });
  });

  describe('status', () => {
    it('renderiza status "queued" com "Na fila" e "Aguardando início..."', async () => {
      useTransferStore.setState({ transfers: [makeTransfer({ status: 'queued' })] });

      const { getByText } = await render(<TransferListScreen />);

      expect(getByText('Na fila')).toBeTruthy();
      expect(getByText('Aguardando início...')).toBeTruthy();
    });

    it('renderiza status "active" com "Em andamento" e o progresso calculado', async () => {
      useTransferStore.setState({
        transfers: [makeTransfer({ status: 'active', transferredBytes: 500, sizeBytes: 1000 })],
      });

      const { getByText } = await render(<TransferListScreen />);

      expect(getByText('Em andamento')).toBeTruthy();
      expect(getByText('50% · 500 B de 1000 B')).toBeTruthy();
    });

    it('renderiza status "completed" com "Concluída" e o tamanho total transferido com sucesso', async () => {
      useTransferStore.setState({
        transfers: [
          makeTransfer({
            status: 'completed',
            sizeBytes: 2048,
            transferredBytes: 2048,
            finishedAt: FIXED_TIME + 1000,
          }),
        ],
      });

      const { getByText } = await render(<TransferListScreen />);

      expect(getByText('Concluída')).toBeTruthy();
      expect(getByText('2 KB transferidos com sucesso')).toBeTruthy();
    });

    it('usa transferredBytes (não sizeBytes) no texto de sucesso quando sizeBytes é null', async () => {
      useTransferStore.setState({
        transfers: [makeTransfer({ status: 'completed', sizeBytes: null, transferredBytes: 4096 })],
      });

      const { getByText } = await render(<TransferListScreen />);

      expect(getByText('4 KB transferidos com sucesso')).toBeTruthy();
    });

    it('renderiza status "failed" com "Falhou" e a mensagem de erro padrão quando errorMessage é null', async () => {
      useTransferStore.setState({
        transfers: [makeTransfer({ status: 'failed', errorMessage: null })],
      });

      const { getByText } = await render(<TransferListScreen />);

      expect(getByText('Falhou')).toBeTruthy();
      expect(getByText('Falha na transferência.')).toBeTruthy();
    });

    it('renderiza status "cancelled" com "Cancelada" e "Transferência cancelada."', async () => {
      useTransferStore.setState({ transfers: [makeTransfer({ status: 'cancelled' })] });

      const { getByText } = await render(<TransferListScreen />);

      expect(getByText('Cancelada')).toBeTruthy();
      expect(getByText('Transferência cancelada.')).toBeTruthy();
    });
  });

  describe('direção', () => {
    it('exibe "Recebendo" para direction "upload" (convidado envia, host recebe)', async () => {
      useTransferStore.setState({
        transfers: [makeTransfer({ direction: 'upload', peerIp: '10.0.0.5' })],
      });

      const { getByText } = await render(<TransferListScreen />);

      expect(getByText('Recebendo · IP 10.0.0.5')).toBeTruthy();
    });

    it('exibe "Enviando" para direction "download" (host envia ao convidado)', async () => {
      useTransferStore.setState({
        transfers: [makeTransfer({ direction: 'download', peerIp: '10.0.0.5' })],
      });

      const { getByText } = await render(<TransferListScreen />);

      expect(getByText('Enviando · IP 10.0.0.5')).toBeTruthy();
    });
  });

  describe('cálculo de progresso', () => {
    it('calcula percentual arredondado e formata bytes transferidos/total quando sizeBytes é conhecido', async () => {
      useTransferStore.setState({
        transfers: [makeTransfer({ status: 'active', sizeBytes: 3000, transferredBytes: 1000 })],
      });

      const { getByText } = await render(<TransferListScreen />);

      // 1000/3000 = 33.33...% → arredondado para 33%.
      expect(getByText('33% · 1000 B de 2.9 KB')).toBeTruthy();
    });

    it('exibe apenas bytes transferidos, sem percentual, quando sizeBytes é null', async () => {
      useTransferStore.setState({
        transfers: [makeTransfer({ status: 'active', sizeBytes: null, transferredBytes: 2048 })],
      });

      const { getByText, queryByText } = await render(<TransferListScreen />);

      expect(getByText('2 KB transferidos')).toBeTruthy();
      expect(queryByText(/%/)).toBeNull();
    });

    it('não divide por zero quando sizeBytes é 0 (percentual tratado como 0%, sem NaN/Infinity)', async () => {
      useTransferStore.setState({
        transfers: [makeTransfer({ status: 'active', sizeBytes: 0, transferredBytes: 500 })],
      });

      const { getByText, queryByText } = await render(<TransferListScreen />);

      expect(getByText('0% · 500 B de 0 B')).toBeTruthy();
      expect(queryByText(/NaN|Infinity/)).toBeNull();
    });

    it('não divide por zero quando sizeBytes é negativo (percentual tratado como 0%, sem NaN/Infinity)', async () => {
      useTransferStore.setState({
        transfers: [makeTransfer({ status: 'active', sizeBytes: -100, transferredBytes: 500 })],
      });

      const { getByText, queryByText } = await render(<TransferListScreen />);

      expect(getByText('0% · 500 B de 100 B')).toBeTruthy();
      expect(queryByText(/NaN|Infinity/)).toBeNull();
    });

    it('clampa o percentual em 100% quando transferredBytes excede sizeBytes (situação anômala)', async () => {
      useTransferStore.setState({
        transfers: [makeTransfer({ status: 'active', sizeBytes: 1000, transferredBytes: 1500 })],
      });

      const { getByText } = await render(<TransferListScreen />);

      // Percentual nunca ultrapassa 100%, mesmo com bytes transferidos > total.
      expect(getByText('100% · 1.5 KB de 1000 B')).toBeTruthy();
    });
  });

  describe('velocidade', () => {
    it('exibe a velocidade formatada quando speedBps está definido durante "active"', async () => {
      useTransferStore.setState({
        transfers: [
          makeTransfer({
            status: 'active',
            speedBps: 2048,
            transferredBytes: 500,
            sizeBytes: 1000,
          }),
        ],
      });

      const { getByText } = await render(<TransferListScreen />);

      expect(getByText('2 KB/s')).toBeTruthy();
    });

    it('não exibe velocidade quando speedBps é null durante "active" (sem amostras suficientes)', async () => {
      useTransferStore.setState({
        transfers: [
          makeTransfer({
            status: 'active',
            speedBps: null,
            transferredBytes: 500,
            sizeBytes: 1000,
          }),
        ],
      });

      const { queryByText } = await render(<TransferListScreen />);

      expect(queryByText(/\/s$/)).toBeNull();
    });
  });

  describe('isolamento de errorMessage entre itens', () => {
    it('exibe o errorMessage do item "failed" sem afetar o item "completed" ao lado', async () => {
      useTransferStore.setState({
        transfers: [
          makeTransfer({
            id: 't-failed',
            fileName: 'falhou.zip',
            status: 'failed',
            errorMessage: 'Conexão perdida com o peer.',
          }),
          makeTransfer({
            id: 't-completed',
            fileName: 'ok.zip',
            status: 'completed',
            sizeBytes: 1024,
            transferredBytes: 1024,
          }),
        ],
      });

      const { getByText, queryByText } = await render(<TransferListScreen />);

      expect(getByText('falhou.zip')).toBeTruthy();
      expect(getByText('Conexão perdida com o peer.')).toBeTruthy();
      expect(getByText('ok.zip')).toBeTruthy();
      expect(getByText('1 KB transferidos com sucesso')).toBeTruthy();
      // O item completo não deve exibir a mensagem de erro padrão nem a do outro item.
      expect(queryByText('Falha na transferência.')).toBeNull();
    });
  });

  describe('lista com status mistos', () => {
    it('renderiza corretamente múltiplos itens com todos os status simultaneamente', async () => {
      useTransferStore.setState({
        transfers: [
          makeTransfer({ id: 't-q', fileName: 'fila.txt', status: 'queued' }),
          makeTransfer({
            id: 't-a',
            fileName: 'ativo.txt',
            status: 'active',
            transferredBytes: 250,
            sizeBytes: 1000,
          }),
          makeTransfer({
            id: 't-c',
            fileName: 'completo.txt',
            status: 'completed',
            sizeBytes: 500,
            transferredBytes: 500,
          }),
          makeTransfer({
            id: 't-f',
            fileName: 'falho.txt',
            status: 'failed',
            errorMessage: 'Erro X',
          }),
          makeTransfer({ id: 't-x', fileName: 'cancelado.txt', status: 'cancelled' }),
        ],
      });

      const { getByText } = await render(<TransferListScreen />);

      expect(getByText('fila.txt')).toBeTruthy();
      expect(getByText('Na fila')).toBeTruthy();

      expect(getByText('ativo.txt')).toBeTruthy();
      expect(getByText('Em andamento')).toBeTruthy();

      expect(getByText('completo.txt')).toBeTruthy();
      expect(getByText('Concluída')).toBeTruthy();

      expect(getByText('falho.txt')).toBeTruthy();
      expect(getByText('Falhou')).toBeTruthy();
      expect(getByText('Erro X')).toBeTruthy();

      expect(getByText('cancelado.txt')).toBeTruthy();
      expect(getByText('Cancelada')).toBeTruthy();
    });
  });

  describe('reatividade', () => {
    it('atualiza o progresso exibido automaticamente após reportProgress() no store, sem re-render manual', async () => {
      const id = 'react-1';
      useTransferStore.setState({
        transfers: [makeTransfer({ id, status: 'active', transferredBytes: 100, sizeBytes: 1000 })],
      });

      const { getByText, queryByText } = await render(<TransferListScreen />);

      expect(getByText('10% · 100 B de 1000 B')).toBeTruthy();

      await act(async () => {
        useTransferStore.getState().reportProgress(id, 500);
      });

      expect(queryByText('10% · 100 B de 1000 B')).toBeNull();
      expect(getByText('50% · 500 B de 1000 B')).toBeTruthy();
    });

    it('reflete a transição de status automaticamente após complete() no store', async () => {
      const id = 'react-2';
      useTransferStore.setState({
        transfers: [
          makeTransfer({ id, status: 'active', transferredBytes: 1000, sizeBytes: 1000 }),
        ],
      });

      const { getByText, queryByText } = await render(<TransferListScreen />);

      expect(getByText('Em andamento')).toBeTruthy();

      await act(async () => {
        useTransferStore.getState().complete(id);
      });

      expect(queryByText('Em andamento')).toBeNull();
      expect(getByText('Concluída')).toBeTruthy();
    });
  });
});
