/**
 * Mock manual do módulo `expo-network` (T-003 · Infra de testes).
 *
 * Jest carrega automaticamente qualquer arquivo em `__mocks__/<pacote>.ts` (adjacente a
 * `node_modules`) sempre que um teste importar esse pacote — não é necessário chamar
 * `jest.mock('expo-network')` manualmente. Ver https://jestjs.io/docs/manual-mocks.
 *
 * Usado principalmente por `features/server` (T-203 · ServerService) para obter o IP local
 * (rede Wi-Fi ou interface do hotspot) ao iniciar o servidor. Por padrão simula um dispositivo
 * conectado a uma rede Wi-Fi com um IP de rede local válido; sobrescreva com
 * `(Network.getNetworkStateAsync as jest.Mock).mockResolvedValueOnce(...)` para simular
 * cenários como `NO_NETWORK`.
 */

export enum NetworkStateType {
  NONE = 'NONE',
  UNKNOWN = 'UNKNOWN',
  CELLULAR = 'CELLULAR',
  WIFI = 'WIFI',
  BLUETOOTH = 'BLUETOOTH',
  ETHERNET = 'ETHERNET',
  WIMAX = 'WIMAX',
  VPN = 'VPN',
  OTHER = 'OTHER',
}

export interface MockNetworkState {
  type: NetworkStateType;
  isConnected: boolean;
  isInternetReachable: boolean;
}

export function createMockNetworkState(overrides: Partial<MockNetworkState> = {}): MockNetworkState {
  return {
    type: NetworkStateType.WIFI,
    isConnected: true,
    isInternetReachable: true,
    ...overrides,
  };
}

export const getNetworkStateAsync = jest.fn(async () => createMockNetworkState());

export const getIpAddressAsync = jest.fn(async () => '192.168.1.42');

export const isAirplaneModeEnabledAsync = jest.fn(async () => false);

export const addNetworkStateListener = jest.fn((_listener: (event: MockNetworkState) => void) => ({
  remove: jest.fn(),
}));

export const useNetworkState = jest.fn(() => createMockNetworkState());
