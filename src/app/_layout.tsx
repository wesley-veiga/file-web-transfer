import '../global.css';
import { useEffect, useState } from 'react';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider, useRouter } from 'expo-router';
import { useColorScheme } from 'react-native';
import { useAppLifecycle } from '@/features/server/hooks';
import { useServerStore } from '@/features/server/store/serverStore';
import { initServer, setCurrentToken, setCurrentMode } from '@/bootstrap/serverBootstrap';
import { createShareIntentService } from '@/features/files/services/shareIntentService';
import { createFileRepository } from '@/features/files/services/fileRepositoryFactory';

SplashScreen.preventAutoHideAsync();

// Fiação do servidor HTTP embarcado (T-405): registra o HttpModule real e monta o
// ApiRouter uma única vez, no carregamento deste módulo (antes de qualquer render).
initServer();

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const router = useRouter();
  const [shareIntentProcessed, setShareIntentProcessed] = useState(false);
  const token = useServerStore(function selectToken(state) {
    return state.serverInfo.token;
  });
  const mode = useServerStore(function selectMode(state) {
    return state.serverInfo.mode;
  });

  // Monitorar ciclo de vida do app: notificação persistente e stop do servidor ao sair
  useAppLifecycle();

  // Detectar se o app foi aberto via compartilhamento do SO e rotear para /send se necessário
  useEffect(() => {
    const checkShareIntent = async () => {
      try {
        const fileRepository = createFileRepository();
        const shareIntentService = createShareIntentService(fileRepository);
        const result = await shareIntentService.processShareIntent();

        if (result.hasSuccessfulItems) {
          // App foi aberto via share intent com arquivos válidos
          // Navegar para a tela de envio
          router.replace('/send');
        }
        // Se nenhum arquivo foi processado com sucesso, proceder normalmente
      } catch (error) {
        console.error('[RootLayout] Erro ao verificar share intent:', error);
        // Em caso de erro, proceder normalmente
      } finally {
        setShareIntentProcessed(true);
      }
    };

    checkShareIntent();
  }, [router]);

  // Mantém o token lido pela API sincronizado com o token real
  // gerado a cada ServerService.start() (o ApiRouter foi montado uma única vez acima).
  useEffect(
    function syncToken() {
      if (token) {
        setCurrentToken(token);
      }
    },
    [token],
  );

  // Mantém o modo lido pela API sincronizado com o modo real
  useEffect(
    function syncMode() {
      if (mode) {
        setCurrentMode(mode);
      }
    },
    [mode],
  );

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
      {/* Aguarda verificação de share intent antes de renderizar a navegação.
          Evita flash visual da Home idle se app foi aberto via compartilhamento do SO
          (T-904: share intent será detectado e redirecionará para /send antes que o
          Stack seja renderizado, prevenindo exibição breve da Home). */}
      {shareIntentProcessed && (
        <Stack
          screenOptions={{
            headerShown: false,
          }}
        />
      )}
    </ThemeProvider>
  );
}
