import { useEffect, useRef, useCallback } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { useServerStore } from '../store/serverStore';
import { createServerService } from '../services/serverServiceFactory';
import { createNotificationService } from '../services/notificationService';
import type { HttpModule } from '../services/httpModule';
import type { NotificationService } from '../services/notificationService';

/**
 * Hook que monitora o ciclo de vida do app e gerencia notificação persistente + stop do servidor.
 *
 * Responsabilidades:
 * - Mostrar notificação persistente quando servidor está em estado `running`
 * - Parar o servidor quando o app sai de foreground
 * - Descartar notificação quando servidor para
 *
 * Deve ser usado no layout raiz da app para funcionar durante toda a vida da aplicação.
 *
 * Exemplo:
 * ```tsx
 * export default function RootLayout() {
 *   useAppLifecycle();
 *   return <Stack />;
 * }
 * ```
 */
export function useAppLifecycle(
  httpModule?: HttpModule,
  notificationService?: NotificationService,
) {
  const serverInfo = useServerStore((state) => state.serverInfo);
  const appStateRef = useRef<AppStateStatus>('unknown');
  const notificationIdRef = useRef<string | null>(null);

  // Efeito para notificação persistente
  useEffect(() => {
    // Instanciar serviços (com possibilidade de injeção para testes)
    const notifService = createNotificationService(notificationService);

    // Mostrar notificação quando servidor inicia
    if (serverInfo.status === 'running' && !notificationIdRef.current) {
      notifService
        .requestPermission()
        .then(() => notifService.showPersistentNotification())
        .then((notificationId) => {
          notificationIdRef.current = notificationId;
        })
        .catch((error) => {
          console.warn('[useAppLifecycle] Erro ao mostrar notificação:', error);
        });
    }

    // Descartar notificação quando servidor para
    if (serverInfo.status !== 'running' && notificationIdRef.current) {
      notifService
        .dismissNotification(notificationIdRef.current)
        .catch((error) => {
          console.warn('[useAppLifecycle] Erro ao descartar notificação:', error);
        })
        .finally(() => {
          notificationIdRef.current = null;
        });
    }
  }, [serverInfo.status, notificationService]);

  // Callback para mudanças no AppState
  const handleAppStateChange = useCallback(
    async (nextAppState: AppStateStatus) => {
      // Sair de foreground (app vai para background)
      if (
        appStateRef.current.match(/inactive|background/) === null &&
        nextAppState.match(/inactive|background/) !== null
      ) {
        // App saiu de foreground
        const currentServerInfo = useServerStore.getState().serverInfo;
        if (currentServerInfo.status === 'running') {
          try {
            const serverService = createServerService(httpModule);
            await serverService.stop();
            useServerStore.getState().stopRequested();
            useServerStore.getState().stopped();

            // Descartar notificação
            if (notificationIdRef.current) {
              const notifService = createNotificationService(notificationService);
              await notifService.dismissNotification(notificationIdRef.current);
              notificationIdRef.current = null;
            }
          } catch (error) {
            console.error('[useAppLifecycle] Erro ao parar servidor na saída do app:', error);
          }
        }
      }

      appStateRef.current = nextAppState;
    },
    [httpModule, notificationService],
  );

  // Efeito para monitorar AppState
  useEffect(() => {
    // Inicializar com o estado atual se disponível
    if (AppState.currentState) {
      appStateRef.current = AppState.currentState;
    }

    const subscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      subscription.remove();
    };
  }, [handleAppStateChange]);
}
