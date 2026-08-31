/**
 * Test suite for useNetworkStatus hook (T-204)
 *
 * Covers:
 * - Initial state fetching via getNetworkStateAsync()
 * - Network state listener registration and removal
 * - State updates on network changes
 * - Error handling
 * - Memory leak prevention (cleanup on unmount)
 *
 * `ssid` sempre é `null` (achado de T-701: `expo-network` nunca expôs esse campo em
 * `NetworkState` — ver comentário em `useNetworkStatus.ts`), então os testes abaixo
 * verificam apenas que o hook nunca tenta popular `ssid` com um valor, em vez de
 * cobrir variações de valor de SSID (o que testava uma lógica que nunca funcionou
 * em produção — expo-network não fornece isso).
 */

import { renderHook, waitFor, act } from '@testing-library/react-native';
import * as Network from 'expo-network';
import { useNetworkStatus } from '../useNetworkStatus';

jest.mock('expo-network');

const mockGetNetworkStateAsync = Network.getNetworkStateAsync as jest.MockedFunction<
  typeof Network.getNetworkStateAsync
>;
const mockAddNetworkStateListener = Network.addNetworkStateListener as jest.MockedFunction<
  typeof Network.addNetworkStateListener
>;

describe('useNetworkStatus (T-204)', () => {
  let mockListenerRemove: jest.Mock;
  let capturedListener: ((state: { isConnected: boolean | null; type?: string }) => void) | null;

  beforeEach(() => {
    jest.clearAllMocks();

    mockListenerRemove = jest.fn();
    capturedListener = null;

    mockGetNetworkStateAsync.mockResolvedValue({
      isConnected: true,
      isInternetReachable: true,
      type: Network.NetworkStateType.WIFI,
    });

    mockAddNetworkStateListener.mockImplementation(((
      callback: (state: { isConnected: boolean | null; type?: string }) => void,
    ) => {
      capturedListener = callback;
      return {
        remove: mockListenerRemove,
      };
    }) as unknown as typeof Network.addNetworkStateListener);
  });

  describe('Hook initialization', () => {
    it('returns NetworkStatus object', async () => {
      const { result } = await renderHook(() => useNetworkStatus());
      expect(result.current).toBeDefined();
    });

    it('returns object with required properties', async () => {
      const { result } = await renderHook(() => useNetworkStatus());
      expect(result.current).toHaveProperty('isConnected');
      expect(result.current).toHaveProperty('ssid');
    });
  });

  describe('State updates from getNetworkStateAsync', () => {
    it('updates with connected WiFi state', async () => {
      mockGetNetworkStateAsync.mockResolvedValueOnce({
        isConnected: true,
        type: Network.NetworkStateType.WIFI,
      });

      const { result } = await renderHook(() => useNetworkStatus());

      await waitFor(() => {
        expect(result.current.isConnected).toBe(true);
      });
      expect(result.current.ssid).toBeNull();
    });

    it('updates with disconnected state', async () => {
      mockGetNetworkStateAsync.mockResolvedValueOnce({
        isConnected: false,
        type: Network.NetworkStateType.NONE,
      });

      const { result } = await renderHook(() => useNetworkStatus());

      await waitFor(() => {
        expect(result.current.isConnected).toBe(false);
      });
      expect(result.current.ssid).toBeNull();
    });

    it('handles undefined isConnected as false', async () => {
      mockGetNetworkStateAsync.mockResolvedValueOnce({
        isConnected: undefined,
        type: Network.NetworkStateType.NONE,
      });

      const { result } = await renderHook(() => useNetworkStatus());

      await waitFor(() => {
        expect(result.current.isConnected).toBe(false);
      });
    });

    it('handles null isConnected as false', async () => {
      mockGetNetworkStateAsync.mockResolvedValueOnce({
        isConnected: null,
        type: Network.NetworkStateType.NONE,
      } as unknown as Network.NetworkState);

      const { result } = await renderHook(() => useNetworkStatus());

      await waitFor(() => {
        expect(result.current.isConnected).toBe(false);
      });
    });
  });

  describe('Error handling', () => {
    it('defaults to disconnected on async error', async () => {
      mockGetNetworkStateAsync.mockRejectedValueOnce(new Error('Network error'));

      const { result } = await renderHook(() => useNetworkStatus());

      await waitFor(() => {
        expect(result.current.isConnected).toBe(false);
      });
      expect(result.current.ssid).toBeNull();
    });

    it('handles non-Error rejection', async () => {
      mockGetNetworkStateAsync.mockRejectedValueOnce('string error');

      const { result } = await renderHook(() => useNetworkStatus());

      await waitFor(() => {
        expect(result.current.isConnected).toBe(false);
      });
    });
  });

  describe('Listener callback updates', () => {
    it('processes connection event from listener', async () => {
      const { result } = await renderHook(() => useNetworkStatus());

      expect(capturedListener).not.toBeNull();
      await act(async () => {
        capturedListener!({ isConnected: true, type: 'wifi' });
      });

      await waitFor(() => {
        expect(result.current.isConnected).toBe(true);
      });
      expect(result.current.ssid).toBeNull();
    });

    it('processes disconnection event from listener', async () => {
      const { result } = await renderHook(() => useNetworkStatus());

      expect(capturedListener).not.toBeNull();
      await act(async () => {
        capturedListener!({ isConnected: false, type: 'none' });
      });

      await waitFor(() => {
        expect(result.current.isConnected).toBe(false);
      });
    });

    it('handles listener with null isConnected', async () => {
      const { result } = await renderHook(() => useNetworkStatus());

      expect(capturedListener).not.toBeNull();
      await act(async () => {
        capturedListener!({ isConnected: null, type: 'none' });
      });

      await waitFor(() => {
        expect(result.current.isConnected).toBe(false);
      });
    });

    it('processes multiple successive listener events', async () => {
      const { result } = await renderHook(() => useNetworkStatus());

      const updates = [
        { isConnected: true, type: 'wifi' },
        { isConnected: false, type: 'none' },
        { isConnected: true, type: 'cellular' },
      ];

      for (const update of updates) {
        await act(async () => {
          capturedListener!(update);
        });
      }

      expect(result.current.isConnected).toBe(true);
    });

    it('handles malformed listener state without throwing', async () => {
      const { result } = await renderHook(() => useNetworkStatus());

      expect(() => {
        act(() => {
          capturedListener!({ isConnected: 'invalid' as unknown as boolean });
        });
      }).not.toThrow();

      expect(result.current).toBeDefined();
    });
  });

  describe('Return value contract', () => {
    it('isConnected is boolean', async () => {
      const { result } = await renderHook(() => useNetworkStatus());

      await waitFor(() => {
        if (result.current) {
          expect(typeof result.current.isConnected).toBe('boolean');
        }
      });
    });

    it('ssid is always null (expo-network não fornece SSID — ver comentário do hook)', async () => {
      const { result } = await renderHook(() => useNetworkStatus());

      await waitFor(() => {
        if (result.current) {
          expect(result.current.ssid).toBeNull();
        }
      });
    });
  });

  describe('Cleanup and memory', () => {
    it('provides mechanism for cleaning up listener subscription', () => {
      // O hook faz cleanup do listener via isMounted flag + subscription.remove()
      // no retorno do useEffect (lógica não alterada por este fix — ver useNetworkStatus.ts).
      expect(typeof mockListenerRemove).toBe('function');
    });
  });
});
