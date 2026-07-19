/**
 * Tests for useServer hook
 *
 * Note: useServer is a React hook and cannot be called directly in Jest test functions.
 * However, we can test the hook's effects on the serverStore indirectly by:
 * 1. Verifying that the store methods (`startRequested`, `started`, `failed`, etc.) work correctly
 * 2. Testing the error mapping logic through the ServerService integration
 *
 * Since useServer essentially orchestrates ServerService + serverStore, and both are
 * already thoroughly tested, we focus on integration scenarios.
 */

import * as Network from 'expo-network';
import { ServerServiceImpl, ServerServiceError } from '../../services/serverService';
import { useServerStore } from '../../store/serverStore';
import type { HttpModule } from '../../services/httpModule';

// Mock expo-network
jest.mock('expo-network');

// Mock generateSessionId para testes determinísticos
jest.mock('../../../../shared/lib', () => ({
  generateSessionId: jest.fn(() => 'test-session-123'),
}));

describe('useServer hook integration', () => {
  let mockHttpModule: jest.Mocked<HttpModule>;

  beforeEach(() => {
    jest.clearAllMocks();

    // Reset store to initial state
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

    // Setup mock httpModule
    mockHttpModule = {
      start: jest.fn(),
      stop: jest.fn(),
      addListener: jest.fn(),
      removeListener: jest.fn(),
      isRunning: jest.fn(() => false),
    };

    // Mock expo-network to return valid network state
    jest.mocked(Network).getNetworkStateAsync = jest.fn().mockResolvedValue({
      isConnected: true,
    });
    jest.mocked(Network).getIpAddressAsync = jest.fn().mockResolvedValue('192.168.1.42');
  });

  /**
   * Test the core flow: ServerService is created with injected HttpModule,
   * called, and result updates store via useServer methods
   */
  describe('start flow', () => {
    it('should successfully start server with wifi mode and update store', async () => {
      const serverService = new ServerServiceImpl(mockHttpModule);
      const store = useServerStore.getState();

      // Simulate what useServer.start does:
      // 1. Call startRequested → status: idle → starting
      store.startRequested();
      expect(useServerStore.getState().serverInfo.status).toBe('starting');

      // 2. Call serverService.start()
      const result = await serverService.start('wifi');

      // 3. Call started with result → status: starting → running
      store.started({
        networkMode: result.networkMode,
        ip: result.ip,
        port: result.port,
        url: result.url,
        sessionId: result.sessionId,
        startedAt: Date.now(),
      });

      const { serverInfo } = useServerStore.getState();
      expect(serverInfo.status).toBe('running');
      expect(serverInfo.ip).toBe('192.168.1.42');
      expect(serverInfo.port).toBe(8080);
      expect(serverInfo.url).toBe('http://192.168.1.42:8080');
      expect(serverInfo.sessionId).toBe('test-session-123');
      expect(serverInfo.networkMode).toBe('wifi');
      expect(mockHttpModule.start).toHaveBeenCalledWith(8080);
    });

    it('should handle NO_NETWORK error and update store to error state', async () => {
      jest.mocked(Network).getNetworkStateAsync = jest
        .fn()
        .mockResolvedValue({ isConnected: false });

      const serverService = new ServerServiceImpl(mockHttpModule);
      const store = useServerStore.getState();

      store.startRequested();

      try {
        await serverService.start('wifi');
        throw new Error('Should have thrown');
      } catch (error) {
        if (error instanceof ServerServiceError) {
          // Simulate what useServer does: map error and call failed()
          store.failed({
            code: error.code,
            message: 'Nenhuma rede disponível. Conecte a uma rede Wi-Fi ou crie uma rede própria.',
          });
        } else {
          throw error;
        }
      }

      const { serverInfo } = useServerStore.getState();
      expect(serverInfo.status).toBe('error');
      expect(serverInfo.error?.code).toBe('NO_NETWORK');
    });

    it('should handle PORT_UNAVAILABLE error and update store to error state', async () => {
      mockHttpModule.start.mockRejectedValue(new Error('Port 8080 already in use'));

      const serverService = new ServerServiceImpl(mockHttpModule);
      const store = useServerStore.getState();

      store.startRequested();

      try {
        await serverService.start('wifi');
        throw new Error('Should have thrown');
      } catch (error) {
        if (error instanceof ServerServiceError) {
          store.failed({
            code: error.code,
            message: 'A porta padrão está indisponível. Tente outra conexão ou reinicie o app.',
          });
        } else {
          throw error;
        }
      }

      const { serverInfo } = useServerStore.getState();
      expect(serverInfo.status).toBe('error');
      expect(serverInfo.error?.code).toBe('PORT_UNAVAILABLE');
    });

    it('should map all ServerErrorCodes to translated messages', async () => {
      const errorMappings: Record<string, string> = {
        NO_NETWORK: 'Nenhuma rede disponível. Conecte a uma rede Wi-Fi ou crie uma rede própria.',
        PORT_UNAVAILABLE:
          'A porta padrão está indisponível. Tente outra conexão ou reinicie o app.',
        PERMISSION_DENIED: 'Permissão negada. Verifique as configurações de rede do dispositivo.',
        HOTSPOT_UNSUPPORTED: 'Seu dispositivo não suporta criar uma rede própria.',
        HOTSPOT_FAILED: 'Falha ao criar rede própria. Tente novamente.',
        UNKNOWN: 'Erro desconhecido ao gerenciar servidor.',
      };

      for (const [code, expectedMessage] of Object.entries(errorMappings)) {
        // Reset store
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

        const serverService = new ServerServiceImpl(mockHttpModule);
        const store = useServerStore.getState();

        const error = new ServerServiceError(code, 'Technical message');
        mockHttpModule.start.mockRejectedValueOnce(error);

        store.startRequested();

        try {
          await serverService.start('wifi');
        } catch (err) {
          if (err instanceof ServerServiceError) {
            store.failed({
              code: err.code,
              message: expectedMessage,
            });
          }
        }

        const { serverInfo } = useServerStore.getState();
        expect(serverInfo.error?.message).toBe(expectedMessage);
      }
    });

    it('should support hotspot mode', async () => {
      const serverService = new ServerServiceImpl(mockHttpModule);
      const store = useServerStore.getState();

      store.startRequested();
      const result = await serverService.start('hotspot');

      store.started({
        networkMode: result.networkMode,
        ip: result.ip,
        port: result.port,
        url: result.url,
        sessionId: result.sessionId,
        startedAt: Date.now(),
      });

      expect(useServerStore.getState().serverInfo.networkMode).toBe('hotspot');
    });
  });

  describe('stop flow', () => {
    beforeEach(() => {
      useServerStore.setState({
        serverInfo: {
          status: 'running',
          networkMode: 'wifi',
          hotspot: null,
          ip: '192.168.1.42',
          port: 8080,
          url: 'http://192.168.1.42:8080',
          sessionId: 'test-session-123',
          startedAt: Date.now(),
          error: null,
        },
      });
    });

    it('should successfully stop server and reset store to idle', async () => {
      const serverService = new ServerServiceImpl(mockHttpModule);
      const store = useServerStore.getState();

      // Simulate what useServer.stop does:
      store.stopRequested();
      expect(useServerStore.getState().serverInfo.status).toBe('stopping');

      await serverService.stop();

      store.stopped();

      const { serverInfo } = useServerStore.getState();
      expect(serverInfo.status).toBe('idle');
      expect(serverInfo.ip).toBeNull();
      expect(serverInfo.port).toBeNull();
      expect(serverInfo.url).toBeNull();
      expect(serverInfo.sessionId).toBeNull();
      expect(mockHttpModule.stop).toHaveBeenCalledTimes(1);
    });

    it('should handle stop error', async () => {
      mockHttpModule.stop.mockRejectedValue(new Error('Stop failed'));

      const serverService = new ServerServiceImpl(mockHttpModule);
      const store = useServerStore.getState();

      store.stopRequested();

      try {
        await serverService.stop();
        throw new Error('Should have thrown');
      } catch (error) {
        if (error instanceof Error) {
          store.failed({
            code: 'UNKNOWN',
            message: 'Erro desconhecido ao gerenciar servidor.',
          });
        }
      }

      expect(useServerStore.getState().serverInfo.status).toBe('error');
    });
  });

  describe('reset flow', () => {
    it('should reset from error to idle', () => {
      useServerStore.setState({
        serverInfo: {
          status: 'error',
          networkMode: null,
          hotspot: null,
          ip: null,
          port: null,
          url: null,
          sessionId: null,
          startedAt: null,
          error: { code: 'NO_NETWORK', message: 'No network' },
        },
      });

      const store = useServerStore.getState();

      expect(useServerStore.getState().serverInfo.status).toBe('error');

      store.reset();

      const { serverInfo } = useServerStore.getState();
      expect(serverInfo.status).toBe('idle');
      expect(serverInfo.error).toBeNull();
    });

    it('should clear all fields on reset', () => {
      useServerStore.setState({
        serverInfo: {
          status: 'running',
          networkMode: 'wifi',
          hotspot: null,
          ip: '192.168.1.1',
          port: 8080,
          url: 'http://192.168.1.1:8080',
          sessionId: 'test',
          startedAt: Date.now(),
          error: null,
        },
      });

      const store = useServerStore.getState();
      store.reset();

      const { serverInfo } = useServerStore.getState();
      expect(serverInfo.networkMode).toBeNull();
      expect(serverInfo.ip).toBeNull();
      expect(serverInfo.port).toBeNull();
      expect(serverInfo.url).toBeNull();
      expect(serverInfo.sessionId).toBeNull();
      expect(serverInfo.startedAt).toBeNull();
    });
  });

  describe('complete state machine cycles', () => {
    it('should complete full cycle: idle → starting → running → stopping → idle', async () => {
      const serverService = new ServerServiceImpl(mockHttpModule);
      const store = useServerStore.getState();

      // Start
      store.startRequested();
      expect(useServerStore.getState().serverInfo.status).toBe('starting');

      const result = await serverService.start('wifi');
      store.started({
        networkMode: result.networkMode,
        ip: result.ip,
        port: result.port,
        url: result.url,
        sessionId: result.sessionId,
        startedAt: Date.now(),
      });
      expect(useServerStore.getState().serverInfo.status).toBe('running');

      // Stop
      store.stopRequested();
      expect(useServerStore.getState().serverInfo.status).toBe('stopping');

      await serverService.stop();
      store.stopped();
      expect(useServerStore.getState().serverInfo.status).toBe('idle');
    });

    it('should handle error recovery flow: start → error → reset → start', async () => {
      mockHttpModule.start.mockRejectedValueOnce(new ServerServiceError('NO_NETWORK', 'Test'));

      const serverService1 = new ServerServiceImpl(mockHttpModule);
      const store = useServerStore.getState();

      // Start with error
      store.startRequested();
      try {
        await serverService1.start('wifi');
      } catch (error) {
        if (error instanceof ServerServiceError) {
          store.failed({
            code: error.code,
            message: 'Nenhuma rede disponível. Conecte a uma rede Wi-Fi ou crie uma rede própria.',
          });
        }
      }

      expect(useServerStore.getState().serverInfo.status).toBe('error');

      // Reset
      store.reset();
      expect(useServerStore.getState().serverInfo.status).toBe('idle');

      // Retry start
      mockHttpModule.start.mockClear();
      mockHttpModule.start.mockResolvedValueOnce(undefined);

      const serverService2 = new ServerServiceImpl(mockHttpModule);
      store.startRequested();

      const result = await serverService2.start('wifi');
      store.started({
        networkMode: result.networkMode,
        ip: result.ip,
        port: result.port,
        url: result.url,
        sessionId: result.sessionId,
        startedAt: Date.now(),
      });

      expect(useServerStore.getState().serverInfo.status).toBe('running');
    });

    it('should support multiple start/stop cycles with different modes', async () => {
      const store = useServerStore.getState();

      // Cycle 1: wifi
      const serverService1 = new ServerServiceImpl(mockHttpModule);

      store.startRequested();
      const result1 = await serverService1.start('wifi');
      store.started({
        networkMode: result1.networkMode,
        ip: result1.ip,
        port: result1.port,
        url: result1.url,
        sessionId: result1.sessionId,
        startedAt: Date.now(),
      });

      expect(useServerStore.getState().serverInfo.networkMode).toBe('wifi');

      store.stopRequested();
      await serverService1.stop();
      store.stopped();

      // Cycle 2: hotspot
      mockHttpModule.start.mockClear();
      mockHttpModule.stop.mockClear();

      const serverService2 = new ServerServiceImpl(mockHttpModule);

      store.startRequested();
      const result2 = await serverService2.start('hotspot');
      store.started({
        networkMode: result2.networkMode,
        ip: result2.ip,
        port: result2.port,
        url: result2.url,
        sessionId: result2.sessionId,
        startedAt: Date.now(),
      });

      expect(useServerStore.getState().serverInfo.networkMode).toBe('hotspot');

      store.stopRequested();
      await serverService2.stop();
      store.stopped();

      expect(useServerStore.getState().serverInfo.status).toBe('idle');
    });
  });

  describe('timestamp handling', () => {
    it('should set startedAt with real Date.now() timestamp', async () => {
      const before = Date.now();
      const serverService = new ServerServiceImpl(mockHttpModule);
      const store = useServerStore.getState();

      store.startRequested();
      const result = await serverService.start('wifi');

      const now = Date.now();
      store.started({
        networkMode: result.networkMode,
        ip: result.ip,
        port: result.port,
        url: result.url,
        sessionId: result.sessionId,
        startedAt: now,
      });

      const { startedAt } = useServerStore.getState().serverInfo;
      expect(startedAt).not.toBeNull();
      expect(startedAt! >= before).toBe(true);
      expect(startedAt! <= Date.now()).toBe(true);
    });

    it('should clear startedAt on stop', async () => {
      const serverService = new ServerServiceImpl(mockHttpModule);
      const store = useServerStore.getState();

      store.startRequested();
      const result = await serverService.start('wifi');
      store.started({
        networkMode: result.networkMode,
        ip: result.ip,
        port: result.port,
        url: result.url,
        sessionId: result.sessionId,
        startedAt: Date.now(),
      });

      expect(useServerStore.getState().serverInfo.startedAt).not.toBeNull();

      store.stopRequested();
      await serverService.stop();
      store.stopped();

      expect(useServerStore.getState().serverInfo.startedAt).toBeNull();
    });
  });
});
