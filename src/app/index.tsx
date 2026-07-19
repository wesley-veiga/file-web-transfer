import { useEffect } from 'react';
import * as SplashScreen from 'expo-splash-screen';
import { ServerHomeScreen } from '@/features/server/components';

export default function HomeScreen() {
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

  const handleCreateNetworkPress = () => {
    // TODO(#208): Implementar fluxo de criação de rede
  };

  return <ServerHomeScreen onCreateNetworkPress={handleCreateNetworkPress} />;
}
