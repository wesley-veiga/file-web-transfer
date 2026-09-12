import { useEffect } from 'react';
import { Text } from 'react-native';
import { useRouter } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { Screen } from '@/shared/components/Screen';
import { Button } from '@/shared/components/Button';

/**
 * T-905 — Tela inicial (Home idle)
 *
 * Exibida quando o app é aberto diretamente (sem compartilhamento de arquivo do SO).
 * Mostra título "Transfer Files", texto de orientação e botão "Receber arquivo"
 * que navega para a tela de Receber (T-906).
 *
 * Critérios de aceite (HU-10):
 * - Título: "Transfer Files"
 * - Texto de apoio: "Para compartilhar, navegue até um arquivo, clique em compartilhar, selecione este aplicativo como destino."
 * - Botão azul centralizado: "Receber arquivo", navegando para a tela de Receber
 */
export default function HomeIdleScreen() {
  const router = useRouter();

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

  const handleReceivePress = () => {
    router.push('/receive');
  };

  return (
    <Screen className="items-center justify-center px-6">
      {/* Título */}
      <Text className="mb-6 text-3xl font-bold text-text-light dark:text-text-dark">
        Transfer Files
      </Text>

      {/* Texto de apoio */}
      <Text className="mb-12 text-center text-base text-text-secondary-light dark:text-text-secondary-dark leading-6">
        Para compartilhar, navegue até um arquivo, clique em compartilhar, selecione este aplicativo
        como destino.
      </Text>

      {/* Botão "Receber arquivo" */}
      <Button
        label="Receber arquivo"
        variant="primary"
        size="lg"
        onPress={handleReceivePress}
        testID="receive-button"
        className="w-full"
      />
    </Screen>
  );
}
