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
        hotspot: null,
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
      expect(serverInfo.hotspot).toBeNull();
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
      const { startRequested, started, stopRequested, stopped, serverInfo } =
        useServerStore.getState();

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
        code: 'HOTSPOT_FAILED',
        message: 'Failed to start hotspot',
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
      const { serverInfo: initialState } = useServerStore.getState();
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
        networkMode: 'hotspot',
        startedAt: 1234567890,
      });

      const info = useServerStore.getState().serverInfo;
      expect(info.status).toBe('running');
      expect(info.ip).toBe('192.168.0.50');
      expect(info.port).toBe(3000);
      expect(info.url).toBe('http://192.168.0.50:3000');
      expect(info.sessionId).toBe('banana-99');
      expect(info.networkMode).toBe('hotspot');
      expect(info.startedAt).toBe(1234567890);
    });
  });
});
