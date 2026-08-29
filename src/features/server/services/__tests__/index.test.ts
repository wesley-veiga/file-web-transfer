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
  ApiRouterImpl,
  createApiRouter,
  createDefaultHttpModule,
  ServerServiceError,
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

  it('should export ApiRouterImpl', () => {
    expect(ApiRouterImpl).toBeDefined();
    expect(typeof ApiRouterImpl).toBe('function');
  });

  it('should export createApiRouter', () => {
    expect(createApiRouter).toBeDefined();
    expect(typeof createApiRouter).toBe('function');
  });

  it('should create ApiRouter instance via createApiRouter', () => {
    const router = createApiRouter({
      getSessionId: () => 'test-123',
      appVersion: '1.0.0',
      maxUploadBytes: 4294967296,
    });
    expect(router).toBeInstanceOf(ApiRouterImpl);
  });

  it('should export ServerServiceError', () => {
    expect(ServerServiceError).toBeDefined();
    expect(typeof ServerServiceError).toBe('function');
    const error = new ServerServiceError('PORT_UNAVAILABLE', 'porta em uso');
    expect(error).toBeInstanceOf(Error);
    expect(error.code).toBe('PORT_UNAVAILABLE');
  });

  it('should export createDefaultHttpModule (T-405)', () => {
    expect(createDefaultHttpModule).toBeDefined();
    expect(typeof createDefaultHttpModule).toBe('function');
  });

  it('createDefaultHttpModule should return an object satisfying the HttpModule interface', () => {
    const httpModule = createDefaultHttpModule();

    expect(typeof httpModule.start).toBe('function');
    expect(typeof httpModule.stop).toBe('function');
    expect(typeof httpModule.addListener).toBe('function');
    expect(typeof httpModule.removeListener).toBe('function');
    expect(typeof httpModule.addUploadListener).toBe('function');
    expect(typeof httpModule.removeUploadListener).toBe('function');
    expect(typeof httpModule.isRunning).toBe('function');
    expect(httpModule.isRunning()).toBe(false);
  });
});
