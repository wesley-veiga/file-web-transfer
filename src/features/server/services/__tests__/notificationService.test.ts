import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { NotificationServiceImpl, createNotificationService } from '../notificationService';
import type { ForegroundServiceModule } from '../foregroundServiceModule';

jest.mock('expo-notifications');
jest.mock('expo-device');

// Captured at module-import time, before any `beforeEach` clears the mock's call history.
const notificationHandlerConfig = (Notifications.setNotificationHandler as jest.Mock).mock
  .calls[0][0];

describe('NotificationService', () => {
  describe('setNotificationHandler (module scope)', () => {
    it('configures the foreground handler to always show the alert', async () => {
      await expect(notificationHandlerConfig.handleNotification()).resolves.toEqual({
        shouldPlaySound: false,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
      });
    });
  });

  beforeEach(() => {
    jest.clearAllMocks();
    // Reset Platform.OS to default
    const platformWithOS = Platform as { OS: string };
    platformWithOS.OS = 'android';
  });

  describe('NotificationServiceImpl', () => {
    let service: NotificationServiceImpl;
    let mockForegroundServiceModule: jest.Mocked<ForegroundServiceModule>;

    beforeEach(() => {
      mockForegroundServiceModule = {
        start: jest.fn(),
        stop: jest.fn(),
      };
      service = new NotificationServiceImpl(mockForegroundServiceModule);
    });

    describe('requestPermission', () => {
      afterEach(() => {
        (Device as { isDevice: boolean }).isDevice = true;
      });

      it('should return true when not on a device (web/desktop)', async () => {
        (Device as { isDevice: boolean }).isDevice = false;

        const result = await service.requestPermission();

        expect(result).toBe(true);
        expect(Notifications.requestPermissionsAsync).not.toHaveBeenCalled();
      });

      it('should return true on Android (no runtime permission needed)', async () => {
        (Device as { isDevice: boolean }).isDevice = true;
        const platformWithOS = Platform as { OS: string };
        platformWithOS.OS = 'android';

        const result = await service.requestPermission();

        expect(result).toBe(true);
        // On Android, requestPermissionsAsync should not be called
        expect(Notifications.requestPermissionsAsync).not.toHaveBeenCalled();
      });

      it('should request iOS permission when permissions granted', async () => {
        (Device as { isDevice: boolean }).isDevice = true;
        const platformWithOS = Platform as { OS: string };
        platformWithOS.OS = 'ios';
        (Notifications.requestPermissionsAsync as jest.Mock).mockResolvedValue({
          status: 'granted',
        });

        const result = await service.requestPermission();

        expect(result).toBe(true);
        expect(Notifications.requestPermissionsAsync).toHaveBeenCalledWith({
          ios: {
            allowAlert: true,
            allowBadge: true,
            allowSound: false,
          },
        });
      });

      it('should return false on iOS when permissions denied', async () => {
        (Device as { isDevice: boolean }).isDevice = true;
        const platformWithOS = Platform as { OS: string };
        platformWithOS.OS = 'ios';
        (Notifications.requestPermissionsAsync as jest.Mock).mockResolvedValue({
          status: 'denied',
        });

        const result = await service.requestPermission();

        expect(result).toBe(false);
        expect(Notifications.requestPermissionsAsync).toHaveBeenCalled();
      });

      it('should handle iOS permission request errors', async () => {
        (Device as { isDevice: boolean }).isDevice = true;
        const platformWithOS = Platform as { OS: string };
        platformWithOS.OS = 'ios';
        const error = new Error('Permission request failed');
        (Notifications.requestPermissionsAsync as jest.Mock).mockRejectedValue(error);

        await expect(service.requestPermission()).rejects.toThrow('Permission request failed');
      });
    });

    describe('showPersistentNotification', () => {
      // Android (T-807): a notificação persistente vira a notificação do foreground
      // service nativo — nunca uma segunda notificação "comum" via expo-notifications
      // (ver comentário em NotificationServiceImpl#showPersistentNotification).
      it('should start the Android foreground service with the persistent content, on Android', async () => {
        const result = await service.showPersistentNotification();

        expect(mockForegroundServiceModule.start).toHaveBeenCalledWith(
          'Servidor ativo',
          'Compartilhando arquivos na rede local',
        );
        expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
        expect(typeof result).toBe('string');
      });

      it('should schedule a real expo-notifications notification on iOS', async () => {
        const platformWithOS = Platform as { OS: string };
        platformWithOS.OS = 'ios';
        const notificationId = 'mock-notification-id';
        (Notifications.scheduleNotificationAsync as jest.Mock).mockResolvedValue(notificationId);

        const result = await service.showPersistentNotification();

        expect(result).toBe(notificationId);
        expect(mockForegroundServiceModule.start).not.toHaveBeenCalled();
        expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith({
          content: {
            title: 'Servidor ativo',
            body: 'Compartilhando arquivos na rede local',
            badge: 1,
            data: {
              persistent: 'true',
            },
          },
          trigger: null,
        });
      });

      it('should handle scheduling errors on iOS', async () => {
        const platformWithOS = Platform as { OS: string };
        platformWithOS.OS = 'ios';
        const error = new Error('Schedule failed');
        (Notifications.scheduleNotificationAsync as jest.Mock).mockRejectedValue(error);

        await expect(service.showPersistentNotification()).rejects.toThrow('Schedule failed');
      });
    });

    describe('dismissNotification', () => {
      it('should stop the Android foreground service, on Android', async () => {
        await service.dismissNotification('any-id');

        expect(mockForegroundServiceModule.stop).toHaveBeenCalled();
        expect(Notifications.dismissNotificationAsync).not.toHaveBeenCalled();
      });

      it('should dismiss the real expo-notifications notification with correct ID, on iOS', async () => {
        const platformWithOS = Platform as { OS: string };
        platformWithOS.OS = 'ios';
        const notificationId = 'test-notification-id';

        await service.dismissNotification(notificationId);

        expect(Notifications.dismissNotificationAsync).toHaveBeenCalledWith(notificationId);
        expect(mockForegroundServiceModule.stop).not.toHaveBeenCalled();
      });

      it('should handle dismiss errors gracefully on iOS', async () => {
        const platformWithOS = Platform as { OS: string };
        platformWithOS.OS = 'ios';
        const notificationId = 'test-id';
        const error = new Error('Dismiss failed');
        (Notifications.dismissNotificationAsync as jest.Mock).mockRejectedValueOnce(error);

        await expect(service.dismissNotification(notificationId)).rejects.toThrow('Dismiss failed');
      });
    });

    describe('dismissAllNotifications', () => {
      it('should call dismissAllNotificationsAsync', async () => {
        await service.dismissAllNotifications();

        expect(Notifications.dismissAllNotificationsAsync).toHaveBeenCalled();
      });

      it('should handle dismissAllNotifications errors', async () => {
        const error = new Error('Dismiss all failed');
        (Notifications.dismissAllNotificationsAsync as jest.Mock).mockRejectedValue(error);

        await expect(service.dismissAllNotifications()).rejects.toThrow('Dismiss all failed');
      });
    });
  });

  describe('createNotificationService', () => {
    it('should return provided service instance', () => {
      const mockService = {
        requestPermission: jest.fn(),
        showPersistentNotification: jest.fn(),
        dismissNotification: jest.fn(),
        dismissAllNotifications: jest.fn(),
      };

      const service = createNotificationService(mockService);

      expect(service).toBe(mockService);
    });

    it('should create and cache singleton instance', async () => {
      // Reset singleton state by testing the factory pattern
      const service1 = createNotificationService();
      const service2 = createNotificationService();

      // Both should be the same instance
      expect(service1).toBe(service2);
      expect(service1).toBeInstanceOf(NotificationServiceImpl);
    });

    it('should always use provided service over singleton', () => {
      const mockService = {
        requestPermission: jest.fn(),
        showPersistentNotification: jest.fn(),
        dismissNotification: jest.fn(),
        dismissAllNotifications: jest.fn(),
      };

      const service = createNotificationService(mockService);

      expect(service).toBe(mockService);
      expect(service).not.toBeInstanceOf(NotificationServiceImpl);
    });

    it('should return NotificationServiceImpl when no service provided and not cached', () => {
      const service = createNotificationService();
      expect(service).toBeInstanceOf(NotificationServiceImpl);
    });
  });
});
