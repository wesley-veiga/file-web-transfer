import React, { useEffect, useMemo } from 'react';
import { View, Text, ScrollView, ActivityIndicator, Alert } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { Screen, Button, Card } from '@/shared/components';
import { useServer } from '@/features/server/hooks/useServer';
import { useServerStore } from '@/features/server/store/serverStore';
import { useTransferStore } from '@/features/transfer/store/transferStore';
import { useReceivedFiles } from '@/features/files/hooks/useReceivedFiles';
import { formatBytes } from '@/shared/lib';
import type { HttpModule } from '@/features/server/services/httpModule';
import type { Transfer } from '@/features/transfer/types';

interface ReceiveScreenProps {
  httpModule?: HttpModule;
}

/**
 * T-906 — Tela "Receber": gerar QR + token visível
 *
 * Ao tocar em "Receber arquivo" (T-905), inicia o servidor em modo `'receive'` (T-902)
 * e exibe o QR Code (URL + `?token=<token>`) e também o **token como texto visível**
 * (rótulo dedicado, diferente do uso do token como título na T-904).
 *
 * Mostra progresso de upload(s) em andamento (reaproveita T-601) e, ao concluir,
 * ação inline "Abrir/Compartilhar" para o arquivo recebido, reaproveitando o
 * comportamento da antiga aba Recebidos (T-303, descontinuada como aba).
 *
 * Estados cobertos:
 * - idle: servidor não iniciado, mostrando QR Code e token
 * - iniciando: spinner enquanto servidor está começando
 * - erro: mostrando mensagem de erro com botão retry
 * - recebendo: mostrando progresso de upload(s) ativa(s)
 * - concluído: mostrando arquivo recebido com ação "Abrir/Compartilhar"
 */
export default function ReceiveScreen({ httpModule }: ReceiveScreenProps) {
  const { start } = useServer(httpModule);
  const serverInfo = useServerStore((state) => state.serverInfo);
  const transfers = useTransferStore((state) => state.transfers);
  const { openFile, shareFile } = useReceivedFiles();

  // Determinar o estado atual da tela
  const activeTransfers = useMemo(
    () => transfers.filter((t) => t.status === 'active' || t.status === 'queued'),
    [transfers],
  );

  const completedTransfers = useMemo(
    () => transfers.filter((t) => t.status === 'completed'),
    [transfers],
  );

  // Iniciar servidor ao montar a tela
  useEffect(() => {
    const initServer = async () => {
      // Se o servidor já está rodando em modo receive, não faz nada
      if (serverInfo.status === 'running' && serverInfo.mode === 'receive') {
        return;
      }

      // Se o servidor está em outro estado que não é idle, não tenta iniciar
      if (serverInfo.status !== 'idle' && serverInfo.status !== 'error') {
        return;
      }

      try {
        await start('wifi', 'receive');
      } catch (error) {
        console.error('[ReceiveScreen] Erro ao iniciar servidor:', error);
        if (error instanceof Error && error.cause !== undefined) {
          console.error('[ReceiveScreen] Causa original:', error.cause);
        }
      }
    };

    initServer();
  }, [start, serverInfo.status, serverInfo.mode]);

  const handleRetryPress = async () => {
    try {
      await start('wifi', 'receive');
    } catch (error) {
      console.error('[ReceiveScreen] Erro ao tentar novamente:', error);
      if (error instanceof Error && error.cause !== undefined) {
        console.error('[ReceiveScreen] Causa original:', error.cause);
      }
    }
  };

  const handleOpenFile = (fileId: string, fileName: string) => {
    openFile(fileId).catch((error) => {
      console.error('[ReceiveScreen] Erro ao abrir arquivo:', error);
      Alert.alert('Erro', `Não foi possível abrir "${fileName}".`);
    });
  };

  const handleShareFile = (fileId: string, fileName: string) => {
    shareFile(fileId).catch((error) => {
      console.error('[ReceiveScreen] Erro ao compartilhar arquivo:', error);
      Alert.alert('Erro', `Não foi possível compartilhar "${fileName}".`);
    });
  };

  return (
    <Screen className="flex-1 px-4">
      <ScrollView
        showsVerticalScrollIndicator={false}
        className="flex-1"
        contentContainerClassName="pb-8"
      >
        <View className="flex-1 py-8">
          {/* Header */}
          <View className="mb-8">
            <Text className="text-3xl font-bold text-text-light dark:text-text-dark mb-2">
              Receber arquivo
            </Text>
            <Text className="text-base text-text-secondary-light dark:text-text-secondary-dark">
              Compartilhe o QR Code ou o código de acesso
            </Text>
          </View>

          {/* Estado: Iniciando */}
          {serverInfo.status === 'starting' && (
            <View className="items-center justify-center py-12">
              <ActivityIndicator size="large" color="#3B82F6" className="mb-4" />
              <Text className="text-base text-text-light dark:text-text-dark font-semibold">
                Iniciando servidor...
              </Text>
            </View>
          )}

          {/* Estado: Erro */}
          {serverInfo.status === 'error' && serverInfo.error && (
            <View>
              <Card className="mb-6 bg-error-light dark:bg-error-dark">
                <Text className="text-base font-semibold text-text-light dark:text-text-dark mb-2">
                  Erro ao iniciar servidor
                </Text>
                <Text className="text-sm text-text-light dark:text-text-dark">
                  {serverInfo.error.message}
                </Text>
              </Card>

              <Button
                label="Tentar novamente"
                variant="primary"
                size="lg"
                onPress={handleRetryPress}
                className="w-full"
              />
            </View>
          )}

          {/* Estado: Running - Idle (aguardando upload) ou Recebendo */}
          {serverInfo.status === 'running' && serverInfo.url && serverInfo.token && (
            <View>
              {/* QR Code */}
              <Card className="mb-6 items-center justify-center py-6">
                <QRCode value={serverInfo.url} size={200} />
              </Card>

              {/* Token visível */}
              <Card className="mb-6">
                <Text className="text-sm font-semibold text-text-secondary-light dark:text-text-secondary-dark mb-2 uppercase">
                  Código de acesso
                </Text>
                <Text
                  className="text-xl font-bold text-text-light dark:text-text-dark"
                  selectable
                >
                  {serverInfo.token}
                </Text>
              </Card>

              {/* Estado: Recebendo (upload em andamento) */}
              {activeTransfers.length > 0 && (
                <View>
                  <Card className="mb-6">
                    <Text className="text-base font-semibold text-text-light dark:text-text-dark mb-4">
                      Transferência em andamento
                    </Text>

                    {activeTransfers.map((transfer: Transfer) => (
                      <View key={transfer.id} className="mb-4">
                        <View className="mb-2">
                          <Text
                            className="text-sm font-medium text-text-light dark:text-text-dark"
                            numberOfLines={1}
                          >
                            {transfer.fileName}
                          </Text>
                          <Text className="text-xs text-text-secondary-light dark:text-text-secondary-dark mt-1">
                            {transfer.sizeBytes !== null
                              ? `${formatBytes(transfer.transferredBytes)} / ${formatBytes(transfer.sizeBytes)}`
                              : `${formatBytes(transfer.transferredBytes)}`}
                          </Text>
                        </View>

                        {/* Progress bar */}
                        <View className="w-full h-2 bg-surface-light dark:bg-surface-dark rounded-full overflow-hidden">
                          <View
                            className="h-full bg-primary rounded-full"
                            style={{
                              width: `${
                                transfer.sizeBytes
                                  ? Math.round(
                                      (transfer.transferredBytes / transfer.sizeBytes) *
                                        100,
                                    )
                                  : 0
                              }%`,
                            }}
                          />
                        </View>
                      </View>
                    ))}
                  </Card>
                </View>
              )}

              {/* Estado: Arquivo concluído - ação inline */}
              {completedTransfers.length > 0 && activeTransfers.length === 0 && (
                <View>
                  <Card className="mb-6">
                    <Text className="text-base font-semibold text-text-light dark:text-text-dark mb-4">
                      Arquivo recebido
                    </Text>

                    {completedTransfers.map((transfer: Transfer) => (
                      <View
                        key={transfer.id}
                        className="mb-3 pb-3 border-b border-surface-light dark:border-surface-dark last:mb-0 last:pb-0 last:border-b-0"
                      >
                        <View className="mb-3">
                          <Text
                            className="text-sm font-medium text-text-light dark:text-text-dark"
                            numberOfLines={1}
                          >
                            {transfer.fileName}
                          </Text>
                          <Text className="text-xs text-text-secondary-light dark:text-text-secondary-dark mt-1">
                            {transfer.sizeBytes
                              ? formatBytes(transfer.sizeBytes)
                              : 'Tamanho desconhecido'}
                          </Text>
                        </View>

                        {/* Botões de ação */}
                        <View className="flex-row gap-2 justify-end">
                          <Button
                            label="Abrir"
                            variant="primary"
                            size="sm"
                            onPress={() =>
                              handleOpenFile(transfer.id, transfer.fileName)
                            }
                          />
                          <Button
                            label="Compartilhar"
                            variant="secondary"
                            size="sm"
                            onPress={() =>
                              handleShareFile(transfer.id, transfer.fileName)
                            }
                          />
                        </View>
                      </View>
                    ))}
                  </Card>
                </View>
              )}

              {/* Estado: Idle (aguardando primeiro upload) */}
              {activeTransfers.length === 0 && completedTransfers.length === 0 && (
                <Card className="mb-6 bg-surface-light dark:bg-surface-dark">
                  <Text className="text-base font-semibold text-text-light dark:text-text-dark mb-2">
                    Aguardando arquivo
                  </Text>
                  <Text className="text-sm text-text-secondary-light dark:text-text-secondary-dark">
                    O convidado pode escanear o QR Code ou digitar o código de acesso para
                    enviar um arquivo.
                  </Text>
                </Card>
              )}
            </View>
          )}
        </View>
      </ScrollView>
    </Screen>
  );
}
