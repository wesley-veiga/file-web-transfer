import React, { useEffect, useMemo, useRef } from 'react';
import { View, Text, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import QRCode from 'react-native-qrcode-svg';
import { activateKeepAwake, deactivateKeepAwake } from 'expo-keep-awake';
import { Screen, Button, Card } from '@/shared/components';
import { useServer } from '@/features/server/hooks/useServer';
import { useServerStore } from '@/features/server/store/serverStore';
import { useTransferStore } from '@/features/transfer/store/transferStore';
import { formatBytes } from '@/shared/lib';
import type { HttpModule } from '@/features/server/services/httpModule';
import type { Transfer } from '@/features/transfer/types';

interface SendScreenProps {
  httpModule?: HttpModule;
}

/**
 * T-904 — Tela "Enviar": token, QR e progresso com tela sempre acesa
 *
 * Aberta automaticamente quando o app é invocado via compartilhamento do SO (T-903).
 * Inicia o servidor em modo `'send'` (T-902) e exibe o token gerado como **título**
 * da tela (diferente da T-906, onde o token é um rótulo separado).
 *
 * Ao detectar download em andamento (via useTransferStore, T-601), exibe
 * "Transferência em andamento" com progresso e mantém a tela ligada (`expo-keep-awake`)
 * até concluir ou cancelar, desligando o keep-awake logo depois.
 *
 * Erros de servidor reaproveitam o tratamento por `ServerErrorCode` já existente.
 *
 * Estados cobertos:
 * - idle: servidor não iniciado, mostrando QR Code e token
 * - iniciando: spinner enquanto servidor está começando
 * - erro: mostrando mensagem de erro com botão retry
 * - transferindo: mostrando progresso de download(s) ativa(s)
 */
export default function SendScreen({ httpModule }: SendScreenProps) {
  const { start, stop } = useServer(httpModule);
  const router = useRouter();
  const serverInfo = useServerStore((state) => state.serverInfo);
  const transfers = useTransferStore((state) => state.transfers);

  // Ref para rastrear se keep-awake está ativo
  const keepAwakeActiveRef = useRef(false);

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
      // Se o servidor já está rodando em modo send, não faz nada
      if (serverInfo.status === 'running' && serverInfo.mode === 'send') {
        return;
      }

      // Se o servidor está em outro estado que não é idle, não tenta iniciar
      if (serverInfo.status !== 'idle' && serverInfo.status !== 'error') {
        return;
      }

      try {
        await start('wifi', 'send');
      } catch (error) {
        console.error('[SendScreen] Erro ao iniciar servidor:', error);
        if (error instanceof Error && error.cause !== undefined) {
          console.error('[SendScreen] Causa original:', error.cause);
        }
      }
    };

    initServer();
  }, [start, serverInfo.status, serverInfo.mode]);

  // Gerenciar keep-awake durante transferências
  useEffect(() => {
    if (activeTransfers.length > 0) {
      // Ativar keep-awake quando transferência inicia
      if (!keepAwakeActiveRef.current) {
        activateKeepAwake();
        keepAwakeActiveRef.current = true;
      }
    } else {
      // Desativar keep-awake quando não há transferências ativas
      if (keepAwakeActiveRef.current) {
        deactivateKeepAwake();
        keepAwakeActiveRef.current = false;
      }
    }
  }, [activeTransfers.length]);

  // Limpar keep-awake ao desmontar a tela
  useEffect(() => {
    return () => {
      if (keepAwakeActiveRef.current) {
        deactivateKeepAwake();
        keepAwakeActiveRef.current = false;
      }
    };
  }, []);

  const handleRetryPress = async () => {
    try {
      await start('wifi', 'send');
    } catch (error) {
      console.error('[SendScreen] Erro ao tentar novamente:', error);
      if (error instanceof Error && error.cause !== undefined) {
        console.error('[SendScreen] Causa original:', error.cause);
      }
    }
  };

  /**
   * T-907 — Encerrar sessão ativa (Enviar/Receber → Home)
   *
   * Se houver transferência em andamento, pede confirmação antes de encerrar.
   * Ao encerrar: para o servidor, volta para Home idle.
   */
  const handleEndSessionPress = () => {
    if (activeTransfers.length > 0) {
      // Com transferência ativa, pede confirmação
      Alert.alert(
        'Encerrar sessão?',
        'Há transferências em andamento. Tem certeza que deseja encerrar a sessão?',
        [
          {
            text: 'Cancelar',
            onPress: () => {
              // Usuário mudou de ideia, não faz nada
            },
            style: 'cancel',
          },
          {
            text: 'Encerrar',
            onPress: async () => {
              try {
                await stop();
                // Navegar de volta para Home idle após parar o servidor
                router.replace('/');
              } catch (error) {
                console.error('[SendScreen] Erro ao encerrar sessão:', error);
                Alert.alert('Erro', 'Não foi possível encerrar a sessão.');
              }
            },
            style: 'destructive',
          },
        ],
      );
    } else {
      // Sem transferência ativa, encerra direto
      Alert.alert(
        'Encerrar sessão?',
        'Você será levado de volta à tela inicial.',
        [
          {
            text: 'Cancelar',
            onPress: () => {
              // Usuário mudou de ideia, não faz nada
            },
            style: 'cancel',
          },
          {
            text: 'Encerrar',
            onPress: async () => {
              try {
                await stop();
                // Navegar de volta para Home idle após parar o servidor
                router.replace('/');
              } catch (error) {
                console.error('[SendScreen] Erro ao encerrar sessão:', error);
                Alert.alert('Erro', 'Não foi possível encerrar a sessão.');
              }
            },
            style: 'destructive',
          },
        ],
      );
    }
  };

  return (
    <Screen className="flex-1 px-4">
      <ScrollView
        showsVerticalScrollIndicator={false}
        className="flex-1"
        contentContainerClassName="pb-8"
      >
        <View className="flex-1 py-8">
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

          {/* Estado: Running */}
          {serverInfo.status === 'running' && serverInfo.url && serverInfo.token && (
            <View>
              {/* Header com token como título e botão de encerrar sessão */}
              <View className="mb-8 flex-row items-start justify-between">
                <View className="flex-1 pr-4">
                  <Text className="text-3xl font-bold text-text-light dark:text-text-dark mb-2">
                    {serverInfo.token}
                  </Text>
                  <Text className="text-base text-text-secondary-light dark:text-text-secondary-dark">
                    Compartilhe o QR Code ou o código para enviar
                  </Text>
                </View>
                {/* Botão de encerrar sessão — T-907 */}
                <Button
                  label="✕"
                  variant="secondary"
                  size="sm"
                  onPress={handleEndSessionPress}
                  testID="end-session-button"
                  className="mt-0"
                />
              </View>

              {/* QR Code */}
              <Card className="mb-6 items-center justify-center py-6">
                <QRCode value={serverInfo.url} size={200} />
              </Card>

              {/* Estado: Transferindo (download em andamento) */}
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

              {/* Estado: Idle (aguardando primeiro download) */}
              {activeTransfers.length === 0 && completedTransfers.length === 0 && (
                <Card className="mb-6 bg-surface-light dark:bg-surface-dark">
                  <Text className="text-base font-semibold text-text-light dark:text-text-dark mb-2">
                    Aguardando download
                  </Text>
                  <Text className="text-sm text-text-secondary-light dark:text-text-secondary-dark">
                    O convidado pode escanear o QR Code ou digitar o código para baixar o arquivo.
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
