import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import {
  createDefaultForegroundServiceModule,
  type ForegroundServiceModule,
} from './foregroundServiceModule';

/**
 * Configuração de notificação persistente (foreground).
 * Necessário para que notificações apareçam quando o app está em primeiro plano.
 *
 * `shouldShowAlert` foi removido de propósito (T-807): é um campo depreciado do
 * SDK, substituído por `shouldShowBanner`/`shouldShowList` abaixo — mantê-lo
 * gerava warning sem nenhum efeito adicional.
 */
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: false,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

/**
 * Título/corpo da notificação persistente enquanto o servidor está ativo — usados tanto
 * pelo caminho `expo-notifications` (iOS) quanto pelo foreground service nativo (Android,
 * ver `TransferForegroundService.kt` gerado por `plugins/withForegroundService.js`).
 */
const PERSISTENT_NOTIFICATION_TITLE = 'Servidor ativo';
const PERSISTENT_NOTIFICATION_BODY = 'Compartilhando arquivos na rede local';

/**
 * ID sentinela retornado por `showPersistentNotification()` no Android — nesse caminho a
 * notificação é gerenciada inteiramente pelo foreground service nativo (um único
 * `startForeground()`/notificação ongoing, sem ID por chamada como o `expo-notifications`
 * usa), então não há um ID real do sistema de notificações para devolver.
 */
const ANDROID_FOREGROUND_SERVICE_NOTIFICATION_ID = 'android-foreground-service';

/**
 * Interface para o serviço de notificação persistente.
 */
export interface NotificationService {
  /**
   * Solicita permissão ao usuário para enviar notificações.
   * @returns true se permissão foi concedida ou se notificações não são necessárias (web/desktop)
   */
  requestPermission: () => Promise<boolean>;

  /**
   * Exibe uma notificação persistente enquanto o servidor está rodando.
   * A notificação fica visível até ser explicitamente descartada.
   *
   * @returns ID da notificação (necessário para dismiss)
   */
  showPersistentNotification: () => Promise<string>;

  /**
   * Descarta a notificação persistente.
   * @param notificationId ID retornado por showPersistentNotification
   */
  dismissNotification: (notificationId: string) => Promise<void>;

  /**
   * Descarta todas as notificações.
   */
  dismissAllNotifications: () => Promise<void>;
}

/**
 * Implementação concreta do serviço de notificação.
 */
export class NotificationServiceImpl implements NotificationService {
  private readonly foregroundServiceModule: ForegroundServiceModule;

  constructor(
    foregroundServiceModule: ForegroundServiceModule = createDefaultForegroundServiceModule(),
  ) {
    this.foregroundServiceModule = foregroundServiceModule;
  }

  async requestPermission(): Promise<boolean> {
    // Web/desktop não precisa de permissão
    if (!Device.isDevice) {
      return true;
    }

    // Android não precisa solicitar permissão em tempo de execução (já está no manifest)
    // iOS precisa solicitar
    if (Platform.OS === 'ios') {
      const { status } = await Notifications.requestPermissionsAsync({
        ios: {
          allowAlert: true,
          allowBadge: true,
          allowSound: false,
        },
      });
      return status === 'granted';
    }

    return true;
  }

  async showPersistentNotification(): Promise<string> {
    // Android: a notificação "persistente" precisa ser a mesma que protege o processo
    // via foreground service real (startForeground()) — nunca uma segunda notificação
    // "comum" via expo-notifications, que duplicaria o que o usuário vê e NÃO protegeria
    // o processo (achado de T-807: sem foreground service de verdade, o Android pode
    // matar o app em segundo plano mesmo com uma notificação normal visível).
    if (Platform.OS === 'android') {
      this.foregroundServiceModule.start(
        PERSISTENT_NOTIFICATION_TITLE,
        PERSISTENT_NOTIFICATION_BODY,
      );
      return ANDROID_FOREGROUND_SERVICE_NOTIFICATION_ID;
    }

    const notificationId = await Notifications.scheduleNotificationAsync({
      content: {
        title: PERSISTENT_NOTIFICATION_TITLE,
        body: PERSISTENT_NOTIFICATION_BODY,
        badge: 1,
        // Prioridade alta no Android para que a notificação seja persistente
        data: {
          persistent: 'true',
        },
      },
      trigger: null, // Mostrar imediatamente
    });

    return notificationId;
  }

  async dismissNotification(notificationId: string): Promise<void> {
    if (Platform.OS === 'android') {
      this.foregroundServiceModule.stop();
      return;
    }

    await Notifications.dismissNotificationAsync(notificationId);
  }

  async dismissAllNotifications(): Promise<void> {
    await Notifications.dismissAllNotificationsAsync();
  }
}

/**
 * Instância singleton do serviço.
 */
let notificationServiceInstance: NotificationService | null = null;

/**
 * Factory para obter a instância do serviço (permite injeção em testes).
 */
export function createNotificationService(service?: NotificationService): NotificationService {
  if (service) {
    return service;
  }
  if (!notificationServiceInstance) {
    notificationServiceInstance = new NotificationServiceImpl();
  }
  return notificationServiceInstance;
}
