/**
 * Tests for useAppLifecycle hook.
 *
 * Tests verify:
 * - Persistent notification shown when server transitions to `running`
 * - Notification dismissed when server leaves `running`
 * - AppState transition to background stops the running server and dismisses the notification
 * - AppState transition to background is a no-op when the server is not running
 * - Errors from notification/server-stop calls are swallowed (logged, not thrown)
 */

import { AppState } from 'react-native';
import { renderHook, act, waitFor } from '@testing-library/react-native';
import { useAppLifecycle } from '../useAppLifecycle';
import { useServerStore } from '../../store/serverStore';
import { createServerService } from '../../services/serverServiceFactory';
import { createNotificationService } from '../../services/notificationService';
import type { NotificationService } from '../../services/notificationService';
import type { HttpModule } from '../../services/httpModule';

jest.mock('../../services/serverServiceFactory');
jest.mock('../../services/notificationService');

function getAppStateChangeHandler(): (status: string) => void {
  const calls = (AppState.addEventListener as jest.Mock).mock.calls;
  const changeCall = calls.find(([event]) => event === 'change');
  if (!changeCall) {
    throw new Error('AppState "change" listener was not registered');
  }
  return changeCall[1];
}

describe('useAppLifecycle', () => {
  let mockNotificationService: jest.Mocked<NotificationService>;
  let mockServerServiceInstance: { stop: jest.Mock };

  beforeEach(() => {
    jest.clearAllMocks();
    useServerStore.getState().reset();

    mockNotificationService = {
      requestPermission: jest.fn().mockResolvedValue(true),
      showPersistentNotification: jest.fn().mockResolvedValue('notification-id-123'),
      dismissNotification: jest.fn().mockResolvedValue(undefined),
      dismissAllNotifications: jest.fn().mockResolvedValue(undefined),
    };

    mockServerServiceInstance = {
      stop: jest.fn().mockResolvedValue(undefined),
    };

    (createNotificationService as jest.Mock).mockReturnValue(mockNotificationService);
    (createServerService as jest.Mock).mockReturnValue(mockServerServiceInstance);
  });

  const startServer = async () => {
    await act(async () => {
      useServerStore.getState().startRequested();
      useServerStore.getState().started({
        ip: '192.168.1.100',
        port: 8080,
        url: 'http://192.168.1.100:8080',
        sessionId: 'test-123',
        networkMode: 'wifi',
      });
    });
  };

  it('shows a persistent notification when the server starts running', async () => {
    await renderHook(() => useAppLifecycle(undefined, mockNotificationService));

    await startServer();

    await waitFor(() => {
      expect(mockNotificationService.requestPermission).toHaveBeenCalled();
      expect(mockNotificationService.showPersistentNotification).toHaveBeenCalled();
    });
  });

  it('does not request a second notification while already running', async () => {
    await renderHook(() => useAppLifecycle(undefined, mockNotificationService));

    await startServer();

    await waitFor(() => {
      expect(mockNotificationService.showPersistentNotification).toHaveBeenCalledTimes(1);
    });

    // A no-op re-render with the same running status should not show a second notification
    await act(async () => {
      useServerStore.getState().started({ sessionId: 'test-123' });
    });

    expect(mockNotificationService.showPersistentNotification).toHaveBeenCalledTimes(1);
  });

  it('dismisses the notification when the server stops', async () => {
    await renderHook(() => useAppLifecycle(undefined, mockNotificationService));

    await startServer();

    await waitFor(() => {
      expect(mockNotificationService.showPersistentNotification).toHaveBeenCalled();
    });

    await act(async () => {
      useServerStore.getState().stopRequested();
      useServerStore.getState().stopped();
    });

    await waitFor(() => {
      expect(mockNotificationService.dismissNotification).toHaveBeenCalledWith(
        'notification-id-123',
      );
    });
  });

  it('logs and swallows errors when showing the notification fails', async () => {
    const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    mockNotificationService.requestPermission.mockRejectedValueOnce(new Error('denied'));

    await renderHook(() => useAppLifecycle(undefined, mockNotificationService));

    await startServer();

    await waitFor(() => {
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        '[useAppLifecycle] Erro ao mostrar notificação:',
        expect.any(Error),
      );
    });

    consoleWarnSpy.mockRestore();
  });

  it('logs and swallows errors when dismissing the notification fails', async () => {
    const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    mockNotificationService.dismissNotification.mockRejectedValueOnce(new Error('failed'));

    await renderHook(() => useAppLifecycle(undefined, mockNotificationService));

    await startServer();

    await waitFor(() => {
      expect(mockNotificationService.showPersistentNotification).toHaveBeenCalled();
    });

    await act(async () => {
      useServerStore.getState().stopRequested();
      useServerStore.getState().stopped();
    });

    await waitFor(() => {
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        '[useAppLifecycle] Erro ao descartar notificação:',
        expect.any(Error),
      );
    });

    consoleWarnSpy.mockRestore();
  });

  it('stops the running server and dismisses the notification when the app goes to background', async () => {
    await renderHook(() => useAppLifecycle(undefined, mockNotificationService));

    await startServer();
    await waitFor(() => {
      expect(mockNotificationService.showPersistentNotification).toHaveBeenCalled();
    });

    const handleAppStateChange = getAppStateChangeHandler();

    await act(async () => {
      await handleAppStateChange('background');
    });

    expect(createServerService).toHaveBeenCalled();
    expect(mockServerServiceInstance.stop).toHaveBeenCalled();
    expect(useServerStore.getState().serverInfo.status).toBe('idle');
    expect(mockNotificationService.dismissNotification).toHaveBeenCalledWith('notification-id-123');
  });

  it('does nothing when the app goes to background and the server is not running', async () => {
    await renderHook(() => useAppLifecycle(undefined, mockNotificationService));

    const handleAppStateChange = getAppStateChangeHandler();

    await act(async () => {
      await handleAppStateChange('background');
    });

    expect(mockServerServiceInstance.stop).not.toHaveBeenCalled();
  });

  it('does not stop the server again on repeated background transitions', async () => {
    await renderHook(() => useAppLifecycle(undefined, mockNotificationService));

    await startServer();
    await waitFor(() => {
      expect(mockNotificationService.showPersistentNotification).toHaveBeenCalled();
    });

    const handleAppStateChange = getAppStateChangeHandler();

    await act(async () => {
      await handleAppStateChange('inactive');
      await handleAppStateChange('background');
    });

    expect(mockServerServiceInstance.stop).toHaveBeenCalledTimes(1);
  });

  it('logs an error when stopping the server on backgrounding fails', async () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    mockServerServiceInstance.stop.mockRejectedValueOnce(new Error('stop failed'));

    await renderHook(() => useAppLifecycle(undefined, mockNotificationService));

    await startServer();
    await waitFor(() => {
      expect(mockNotificationService.showPersistentNotification).toHaveBeenCalled();
    });

    const handleAppStateChange = getAppStateChangeHandler();

    await act(async () => {
      await handleAppStateChange('background');
    });

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      '[useAppLifecycle] Erro ao parar servidor na saída do app:',
      expect.any(Error),
    );

    consoleErrorSpy.mockRestore();
  });

  it('removes the AppState subscription on unmount', async () => {
    const removeSpy = jest.fn();
    (AppState.addEventListener as jest.Mock).mockReturnValueOnce({ remove: removeSpy });

    const { unmount } = await renderHook(() => useAppLifecycle(undefined, mockNotificationService));

    await unmount();

    expect(removeSpy).toHaveBeenCalled();
  });

  it('creates the server service with the injected http module', async () => {
    const customModule: Partial<HttpModule> = {
      start: jest.fn(),
      stop: jest.fn(),
      isRunning: jest.fn(),
      addListener: jest.fn(),
      removeListener: jest.fn(),
    };

    await renderHook(() => useAppLifecycle(customModule as HttpModule, mockNotificationService));

    await startServer();
    await waitFor(() => {
      expect(mockNotificationService.showPersistentNotification).toHaveBeenCalled();
    });

    const handleAppStateChange = getAppStateChangeHandler();

    await act(async () => {
      await handleAppStateChange('background');
    });

    expect(createServerService).toHaveBeenCalledWith(customModule);
  });

  it('falls back to the default notification service when none is injected', async () => {
    await renderHook(() => useAppLifecycle());

    await startServer();

    await waitFor(() => {
      expect(createNotificationService).toHaveBeenCalledWith(undefined);
    });
  });
});
