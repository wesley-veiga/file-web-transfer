/**
 * Tests for services/index.ts exports
 * Ensures all services are properly exported and available for import
 */

import {
  NotificationServiceImpl,
  createNotificationService,
  createServerService,
  ServerServiceImpl,
} from '../index';

describe('services/index.ts exports', () => {
  it('should export NotificationServiceImpl', () => {
    expect(NotificationServiceImpl).toBeDefined();
    expect(typeof NotificationServiceImpl).toBe('function');
  });

  it('should export createNotificationService', () => {
    expect(createNotificationService).toBeDefined();
    expect(typeof createNotificationService).toBe('function');
  });

  it('should export createServerService', () => {
    expect(createServerService).toBeDefined();
    expect(typeof createServerService).toBe('function');
  });

  it('should export ServerServiceImpl', () => {
    expect(ServerServiceImpl).toBeDefined();
    expect(typeof ServerServiceImpl).toBe('function');
  });

  it('should create NotificationService instance', () => {
    const service = createNotificationService();
    expect(service).toBeDefined();
    expect(service).toBeInstanceOf(NotificationServiceImpl);
  });

  it('createNotificationService should accept custom implementation', () => {
    const mockService = {
      requestPermission: jest.fn(),
      showPersistentNotification: jest.fn(),
      dismissNotification: jest.fn(),
      dismissAllNotifications: jest.fn(),
    };

    const service = createNotificationService(mockService);
    expect(service).toBe(mockService);
  });
});
