import { useEffect, useState } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import { ServerHomeScreen } from '@/features/server/components';
import { TransferListScreen } from '@/features/transfer/components';
import { useTransferStore } from '@/features/transfer/store/transferStore';

/**
 * Botão flutuante que abre a lista de transferências como um modal por cima
 * da tela do servidor (T-701 — "Transferências" deixou de ser uma aba fixa;
 * agora é um popup, como o menu de downloads de um navegador).
 *
 * Composição em `src/app/` (não em `features/server`) porque as boundaries do
 * projeto proíbem uma feature importar de outra feature diretamente — só
 * `app`/`bootstrap` podem compor `features/server` com `features/transfer`.
 */
export default function HomeScreen() {
  const [isTransfersVisible, setIsTransfersVisible] = useState(false);
  const activeTransfersCount = useTransferStore(
    (state) => state.transfers.filter((t) => t.status === 'queued' || t.status === 'active').length,
  );

  useEffect(() => {
    const hideSplash = async () => {
      try {
        await SplashScreen.hideAsync();
      } catch {
        // Ignora falha ao esconder a splash screen: não deve impedir o app de renderizar.
      }
    };
    hideSplash();
  }, []);

  return (
    <View className="flex-1">
      <ServerHomeScreen />

      <Pressable
        onPress={() => setIsTransfersVisible(true)}
        accessibilityRole="button"
        accessibilityLabel="Ver transferências"
        testID="transfers-fab"
        className="absolute bottom-6 right-6 h-14 w-14 items-center justify-center rounded-full bg-primary shadow-lg"
      >
        <Text className="text-2xl">⇅</Text>
        {activeTransfersCount > 0 && (
          <View
            testID="transfers-fab-badge"
            className="absolute -right-1 -top-1 h-5 min-w-5 items-center justify-center rounded-full bg-error px-1"
          >
            <Text className="text-xs font-bold text-white">{activeTransfersCount}</Text>
          </View>
        )}
      </Pressable>

      <Modal
        visible={isTransfersVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setIsTransfersVisible(false)}
      >
        <View className="flex-1 bg-background-light dark:bg-background-dark">
          <View className="flex-row items-center justify-end px-4 pt-4">
            <Pressable
              onPress={() => setIsTransfersVisible(false)}
              accessibilityRole="button"
              accessibilityLabel="Fechar"
              testID="transfers-modal-close"
            >
              <Text className="text-base font-semibold text-primary">Fechar</Text>
            </Pressable>
          </View>
          <TransferListScreen />
        </View>
      </Modal>
    </View>
  );
}
