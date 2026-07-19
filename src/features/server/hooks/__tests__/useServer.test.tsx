import * as Network from 'expo-network';
import { renderHook, act } from '@testing-library/react-native';
import { useServer } from '../useServer';
import { useServerStore } from '../../store/serverStore';
import { ServerServiceError } from '../../services/serverService';
import type { HttpModule } from '../../services/httpModule';
import type { ServerErrorCode } from '../../types';

jest.mock('expo-network');
jest.mock('../../../../shared/lib', () => ({
  generateSessionId: jest.fn(() => 'test-session-123'),
}));

describe('useServer hook', () => {
  let mockHttpModule: jest.Mocked<HttpModule>;

  const createMockHttpModule = (): jest.Mocked<HttpModule> => ({
    start: jest.fn(),
    stop: jest.fn(),
    addListener: jest.fn(),
    removeListener: jest.fn(),
    isRunning: jest.fn(() => false),
  });

  const resetStore = () => {
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
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
    resetStore();
    mockHttpModule = createMockHttpModule();

    jest.mocked(Network).getNetworkStateAsync = jest.fn().mockResolvedValue({
      isConnected: true,
    });
    jest.mocked(Network).getIpAddressAsync = jest.fn().mockResolvedValue('192.168.1.42');
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  // Render hook once and use result throughout tests
  it('deve iniciar servidor via hook', async () => {
    const { result } = await renderHook(() => useServer(mockHttpModule));

    expect(result.current).toBeDefined();
    expect(useServerStore.getState().serverInfo.status).toBe('idle');

    await act(async () => {
      await result.current.start('wifi');
    });

    const { serverInfo } = useServerStore.getState();
    expect(serverInfo.status).toBe('running');
    expect(serverInfo.ip).toBe('192.168.1.42');
    expect(serverInfo.port).toBe(8080);
    expect(mockHttpModule.start).toHaveBeenCalledWith(8080);
  });

  it('deve transicionar para error com NO_NETWORK', async () => {
    jest.mocked(Network).getNetworkStateAsync = jest.fn().mockResolvedValue({
      isConnected: false,
    });

    const { result } = await renderHook(() => useServer(mockHttpModule));

    expect(result.current).toBeDefined();

    let caughtError: unknown;
    await act(async () => {
      try {
        await result.current.start('wifi');
      } catch (error) {
        caughtError = error;
      }
    });

    expect(caughtError).toBeInstanceOf(ServerServiceError);
    expect(useServerStore.getState().serverInfo.error?.code).toBe('NO_NETWORK');
  });

  it('deve mapear todos os ServerErrorCodes', async () => {
    const codes: ServerErrorCode[] = [
      'PORT_UNAVAILABLE',
      'PERMISSION_DENIED',
      'HOTSPOT_UNSUPPORTED',
      'HOTSPOT_FAILED',
      'UNKNOWN',
    ];

    for (const code of codes) {
      resetStore();

      mockHttpModule.start.mockRejectedValueOnce(new ServerServiceError(code, 'Tech'));

      const { result } = await renderHook(() => useServer(mockHttpModule));

      expect(result.current).toBeDefined();

      let caughtError: unknown;
      await act(async () => {
        try {
          await result.current.start('wifi');
        } catch (error) {
          caughtError = error;
        }
      });

      expect(caughtError).toBeDefined();
      expect(useServerStore.getState().serverInfo.error?.code).toBe(code);
      expect(useServerStore.getState().serverInfo.error?.message).toBeTruthy();

      jest.clearAllMocks();
      mockHttpModule = createMockHttpModule();
    }
  });

  it('deve completar ciclo start/stop', async () => {
    const { result } = await renderHook(() => useServer(mockHttpModule));

    expect(result.current).toBeDefined();

    await act(async () => {
      await result.current.start('wifi');
    });
    expect(useServerStore.getState().serverInfo.status).toBe('running');

    await act(async () => {
      await result.current.stop();
    });
    expect(useServerStore.getState().serverInfo.status).toBe('idle');
  });

  it('deve permitir múltiplos ciclos com diferentes modos', async () => {
    const { result } = await renderHook(() => useServer(mockHttpModule));

    expect(result.current).toBeDefined();

    await act(async () => {
      await result.current.start('wifi');
    });
    expect(useServerStore.getState().serverInfo.networkMode).toBe('wifi');

    await act(async () => {
      await result.current.stop();
    });

    mockHttpModule.start.mockClear();

    await act(async () => {
      await result.current.start('hotspot');
    });
    expect(useServerStore.getState().serverInfo.networkMode).toBe('hotspot');

    await act(async () => {
      await result.current.stop();
    });
    expect(useServerStore.getState().serverInfo.status).toBe('idle');
  });

  it('deve recuperar de erro via reset', async () => {
    const { result } = await renderHook(() => useServer(mockHttpModule));

    expect(result.current).toBeDefined();

    mockHttpModule.start.mockRejectedValueOnce(new ServerServiceError('NO_NETWORK', 'Err'));

    let caughtError: unknown;
    await act(async () => {
      try {
        await result.current.start('wifi');
      } catch (error) {
        caughtError = error;
      }
    });

    expect(caughtError).toBeDefined();
    expect(useServerStore.getState().serverInfo.status).toBe('error');

    act(() => {
      result.current.reset();
    });
    expect(useServerStore.getState().serverInfo.status).toBe('idle');

    mockHttpModule.start.mockClear();

    await act(async () => {
      await result.current.start('wifi');
    });
    expect(useServerStore.getState().serverInfo.status).toBe('running');
  });
});
