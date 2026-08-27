import { useServerStore, isValidTransition } from '../serverStore';
import type { ServerError, ServerStatus } from '../../types';

describe('isValidTransition', () => {
  describe('valid transitions', () => {
    it('should allow idle → starting', () => {
      expect(isValidTransition('idle', 'starting')).toBe(true);
    });

    it('should allow starting → running', () => {
      expect(isValidTransition('starting', 'running')).toBe(true);
    });

    it('should allow running → stopping', () => {
      expect(isValidTransition('running', 'stopping')).toBe(true);
    });

    it('should allow stopping → idle', () => {
      expect(isValidTransition('stopping', 'idle')).toBe(true);
    });

    it('should allow idle → error', () => {
      expect(isValidTransition('idle', 'error')).toBe(true);
    });

    it('should allow starting → error', () => {
      expect(isValidTransition('starting', 'error')).toBe(true);
    });

    it('should allow running → error', () => {
      expect(isValidTransition('running', 'error')).toBe(true);
    });

    it('should allow stopping → error', () => {
      expect(isValidTransition('stopping', 'error')).toBe(true);
    });

    it('should allow error → idle', () => {
      expect(isValidTransition('error', 'idle')).toBe(true);
    });
  });

  describe('invalid transitions', () => {
    it('should not allow idle → running', () => {
      expect(isValidTransition('idle', 'running')).toBe(false);
    });

    it('should not allow idle → stopping', () => {
      expect(isValidTransition('idle', 'stopping')).toBe(false);
    });

    it('should not allow starting → idle', () => {
      expect(isValidTransition('starting', 'idle')).toBe(false);
    });

    it('should not allow running → idle', () => {
      expect(isValidTransition('running', 'idle')).toBe(false);
    });

    it('should not allow stopping → starting', () => {
      expect(isValidTransition('stopping', 'starting')).toBe(false);
    });

    it('should not allow error → starting', () => {
      expect(isValidTransition('error', 'starting')).toBe(false);
    });

    it('should not allow error → running', () => {
      expect(isValidTransition('error', 'running')).toBe(false);
    });

    it('should not allow idle → idle', () => {
      expect(isValidTransition('idle', 'idle')).toBe(false);
    });
  });
});

describe('useServerStore', () => {
  beforeEach(() => {
    // Reset the store before each test by directly setting initial state
    useServerStore.setState({
      serverInfo: {
        status: 'idle',
        networkMode: null,
        ip: null,
        port: null,
        url: null,
        sessionId: null,
        startedAt: null,
        error: null,
      },
    });
  });

  describe('initial state', () => {
    it('should have idle status', () => {
      const { serverInfo } = useServerStore.getState();
      expect(serverInfo.status).toBe('idle');
    });

    it('should have all optional fields as null', () => {
      const { serverInfo } = useServerStore.getState();
      expect(serverInfo.networkMode).toBeNull();
      expect(serverInfo.ip).toBeNull();
      expect(serverInfo.port).toBeNull();
      expect(serverInfo.url).toBeNull();
      expect(serverInfo.sessionId).toBeNull();
      expect(serverInfo.startedAt).toBeNull();
      expect(serverInfo.error).toBeNull();
    });
  });

  describe('valid state machine flow', () => {
    it('should complete full cycle: idle → starting → running → stopping → idle', () => {
      const { startRequested, started, stopRequested, stopped } = useServerStore.getState();

      // idle → starting
      startRequested();
      expect(useServerStore.getState().serverInfo.status).toBe('starting');

      // starting → running
      started({
        ip: '192.168.1.100',
        port: 8080,
        url: 'http://192.168.1.100:8080',
        sessionId: 'apple-42',
        networkMode: 'wifi',
        startedAt: Date.now(),
      });
      expect(useServerStore.getState().serverInfo.status).toBe('running');
      expect(useServerStore.getState().serverInfo.ip).toBe('192.168.1.100');
      expect(useServerStore.getState().serverInfo.port).toBe(8080);
      expect(useServerStore.getState().serverInfo.url).toBe('http://192.168.1.100:8080');
      expect(useServerStore.getState().serverInfo.sessionId).toBe('apple-42');
      expect(useServerStore.getState().serverInfo.networkMode).toBe('wifi');

      // running → stopping
      stopRequested();
      expect(useServerStore.getState().serverInfo.status).toBe('stopping');

      // stopping → idle (resets fields)
      stopped();
      expect(useServerStore.getState().serverInfo.status).toBe('idle');
      expect(useServerStore.getState().serverInfo.ip).toBeNull();
      expect(useServerStore.getState().serverInfo.port).toBeNull();
      expect(useServerStore.getState().serverInfo.url).toBeNull();
      expect(useServerStore.getState().serverInfo.sessionId).toBeNull();
      expect(useServerStore.getState().serverInfo.networkMode).toBeNull();
      expect(useServerStore.getState().serverInfo.startedAt).toBeNull();
    });
  });

  describe('error transitions', () => {
    it('should transition from idle to error', () => {
      const { startRequested, failed } = useServerStore.getState();
      const error: ServerError = {
        code: 'NO_NETWORK',
        message: 'No network available',
      };

      startRequested();
      failed(error);

      expect(useServerStore.getState().serverInfo.status).toBe('error');
      expect(useServerStore.getState().serverInfo.error).toEqual(error);
    });

    it('should transition from starting to error', () => {
      const { startRequested, failed } = useServerStore.getState();
      const error: ServerError = {
        code: 'PORT_UNAVAILABLE',
        message: 'No port available',
      };

      startRequested();
      failed(error);

      expect(useServerStore.getState().serverInfo.status).toBe('error');
      expect(useServerStore.getState().serverInfo.error).toEqual(error);
    });

    it('should transition from running to error', () => {
      const { startRequested, started, failed } = useServerStore.getState();
      const error: ServerError = {
        code: 'PORT_UNAVAILABLE',
        message: 'Port unavailable',
      };

      startRequested();
      started({
        ip: '192.168.1.100',
        port: 8080,
        url: 'http://192.168.1.100:8080',
        sessionId: 'apple-42',
        networkMode: 'wifi',
        startedAt: Date.now(),
      });
      failed(error);

      expect(useServerStore.getState().serverInfo.status).toBe('error');
      expect(useServerStore.getState().serverInfo.error).toEqual(error);
    });

    it('should reset from error to idle', () => {
      const { failed, reset } = useServerStore.getState();
      const error: ServerError = {
        code: 'UNKNOWN',
        message: 'Unknown error',
      };

      failed(error);
      expect(useServerStore.getState().serverInfo.status).toBe('error');

      reset();
      expect(useServerStore.getState().serverInfo.status).toBe('idle');
      expect(useServerStore.getState().serverInfo.error).toBeNull();
    });
  });

  describe('invalid transition handling', () => {
    it('should ignore transition from idle to running', () => {
      useServerStore.getState().started({
        ip: '192.168.1.100',
        port: 8080,
      });

      // State should not change
      expect(useServerStore.getState().serverInfo.status).toBe('idle');
    });

    it('should ignore transition from running to idle without stopping', () => {
      const { startRequested, started, stopped } = useServerStore.getState();

      startRequested();
      started({
        ip: '192.168.1.100',
        port: 8080,
      });

      expect(useServerStore.getState().serverInfo.status).toBe('running');

      // Try to go directly from running to idle (invalid)
      stopped();

      // Should still be running (invalid transition ignored)
      expect(useServerStore.getState().serverInfo.status).toBe('running');
    });
  });

  describe('started action', () => {
    it('should merge provided info while updating status', () => {
      const { startRequested, started } = useServerStore.getState();

      startRequested();
      started({
        ip: '192.168.0.50',
        port: 3000,
        url: 'http://192.168.0.50:3000',
        sessionId: 'banana-99',
        networkMode: 'wifi',
        startedAt: 1234567890,
      });

      const info = useServerStore.getState().serverInfo;
      expect(info.status).toBe('running');
      expect(info.ip).toBe('192.168.0.50');
      expect(info.port).toBe(3000);
      expect(info.url).toBe('http://192.168.0.50:3000');
      expect(info.sessionId).toBe('banana-99');
      expect(info.networkMode).toBe('wifi');
      expect(info.startedAt).toBe(1234567890);
    });

    it('should handle empty info object gracefully', () => {
      const { startRequested, started } = useServerStore.getState();

      startRequested();
      started({}); // Empty object — only status changes

      const info = useServerStore.getState().serverInfo;
      expect(info.status).toBe('running');
      // Other fields should remain null from initial state (no merge)
      expect(info.ip).toBeNull();
      expect(info.port).toBeNull();
      expect(info.url).toBeNull();
      expect(info.sessionId).toBeNull();
      expect(info.networkMode).toBeNull();
    });

    it('should merge partial info while preserving other fields', () => {
      const { startRequested, started } = useServerStore.getState();

      startRequested();
      started({
        ip: '192.168.1.1',
        port: 8080,
      }); // Partial merge — only ip and port provided

      const info = useServerStore.getState().serverInfo;
      expect(info.status).toBe('running');
      expect(info.ip).toBe('192.168.1.1');
      expect(info.port).toBe(8080);
      expect(info.url).toBeNull(); // Not provided
      expect(info.sessionId).toBeNull(); // Not provided
    });
  });

  describe('failed action', () => {
    it('should update error on transition to error state', () => {
      const { startRequested, failed } = useServerStore.getState();
      const error: ServerError = {
        code: 'UNKNOWN',
        message: 'Something went wrong',
      };

      startRequested();
      failed(error);

      const info = useServerStore.getState().serverInfo;
      expect(info.status).toBe('error');
      expect(info.error).toEqual(error);
    });

    it('should reject multiple failed() calls from error state (error → error is invalid)', () => {
      const { startRequested, failed } = useServerStore.getState();
      const error1: ServerError = {
        code: 'NO_NETWORK',
        message: 'First error',
      };
      const error2: ServerError = {
        code: 'PORT_UNAVAILABLE',
        message: 'Second error',
      };

      // Reach error state via valid transition (idle → starting → error)
      startRequested();
      failed(error1);
      expect(useServerStore.getState().serverInfo.status).toBe('error');
      expect(useServerStore.getState().serverInfo.error).toEqual(error1);

      // Try to transition from error to error (should be no-op)
      failed(error2);
      // Error should not update because error → error is invalid
      expect(useServerStore.getState().serverInfo.status).toBe('error');
      expect(useServerStore.getState().serverInfo.error).toEqual(error1);
    });
  });

  describe('stopped action', () => {
    it('should reset all network-related fields when transitioning to idle', () => {
      const { startRequested, started, stopRequested, stopped } = useServerStore.getState();

      startRequested();
      started({
        ip: '192.168.1.100',
        port: 8080,
        url: 'http://192.168.1.100:8080',
        sessionId: 'test-123',
        networkMode: 'wifi',
        startedAt: Date.now(),
      });

      stopRequested();
      stopped();

      const info = useServerStore.getState().serverInfo;
      expect(info.status).toBe('idle');
      expect(info.ip).toBeNull();
      expect(info.port).toBeNull();
      expect(info.url).toBeNull();
      expect(info.sessionId).toBeNull();
      expect(info.networkMode).toBeNull();
      expect(info.startedAt).toBeNull();
      expect(info.error).toBeNull();
    });
  });

  describe('reset action', () => {
    it('should reset from error state to idle', () => {
      const { reset } = useServerStore.getState();
      const error: ServerError = {
        code: 'PORT_UNAVAILABLE',
        message: 'Port unavailable',
      };

      useServerStore.setState((state) => ({
        serverInfo: {
          ...state.serverInfo,
          status: 'error',
          error,
        },
      }));

      reset();

      const info = useServerStore.getState().serverInfo;
      expect(info.status).toBe('idle');
      expect(info.error).toBeNull();
      expect(info.ip).toBeNull();
    });

    it('should be callable from running state (administrative reset)', () => {
      const { startRequested, started, reset } = useServerStore.getState();

      startRequested();
      started({
        ip: '192.168.1.50',
        port: 9000,
        url: 'http://192.168.1.50:9000',
        sessionId: 'admin-reset',
        networkMode: 'wifi',
        startedAt: Date.now(),
      });

      expect(useServerStore.getState().serverInfo.status).toBe('running');

      // Administrative reset from running state
      reset();

      const info = useServerStore.getState().serverInfo;
      expect(info.status).toBe('idle');
      expect(info.ip).toBeNull();
      expect(info.port).toBeNull();
      expect(info.url).toBeNull();
      expect(info.sessionId).toBeNull();
      expect(info.networkMode).toBeNull();
      expect(info.startedAt).toBeNull();
    });

    it('should reset from any state (unconditional administrative action)', () => {
      const reset = useServerStore.getState().reset;

      const statuses: ServerStatus[] = ['idle', 'starting', 'running', 'stopping', 'error'];

      for (const status of statuses) {
        useServerStore.setState((state) => ({
          serverInfo: {
            ...state.serverInfo,
            status,
            ip: '192.168.1.1',
            port: 8080,
            url: 'http://192.168.1.1:8080',
            error: { code: 'UNKNOWN', message: 'error' },
          },
        }));

        reset();

        const info = useServerStore.getState().serverInfo;
        expect(info.status).toBe('idle');
        expect(info.ip).toBeNull();
        expect(info.error).toBeNull();
      }
    });
  });

  describe('console.warn on invalid transitions', () => {
    it('should log warning when startRequested from non-idle state', () => {
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      const { startRequested, started } = useServerStore.getState();

      startRequested();
      started({ ip: '192.168.1.1', port: 8080 });

      // Try to start again from running state (invalid)
      startRequested();

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Invalid transition: running → starting'),
      );
      warnSpy.mockRestore();
    });

    it('should log warning when stopRequested from non-running state', () => {
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      const { stopRequested } = useServerStore.getState();

      // Try to stop from idle state (invalid)
      stopRequested();

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Invalid transition: idle → stopping'),
      );
      warnSpy.mockRestore();
    });

    it('should log warning when failed from invalid state', () => {
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

      // Set state to error directly
      useServerStore.setState((state) => ({
        serverInfo: {
          ...state.serverInfo,
          status: 'error',
        },
      }));

      const { failed } = useServerStore.getState();
      const error: ServerError = {
        code: 'UNKNOWN',
        message: 'Another error',
      };

      // Try to transition from error to error (invalid)
      failed(error);

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Invalid transition: error → error'),
      );
      warnSpy.mockRestore();
    });
  });

  describe('edge cases and state integrity', () => {
    it('should not allow transitions: idle → running (skip starting)', () => {
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      const { started } = useServerStore.getState();

      // Try to transition directly from idle to running
      started({ ip: '192.168.1.1', port: 8080 });

      expect(useServerStore.getState().serverInfo.status).toBe('idle');
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Invalid transition: idle → running'),
      );
      warnSpy.mockRestore();
    });

    it('should preserve error state when attempting invalid transition', () => {
      const error: ServerError = {
        code: 'PORT_UNAVAILABLE',
        message: 'Port not available',
      };

      useServerStore.setState((state) => ({
        serverInfo: {
          ...state.serverInfo,
          status: 'error',
          error,
        },
      }));

      const { startRequested } = useServerStore.getState();

      // Try invalid transition from error to starting
      startRequested();

      const info = useServerStore.getState().serverInfo;
      expect(info.status).toBe('error');
      expect(info.error).toEqual(error); // Error state preserved
    });
  });
});
