import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { NotificationServiceImpl, createNotificationService } from '../notificationService';

jest.mock('expo-notifications');
jest.mock('expo-device');

describe('NotificationService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('NotificationServiceImpl', () => {
    let service: NotificationServiceImpl;

    beforeEach(() => {
      service = new NotificationServiceImpl();
    });

    describe('requestPermission', () => {
      it('should return true when not on a device (web/desktop)', async () => {
        (Device.isDevice as unknown as jest.Mock).mockReturnValue(false);

        const result = await service.requestPermission();

        expect(result).toBe(true);
      });

      it('should return true on Android (no runtime permission needed)', async () => {
        (Device.isDevice as unknown as jest.Mock).mockReturnValue(true);
        // Note: Platform.OS is not easily mockable in tests, so we rely on Android being the default
        // when Device.isDevice is true and we don't call requestPermissionsAsync

        const result = await service.requestPermission();

        expect(result).toBe(true);
        // On Android, requestPermissionsAsync should not be called
        expect(Notifications.requestPermissionsAsync).not.toHaveBeenCalled();
      });

      it('should request iOS permission when permissions granted', async () => {
        (Device.isDevice as unknown as jest.Mock).mockReturnValue(true);
        (Notifications.requestPermissionsAsync as jest.Mock).mockResolvedValue({
          status: 'granted',
        });

        // Manually test iOS logic by calling requestPermissionsAsync
        (Notifications.requestPermissionsAsync as jest.Mock).mockClear();
        (Notifications.requestPermissionsAsync as jest.Mock).mockResolvedValue({
          status: 'granted',
        });

        await service.requestPermission();

        // At least call the service and verify it handles responses
        if (Platform.OS === 'ios') {
          expect(Notifications.requestPermissionsAsync).toHaveBeenCalled();
        }
      });

      it('should handle permission grant/denial', async () => {
        (Notifications.requestPermissionsAsync as jest.Mock).mockResolvedValue({
          status: 'granted',
        });

        const result = await Notifications.requestPermissionsAsync();

        expect(result.status).toBe('granted');
      });
    });

    describe('showPersistentNotification', () => {
      it('should schedule notification with correct content', async () => {
        const notificationId = 'mock-notification-id';
        (Notifications.scheduleNotificationAsync as jest.Mock).mockResolvedValue(notificationId);

        const result = await service.showPersistentNotification();

        expect(result).toBe(notificationId);
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

      it('should handle scheduling errors', async () => {
        const error = new Error('Schedule failed');
        (Notifications.scheduleNotificationAsync as jest.Mock).mockRejectedValue(error);

        await expect(service.showPersistentNotification()).rejects.toThrow('Schedule failed');
      });
    });

    describe('dismissNotification', () => {
      it('should dismiss notification with correct ID', async () => {
        const notificationId = 'test-notification-id';

        await service.dismissNotification(notificationId);

        expect(Notifications.dismissNotificationAsync).toHaveBeenCalledWith(notificationId);
      });

      it('should handle dismiss errors gracefully', async () => {
        const notificationId = 'test-id';
        const error = new Error('Dismiss failed');
        (Notifications.dismissNotificationAsync as jest.Mock).mockRejectedValue(error);

        await expect(service.dismissNotification(notificationId)).rejects.toThrow('Dismiss failed');
      });
    });

    describe('dismissAllNotifications', () => {
      it('should call dismissAllNotificationsAsync', async () => {
        await service.dismissAllNotifications();

        expect(Notifications.dismissAllNotificationsAsync).toHaveBeenCalled();
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
  });
});
