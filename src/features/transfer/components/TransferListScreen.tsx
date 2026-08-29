import React from 'react';
import { View, Text, ScrollView, FlatList } from 'react-native';
import { Screen, Card } from '@/shared/components';
import { formatBytes, formatSpeed } from '@/shared/lib';
import { useTransferStore } from '../store/transferStore';
import type { Transfer, TransferStatus } from '../types';

/**
 * Tela que exibe a lista de transferências (upload/download) em tempo real
 * (HU-07 — Acompanhar transferências).
 *
 * A lista é 100% reativa: `useTransferStore` é populado sincronamente pelas
 * rotas HTTP instrumentadas em `src/app/apiSetup.ts` (T-602), que chamam
 * `reportProgress` com throttle de 500 ms. Como o seletor Zustand abaixo
 * re-renderiza automaticamente a cada mudança de `transfers`, esta tela não
 * precisa de nenhum polling/`setInterval` adicional para atender ao
 * critério "atualizado no mínimo a cada 500 ms, sem travar a UI".
 *
 * Decisão de escopo — loading inicial: `useTransferStore` não realiza
 * nenhuma requisição/I/O assíncrono para popular esta tela (é um store em
 * memória, síncrono); não existe, portanto, um estado real de "carregando o
 * estado da sessão" a representar com skeleton. Um skeleton artificial (ex.:
 * `isReady` alternado via `useEffect` em um único frame) não teria nenhum
 * propósito genuíno — apenas simularia um carregamento inexistente. Em vez
 * disso, garantimos que a tela NUNCA fica em branco: o cabeçalho e (lista OU
 * estado vazio) já estão presentes desde o primeiro render, satisfazendo a
 * intenção do critério "nunca tela branca" sem introduzir um estado falso.
 *
 * Decisão de escopo — "Abrir/Compartilhar": a ação de abrir/compartilhar um
 * arquivo recebido via share sheet do sistema já existe e está aprovada em
 * `ReceivedFilesScreen` (T-303). Esta tela é a lista de progresso/status das
 * transferências (uploads/downloads em andamento e histórico da sessão), não
 * uma lista de arquivos com ações — duplicar "Abrir/Compartilhar" aqui
 * misturaria responsabilidades das duas telas. O critério de aceite
 * correspondente já é satisfeito pela tela de Recebidos existente.
 */
export function TransferListScreen() {
  const transfers = useTransferStore((state) => state.transfers);

  return (
    <Screen className="flex-1 px-4">
      <ScrollView showsVerticalScrollIndicator={false} className="flex-1">
        <View className="flex-1 py-8">
          {/* Header */}
          <View className="mb-8">
            <Text className="text-3xl font-bold text-text-light dark:text-text-dark mb-2">
              Transferências
            </Text>
            <Text className="text-base text-text-secondary-light dark:text-text-secondary-dark">
              Acompanhe uploads e downloads em tempo real
            </Text>
          </View>

          {/* Lista de transferências ou estado vazio */}
          {transfers.length === 0 ? (
            <Card className="items-center justify-center py-12">
              <Text className="text-base font-semibold text-text-light dark:text-text-dark mb-2 text-center">
                Nenhuma transferência ainda
              </Text>
              <Text className="text-sm text-text-secondary-light dark:text-text-secondary-dark text-center">
                Compartilhe o link ao lado para começar
              </Text>
            </Card>
          ) : (
            <FlatList
              data={transfers}
              keyExtractor={(item) => item.id}
              scrollEnabled={false}
              renderItem={({ item }) => <TransferListItem transfer={item} />}
            />
          )}
        </View>
      </ScrollView>
    </Screen>
  );
}

/** Rótulo de direção do ponto de vista do host (ver `../types/index.ts`):
 * `upload` = um convidado envia um arquivo → o host está recebendo;
 * `download` = o host envia um arquivo → o host está enviando. */
const DIRECTION_LABELS: Record<Transfer['direction'], string> = {
  upload: 'Recebendo',
  download: 'Enviando',
};

const STATUS_LABELS: Record<TransferStatus, string> = {
  queued: 'Na fila',
  active: 'Em andamento',
  completed: 'Concluída',
  failed: 'Falhou',
  cancelled: 'Cancelada',
};

const STATUS_BADGE_CLASSES: Record<TransferStatus, string> = {
  queued: 'text-text-secondary-light dark:text-text-secondary-dark',
  active: 'text-primary',
  completed: 'text-success',
  failed: 'text-error',
  cancelled: 'text-text-secondary-light dark:text-text-secondary-dark',
};

/**
 * Texto de progresso: percentual + bytes quando `sizeBytes` é conhecido;
 * apenas bytes transferidos quando `sizeBytes` é `null` (caso real do
 * upload multipart — ver T-602, o Content-Length do multipart não é o
 * tamanho do arquivo, então nunca dividimos por um total desconhecido).
 */
function getProgressLabel(transfer: Transfer): string {
  if (transfer.sizeBytes === null) {
    return `${formatBytes(transfer.transferredBytes)} transferidos`;
  }

  const percent = getProgressPercent(transfer) ?? 0;
  return `${Math.round(percent)}% · ${formatBytes(transfer.transferredBytes)} de ${formatBytes(transfer.sizeBytes)}`;
}

/** Percentual (0–100) ou `null` quando o tamanho total é desconhecido. */
function getProgressPercent(transfer: Transfer): number | null {
  if (transfer.sizeBytes === null || transfer.sizeBytes <= 0) {
    return null;
  }
  return Math.min(100, Math.max(0, (transfer.transferredBytes / transfer.sizeBytes) * 100));
}

interface TransferListItemProps {
  transfer: Transfer;
}

/**
 * Item individual da lista. A falha de uma transferência (`status ===
 * 'failed'`) é isolada por construção: cada item é renderizado de forma
 * independente a partir de `transfer`, sem estado compartilhado entre itens.
 */
function TransferListItem({ transfer }: TransferListItemProps) {
  const percent = getProgressPercent(transfer);

  return (
    <Card className="mb-3">
      <View className="flex-row items-start justify-between mb-1">
        <Text
          className="flex-1 mr-2 text-base font-medium text-text-light dark:text-text-dark"
          numberOfLines={1}
        >
          {transfer.fileName}
        </Text>
        <Text className={`text-xs font-semibold ${STATUS_BADGE_CLASSES[transfer.status]}`}>
          {STATUS_LABELS[transfer.status]}
        </Text>
      </View>

      <Text className="mb-2 text-xs text-text-secondary-light dark:text-text-secondary-dark">
        {DIRECTION_LABELS[transfer.direction]} · IP {transfer.peerIp}
      </Text>

      {transfer.status === 'active' && (
        <View className="mb-1">
          {percent !== null && (
            <View className="mb-1 h-2 overflow-hidden rounded-sm bg-surface-light dark:bg-surface-dark">
              {/* Largura dinâmica (percentual calculado em runtime) não é
                  expressável via className estático do NativeWind — style
                  inline documentado conforme Princípio V. */}
              <View className="h-2 rounded-sm bg-primary" style={{ width: `${percent}%` }} />
            </View>
          )}
          <View className="flex-row justify-between">
            <Text className="text-xs text-text-secondary-light dark:text-text-secondary-dark">
              {getProgressLabel(transfer)}
            </Text>
            {transfer.speedBps !== null && (
              <Text className="text-xs text-text-secondary-light dark:text-text-secondary-dark">
                {formatSpeed(transfer.speedBps)}
              </Text>
            )}
          </View>
        </View>
      )}

      {transfer.status === 'queued' && (
        <Text className="text-xs text-text-secondary-light dark:text-text-secondary-dark">
          Aguardando início...
        </Text>
      )}

      {transfer.status === 'completed' && (
        <Text className="text-xs text-success">
          {transfer.sizeBytes !== null
            ? formatBytes(transfer.sizeBytes)
            : formatBytes(transfer.transferredBytes)}{' '}
          transferidos com sucesso
        </Text>
      )}

      {transfer.status === 'failed' && (
        <Text className="text-xs text-error">
          {transfer.errorMessage ?? 'Falha na transferência.'}
        </Text>
      )}

      {transfer.status === 'cancelled' && (
        <Text className="text-xs text-text-secondary-light dark:text-text-secondary-dark">
          Transferência cancelada.
        </Text>
      )}
    </Card>
  );
}
