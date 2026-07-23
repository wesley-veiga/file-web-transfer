/**
 * Tests for services/index.ts exports
 * Ensures all services are properly exported and available for import
 */

import {
  NotificationServiceImpl,
  createNotificationService,
  createServerService,
  setHttpModule,
  ServerServiceImpl,
  HotspotServiceImpl,
  HotspotServiceError,
  createHotspotService,
  NativeHotspot,
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

  it('should export setHttpModule', () => {
    expect(setHttpModule).toBeDefined();
    expect(typeof setHttpModule).toBe('function');
  });

  it('should export ServerServiceImpl', () => {
    expect(ServerServiceImpl).toBeDefined();
    expect(typeof ServerServiceImpl).toBe('function');
  });

  it('should export HotspotServiceImpl', () => {
    expect(HotspotServiceImpl).toBeDefined();
    expect(typeof HotspotServiceImpl).toBe('function');
  });

  it('should export HotspotServiceError', () => {
    expect(HotspotServiceError).toBeDefined();
    expect(typeof HotspotServiceError).toBe('function');
  });

  it('should export createHotspotService', () => {
    expect(createHotspotService).toBeDefined();
    expect(typeof createHotspotService).toBe('function');
  });

  it('should export NativeHotspot', () => {
    expect(NativeHotspot).toBeDefined();
    expect(typeof NativeHotspot).toBe('object');
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

  it('should create HotspotService instance', () => {
    const service = createHotspotService();
    expect(service).toBeDefined();
    expect(service).toHaveProperty('createHotspot');
    expect(service).toHaveProperty('stopHotspot');
    expect(service).toHaveProperty('isHotspotActive');
  });

  it('createHotspotService should accept custom native module', () => {
    const mockNativeModule = {
      startLocalOnlyHotspot: jest.fn(),
      stopLocalOnlyHotspot: jest.fn(),
      getHotspotConfig: jest.fn(),
    };

    const service = createHotspotService(mockNativeModule);
    expect(service).toBeDefined();
    expect(service).toHaveProperty('createHotspot');
  });

  it('HotspotServiceError should be instantiable', () => {
    const error = new HotspotServiceError('HOTSPOT_FAILED', 'Test error');
    expect(error).toBeInstanceOf(HotspotServiceError);
    expect(error.code).toBe('HOTSPOT_FAILED');
    expect(error.message).toBe('Test error');
    expect(error.name).toBe('HotspotServiceError');
  });

  it('HotspotServiceImpl should be instantiable', () => {
    const mockNativeModule = {
      startLocalOnlyHotspot: jest.fn(),
      stopLocalOnlyHotspot: jest.fn(),
      getHotspotConfig: jest.fn(),
    };

    const service = new HotspotServiceImpl(mockNativeModule);
    expect(service).toBeDefined();
    expect(service).toHaveProperty('createHotspot');
    expect(service).toHaveProperty('stopHotspot');
    expect(service).toHaveProperty('isHotspotActive');
  });
});
