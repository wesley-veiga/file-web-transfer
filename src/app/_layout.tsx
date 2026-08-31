import '../global.css';
import { useEffect } from 'react';
import * as SplashScreen from 'expo-splash-screen';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { useColorScheme } from 'react-native';
import { useAppLifecycle } from '@/features/server/hooks';
import { useServerStore } from '@/features/server/store/serverStore';
import { initServer, setCurrentSessionId } from '@/bootstrap/serverBootstrap';

SplashScreen.preventAutoHideAsync();

// Fiação do servidor HTTP embarcado (T-405): registra o HttpModule real e monta o
// ApiRouter uma única vez, no carregamento deste módulo (antes de qualquer render).
initServer();

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const sessionId = useServerStore(function selectSessionId(state) {
    return state.serverInfo.sessionId;
  });

  // Monitorar ciclo de vida do app: notificação persistente e stop do servidor ao sair
  useAppLifecycle();

  // Mantém o sessionId lido por GET /api/session sincronizado com o sessionId real
  // gerado a cada ServerService.start() (o ApiRouter foi montado uma única vez acima).
  useEffect(
    function syncSessionId() {
      if (sessionId) {
        setCurrentSessionId(sessionId);
      }
    },
    [sessionId],
  );

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack
        screenOptions={{
          headerShown: false,
        }}
      />
    </ThemeProvider>
  );
}
