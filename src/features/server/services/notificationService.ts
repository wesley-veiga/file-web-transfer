import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';

/**
 * Configuração de notificação persistente (foreground).
 * Necessário para que notificações apareçam quando o app está em primeiro plano.
 */
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

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
    const notificationId = await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Servidor ativo',
        body: 'Compartilhando arquivos na rede local',
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
