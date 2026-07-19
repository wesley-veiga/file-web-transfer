import { useEffect } from 'react';
import * as SplashScreen from 'expo-splash-screen';
import { ServerHomeScreen } from '@/features/server/components';

export default function HomeScreen() {
  useEffect(() => {
    const hideSplash = async () => {
      await SplashScreen.hideAsync();
    };
    hideSplash();
  }, []);

  const handleCreateNetworkPress = () => {
    // TODO(#208): Implementar fluxo de criação de rede
  };

  return <ServerHomeScreen onCreateNetworkPress={handleCreateNetworkPress} />;
}
