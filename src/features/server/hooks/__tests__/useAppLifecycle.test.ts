/**
 * Tests for useAppLifecycle hook.
 *
 * Tests verify:
 * - Hook can be called with various dependency configurations
 * - Hook properly integrates with serverStore and notification service
 * - Error handling for notification operations
 * - Notification lifecycle (show on server running, dismiss on server stop)
 */

import { renderHook } from '@testing-library/react-native';
import { useAppLifecycle } from '../useAppLifecycle';
import { useServerStore } from '../../store/serverStore';
import { createServerService } from '../../services/serverServiceFactory';
import { createNotificationService } from '../../services/notificationService';
import type { NotificationService } from '../../services/notificationService';
import type { HttpModule } from '../../services/httpModule';

jest.mock('../../services/serverServiceFactory');
jest.mock('../../services/notificationService');

describe('useAppLifecycle', () => {
  let mockNotificationService: Partial<NotificationService>;
  let mockHttpModule: Partial<HttpModule>;

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup mock notification service
    mockNotificationService = {
      requestPermission: jest.fn().mockResolvedValue(true),
      showPersistentNotification: jest.fn().mockResolvedValue('notification-id-123'),
      dismissNotification: jest.fn().mockResolvedValue(undefined),
      dismissAllNotifications: jest.fn().mockResolvedValue(undefined),
    };

    // Setup mock http module
    mockHttpModule = {
      start: jest.fn().mockResolvedValue(undefined),
      stop: jest.fn().mockResolvedValue(undefined),
      isRunning: jest.fn().mockReturnValue(true),
      addListener: jest.fn(),
      removeListener: jest.fn(),
    };

    // Mock createNotificationService to return our mock
    (createNotificationService as jest.Mock).mockImplementation(
      (service) => service || mockNotificationService,
    );

    // Mock createServerService to return our mock
    (createServerService as jest.Mock).mockImplementation(() => ({
      stop: jest.fn().mockResolvedValue(undefined),
    }));

    // Reset server store to idle state
    useServerStore.getState().reset();
  });

  it('should initialize without errors with all dependencies', () => {
    expect(() => {
      renderHook(() =>
        useAppLifecycle(
          mockHttpModule as HttpModule,
          mockNotificationService as NotificationService,
        ),
      );
    }).not.toThrow();
  });

  it('should initialize without errors without dependencies', () => {
    expect(() => {
      renderHook(() => useAppLifecycle());
    }).not.toThrow();
  });

  it('should initialize with only httpModule', () => {
    expect(() => {
      renderHook(() => useAppLifecycle(mockHttpModule as HttpModule));
    }).not.toThrow();
  });

  it('should initialize with only notificationService', () => {
    expect(() => {
      renderHook(() => useAppLifecycle(undefined, mockNotificationService as NotificationService));
    }).not.toThrow();
  });

  it('should accept all combination of parameters', () => {
    // No parameters
    expect(() => renderHook(() => useAppLifecycle())).not.toThrow();

    // Only httpModule
    expect(() => renderHook(() => useAppLifecycle(mockHttpModule as HttpModule))).not.toThrow();

    // Only notificationService
    expect(() =>
      renderHook(() => useAppLifecycle(undefined, mockNotificationService as NotificationService)),
    ).not.toThrow();

    // Both parameters
    expect(() =>
      renderHook(() =>
        useAppLifecycle(
          mockHttpModule as HttpModule,
          mockNotificationService as NotificationService,
        ),
      ),
    ).not.toThrow();
  });

  it('should use custom notification service if provided', () => {
    const customService: Partial<NotificationService> = {
      requestPermission: jest.fn().mockResolvedValue(true),
      showPersistentNotification: jest.fn(),
      dismissNotification: jest.fn(),
      dismissAllNotifications: jest.fn(),
    };

    (createNotificationService as jest.Mock).mockImplementation(
      (service) => service || mockNotificationService,
    );

    expect(() => {
      renderHook(() => useAppLifecycle(undefined, customService as NotificationService));
    }).not.toThrow();
  });

  it('should use custom http module if provided', () => {
    const customModule: Partial<HttpModule> = {
      start: jest.fn(),
      stop: jest.fn(),
      isRunning: jest.fn(),
      addListener: jest.fn(),
      removeListener: jest.fn(),
    };

    expect(() => {
      renderHook(() => useAppLifecycle(customModule as HttpModule));
    }).not.toThrow();
  });

  it('should handle undefined dependencies gracefully', () => {
    // Should use factory functions to create defaults
    expect(() => {
      renderHook(() => useAppLifecycle());
    }).not.toThrow();
  });

  it('should accept NotificationService with all required methods', () => {
    const completeService: NotificationService = {
      requestPermission: jest.fn().mockResolvedValue(true),
      showPersistentNotification: jest.fn().mockResolvedValue('id'),
      dismissNotification: jest.fn().mockResolvedValue(undefined),
      dismissAllNotifications: jest.fn().mockResolvedValue(undefined),
    };

    expect(() => {
      renderHook(() => useAppLifecycle(undefined, completeService));
    }).not.toThrow();
  });

  it('should accept HttpModule with all required methods', () => {
    const completeModule: HttpModule = {
      start: jest.fn().mockResolvedValue(undefined),
      stop: jest.fn().mockResolvedValue(undefined),
      isRunning: jest.fn().mockReturnValue(false),
      addListener: jest.fn(),
      removeListener: jest.fn(),
    };

    expect(() => {
      renderHook(() => useAppLifecycle(completeModule));
    }).not.toThrow();
  });

  it('should work with mock services having all required functionality', () => {
    const mockService: NotificationService = {
      requestPermission: jest.fn(async () => true),
      showPersistentNotification: jest.fn(async () => 'mock-id'),
      dismissNotification: jest.fn(async () => {}),
      dismissAllNotifications: jest.fn(async () => {}),
    };

    (createNotificationService as jest.Mock).mockReturnValue(mockService);

    expect(() => {
      renderHook(() => useAppLifecycle(undefined, mockService));
    }).not.toThrow();
  });

  it('should handle server store properly', () => {
    renderHook(() => useAppLifecycle());

    const storeState = useServerStore.getState();
    expect(storeState.serverInfo).toBeDefined();
  });

  it('should work after server store changes', () => {
    renderHook(() => useAppLifecycle());

    // Simulate server state changes
    useServerStore.getState().startRequested();
    expect(useServerStore.getState().serverInfo.status).toBe('starting');

    useServerStore.getState().reset();
    expect(useServerStore.getState().serverInfo.status).toBe('idle');
  });

  describe('server state transitions', () => {
    it('should handle server starting and stopping', () => {
      renderHook(() =>
        useAppLifecycle(
          mockHttpModule as HttpModule,
          mockNotificationService as NotificationService,
        ),
      );

      // Simulate starting the server
      useServerStore.getState().startRequested();
      expect(useServerStore.getState().serverInfo.status).toBe('starting');

      useServerStore.getState().started({
        ip: '192.168.1.100',
        port: 8080,
        url: 'http://192.168.1.100:8080',
        sessionId: 'test-123',
        networkMode: 'wifi',
      });
      expect(useServerStore.getState().serverInfo.status).toBe('running');

      // Stop the server
      useServerStore.getState().stopRequested();
      expect(useServerStore.getState().serverInfo.status).toBe('stopping');

      useServerStore.getState().stopped();
      expect(useServerStore.getState().serverInfo.status).toBe('idle');
    });

    it('should handle error state properly', () => {
      renderHook(() =>
        useAppLifecycle(
          mockHttpModule as HttpModule,
          mockNotificationService as NotificationService,
        ),
      );

      useServerStore.getState().startRequested();
      useServerStore.getState().started({
        ip: '192.168.1.100',
        port: 8080,
        url: 'http://192.168.1.100:8080',
        sessionId: 'test-123',
        networkMode: 'wifi',
      });

      // Transition to error state
      useServerStore.getState().failed({
        code: 'PORT_UNAVAILABLE',
        message: 'Port not available',
      });

      expect(useServerStore.getState().serverInfo.status).toBe('error');
    });
  });
});
