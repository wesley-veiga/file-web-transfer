import * as Network from 'expo-network';
import { renderHook, act } from '@testing-library/react-native';
import { useServer } from '../useServer';
import { useServerStore } from '../../store/serverStore';
import { ServerServiceError } from '../../services/serverService';
import type { ServerErrorCode } from '../../types';
import { createMockHttpModule as createMockHttpModuleHelper } from '../../../../__mocks__/testHelpers';

jest.mock('expo-network');
jest.mock('../../../../shared/lib', () => ({
  generateSessionId: jest.fn(() => 'test-session-123'),
}));

describe('useServer hook', () => {
  let mockHttpModule: jest.Mocked<ReturnType<typeof createMockHttpModuleHelper>>;

  const createMockHttpModule = (): jest.Mocked<ReturnType<typeof createMockHttpModuleHelper>> =>
    createMockHttpModuleHelper();

  const resetStore = () => {
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
    const codes: ServerErrorCode[] = ['PORT_UNAVAILABLE', 'PERMISSION_DENIED', 'UNKNOWN'];

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

  it('deve permitir múltiplos ciclos de start/stop', async () => {
    const { result } = await renderHook(() => useServer(mockHttpModule));

    expect(result.current).toBeDefined();

    await act(async () => {
      await result.current.start('wifi');
    });
    expect(useServerStore.getState().serverInfo.networkMode).toBe('wifi');

    await act(async () => {
      await result.current.stop();
    });
    expect(useServerStore.getState().serverInfo.status).toBe('idle');

    mockHttpModule.start.mockClear();

    await act(async () => {
      await result.current.start('wifi');
    });
    const state = useServerStore.getState();
    expect(state.serverInfo.networkMode).toBe('wifi');
    expect(state.serverInfo.status).toBe('running');

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

    // Testa Error genérico no stop() (linhas 19-26 + 130-135)
    // serverService.stop() não trata erro, então Error genérico vai direto
    // para mapErrorToServerError() nas linhas 19-26
    mockHttpModule.stop.mockRejectedValueOnce(new Error('Falha ao parar'));

    await act(async () => {
      try {
        await result.current.stop();
      } catch (error) {
        caughtError = error;
      }
    });

    expect(caughtError).toBeInstanceOf(Error);
    const state = useServerStore.getState().serverInfo;
    expect(state.status).toBe('error');
    expect(state.error?.code).toBe('UNKNOWN');
    // mapErrorToServerError() para Error genérico (linhas 19-26) retorna mensagem sem ponto
    expect(state.error?.message).toBe('Erro desconhecido ao gerenciar servidor');

    // Testar também o fallback de linha 26 (erro non-Error) no stop()
    act(() => {
      result.current.reset();
    });

    await act(async () => {
      await result.current.start('wifi');
    });
    expect(useServerStore.getState().serverInfo.status).toBe('running');

    // Mock stop para rejeitar com valor non-Error (string)
    // Isso vai para mapErrorToServerError() linha 26 (fallback)
    mockHttpModule.stop.mockRejectedValueOnce('non-error-value');

    await act(async () => {
      try {
        await result.current.stop();
      } catch (error) {
        caughtError = error;
      }
    });

    expect(caughtError).toBe('non-error-value');
    const state2 = useServerStore.getState().serverInfo;
    expect(state2.status).toBe('error');
    // Fallback de linha 26 retorna code 'UNKNOWN'
    expect(state2.error?.code).toBe('UNKNOWN');
  });
});
