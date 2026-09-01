import React from 'react';
import { View, Text, ScrollView, ActivityIndicator, Alert } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { Screen, Button, Card } from '@/shared/components';
import { useServer } from '../hooks/useServer';
import { useServerStore } from '../store/serverStore';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import type { HttpModule } from '../services/httpModule';

interface ServerHomeScreenProps {
  httpModule?: HttpModule;
}

/**
 * Home screen que exibe o estado do servidor e controles para iniciar/parar.
 *
 * Estados suportados:
 * - idle com rede: botão "Iniciar servidor"
 * - idle sem rede: orientação para conectar-se a uma rede Wi-Fi
 * - starting: spinner de carregamento
 * - running: URL, QR Code, sessionId e botão "Parar"
 * - error: mensagem de erro e botão "Tentar novamente"
 */
export function ServerHomeScreen({ httpModule }: ServerHomeScreenProps) {
  const { start, stop } = useServer(httpModule);
  const serverInfo = useServerStore((state) => state.serverInfo);
  const networkStatus = useNetworkStatus();

  const hasNetwork = networkStatus.isConnected;

  const handleStartPress = async () => {
    try {
      await start('wifi');
    } catch (error) {
      // Erro já foi mapeado e armazenado no store — logamos `error.cause` (T-701)
      // porque `ServerServiceError.message` é sempre um texto genérico por
      // `code` (ver `getErrorMessage()` em `useServer.ts`); sem o `cause`, o
      // erro nativo original (ex.: EADDRINUSE vs. timeout) fica invisível tanto
      // na tela quanto no terminal do Metro.
      console.error('[ServerHomeScreen] Erro ao iniciar servidor:', error);
      if (error instanceof Error && error.cause !== undefined) {
        console.error('[ServerHomeScreen] Causa original:', error.cause);
      }
    }
  };

  const handleStopPress = () => {
    // TODO(#601): Verificar se há transferências ativas
    Alert.alert('Parar servidor?', 'Transferências em andamento serão canceladas.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Parar',
        style: 'destructive',
        onPress: async () => {
          try {
            await stop();
          } catch (error) {
            console.error('[ServerHomeScreen] Erro ao parar servidor:', error);
          }
        },
      },
    ]);
  };

  const handleRetryPress = async () => {
    try {
      await start('wifi');
    } catch (error) {
      console.error('[ServerHomeScreen] Erro ao tentar novamente:', error);
      if (error instanceof Error && error.cause !== undefined) {
        console.error('[ServerHomeScreen] Causa original:', error.cause);
      }
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
          {/* Header */}
          <View className="mb-8">
            <Text className="text-3xl font-bold text-text-light dark:text-text-dark mb-2">
              Início
            </Text>
            <Text className="text-base text-text-secondary-light dark:text-text-secondary-dark">
              Compartilhe arquivos na rede local
            </Text>
          </View>

          {/* Estado: Idle com rede */}
          {serverInfo.status === 'idle' && hasNetwork && (
            <View>
              <Card className="mb-6">
                <Text className="text-base font-semibold text-text-light dark:text-text-dark mb-2">
                  Rede disponível
                </Text>
                <Text className="text-sm text-text-secondary-light dark:text-text-secondary-dark">
                  {networkStatus.ssid || 'Wi-Fi conectada'}
                </Text>
              </Card>

              <Button
                label="Iniciar servidor"
                variant="primary"
                size="lg"
                onPress={handleStartPress}
                className="w-full"
              />
            </View>
          )}

          {/* Estado: Idle sem rede */}
          {serverInfo.status === 'idle' && !hasNetwork && (
            <View>
              <Card className="mb-6 bg-warning-light dark:bg-warning-dark">
                <Text className="text-base font-semibold text-text-light dark:text-text-dark mb-2">
                  Nenhuma rede disponível
                </Text>
                <Text className="text-sm text-text-secondary-light dark:text-text-secondary-dark">
                  Conecte-se a uma rede Wi-Fi para compartilhar arquivos.
                </Text>
              </Card>

              <Button
                label="Iniciar servidor"
                variant="primary"
                size="lg"
                disabled
                className="w-full"
              />
            </View>
          )}

          {/* Estado: Starting */}
          {serverInfo.status === 'starting' && (
            <View className="items-center justify-center py-12">
              <ActivityIndicator size="large" color="#3B82F6" className="mb-4" />
              <Text className="text-base text-text-light dark:text-text-dark font-semibold">
                Iniciando servidor...
              </Text>
            </View>
          )}

          {/* Estado: Running */}
          {serverInfo.status === 'running' && serverInfo.url && (
            <View>
              {/* URL Card */}
              <Card className="mb-6">
                <Text className="text-sm font-semibold text-text-secondary-light dark:text-text-secondary-dark mb-2 uppercase">
                  Endereço de acesso
                </Text>
                <Text className="text-lg font-mono text-primary break-all" selectable>
                  {serverInfo.url}
                </Text>
              </Card>

              {/* QR Code */}
              <Card className="mb-6 items-center justify-center py-6">
                {serverInfo.url && <QRCode value={serverInfo.url} size={200} />}
              </Card>

              {/* Session ID */}
              <Card className="mb-6">
                <Text className="text-sm font-semibold text-text-secondary-light dark:text-text-secondary-dark mb-2 uppercase">
                  ID da sessão
                </Text>
                <Text className="text-xl font-bold text-text-light dark:text-text-dark" selectable>
                  {serverInfo.sessionId}
                </Text>
              </Card>

              {/* Stop Button */}
              <Button
                label="Parar servidor"
                variant="error"
                size="lg"
                onPress={handleStopPress}
                className="w-full"
              />
            </View>
          )}

          {/* Estado: Error */}
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

          {/* Estado: Stopping (transiente) */}
          {serverInfo.status === 'stopping' && (
            <View className="items-center justify-center py-12">
              <ActivityIndicator size="large" color="#3B82F6" className="mb-4" />
              <Text className="text-base text-text-light dark:text-text-dark font-semibold">
                Parando servidor...
              </Text>
            </View>
          )}
        </View>
      </ScrollView>
    </Screen>
  );
}
