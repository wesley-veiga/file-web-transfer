import { useEffect, useRef, useCallback } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { useServerStore } from '../store/serverStore';
import { createServerService } from '../services/serverServiceFactory';
import { createNotificationService } from '../services/notificationService';
import { createDefaultForegroundServiceModule } from '../services/foregroundServiceModule';
import type { HttpModule } from '../services/httpModule';
import type { NotificationService } from '../services/notificationService';
import type { ForegroundServiceModule } from '../services/foregroundServiceModule';

/**
 * Hook que monitora o ciclo de vida do app e gerencia notificação persistente + stop do servidor.
 *
 * Responsabilidades:
 * - Mostrar notificação persistente quando servidor está em estado `running`
 * - Parar o servidor quando o app sai de foreground (exceto no caso coberto pela T-808
 *   abaixo, em que o Android tem proteção real de processo)
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
  foregroundServiceModule?: ForegroundServiceModule,
) {
  const serverInfo = useServerStore((state) => state.serverInfo);
  const appStateRef = useRef<AppStateStatus>('unknown');
  const notificationIdRef = useRef<string | null>(null);

  // Efeito para notificação persistente
  useEffect(() => {
    // Instanciar serviços (com possibilidade de injeção para testes)
    const notifService = createNotificationService(notificationService);

    // T-807: no Android, `showPersistentNotification()`/`dismissNotification()` também
    // iniciam/param o foreground service real que protege o processo do app (sem isso o
    // Android pode matar o processo — e o servidor TCP junto — a qualquer momento em
    // segundo plano). Este efeito, amarrado 1:1 a `serverInfo.status`, é hoje o único
    // ponto que já reflete precisamente o ciclo de vida real do servidor — reaproveitado
    // de propósito em vez de duplicar essa lógica em `ServerServiceImpl`.
    //
    // T-808 resolveu a ressalva que a T-807 deixou registrada: ver o comentário em
    // `handleAppStateChange` abaixo para a decisão tomada sobre quando sair de foreground
    // efetivamente para o servidor.

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
          // T-808 — leitura do Princípio VI (constitution.md): "O servidor DEVE rodar
          // apenas enquanto o app estiver em primeiro plano OU com notificação
          // persistente explícita". Antes da T-807 a notificação persistente do Android
          // era só cosmética (`expo-notifications` comum, sem proteção real de
          // processo), então a leitura mais segura do princípio era tratar "sair de
          // foreground" como "deixou de valer a condição de primeiro plano" e parar o
          // servidor imediatamente — daí o stop incondicional herdado da T-205.
          //
          // Com a T-807, no Android com o foreground service nativo disponível
          // (`isAvailable()` abaixo — só `true` quando `startForeground()` real está
          // ativo, ver `foregroundServiceModule.ts`), a notificação persistente passa a
          // ser exatamente a "notificação persistente explícita" que o princípio aceita
          // como alternativa ao primeiro plano — o processo está genuinamente protegido
          // contra ser morto pelo Android. Não faz mais sentido derrubar o servidor só
          // por sair de foreground nesse caso (era isso, por exemplo, que desconectava
          // o servidor ao abrir o picker de pasta do sistema). O servidor só para
          // quando o app é de fato fechado/morto — nesse caso o próprio SO libera a
          // porta ao encerrar o processo, sem precisar de um `stop()` explícito daqui.
          //
          // iOS não tem equivalente a foreground service (historicamente mais
          // restritivo a processos em segundo plano — sem API pública para manter um
          // processo arbitrário vivo e servindo TCP indefinidamente em background) e a
          // implementação padrão de `ForegroundServiceModule` já reflete isso: fora do
          // Android ela é sempre o fallback no-op, com `isAvailable()` retornando
          // `false`. Então iOS continua caindo no caminho de stop abaixo, preservando o
          // comportamento da T-205 nessa plataforma — decisão deliberada, não omissão.
          // Web segue o mesmo caminho, pelo mesmo motivo (sem foreground service e sem
          // um conceito de "app em segundo plano" que faça sentido preservar).
          //
          // Android sem o foreground service nativo disponível (`isAvailable()`
          // `false`, ex.: Expo Go ou build sem `expo prebuild` atualizado) também cai
          // no stop — a proteção real desta tarefa só vale quando ela de fato existe.
          const foregroundService =
            foregroundServiceModule ?? createDefaultForegroundServiceModule();
          const serverIsProtectedInBackground = foregroundService.isAvailable();

          if (!serverIsProtectedInBackground) {
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
      }

      appStateRef.current = nextAppState;
    },
    [httpModule, notificationService, foregroundServiceModule],
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
