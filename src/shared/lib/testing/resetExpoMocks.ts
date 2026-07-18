import * as FileSystem from 'expo-file-system';
import * as Network from 'expo-network';

/**
 * Reseta o histórico de chamadas (`mock.calls`/`mock.results`) de todas as funções mockadas
 * de `expo-file-system` e `expo-network`, sem remover as implementações padrão configuradas
 * em `__mocks__/expo-file-system.ts` e `__mocks__/expo-network.ts` (na raiz do projeto).
 *
 * Útil em `beforeEach`/`afterEach` de testes de features que dependem de filesystem/rede
 * (`features/server`, `features/transfer`, `features/files`), para garantir isolamento entre
 * casos de teste sem precisar reconfigurar cada mock manualmente.
 */
export function resetExpoMocks(): void {
  const fileSystemMocks = [
    FileSystem.getInfoAsync,
    FileSystem.readAsStringAsync,
    FileSystem.writeAsStringAsync,
    FileSystem.deleteAsync,
    FileSystem.makeDirectoryAsync,
    FileSystem.readDirectoryAsync,
    FileSystem.copyAsync,
    FileSystem.moveAsync,
    FileSystem.getFreeDiskStorageAsync,
  ];

  const networkMocks = [
    Network.getNetworkStateAsync,
    Network.getIpAddressAsync,
    Network.isAirplaneModeEnabledAsync,
    Network.addNetworkStateListener,
    Network.useNetworkState,
  ];

  [...fileSystemMocks, ...networkMocks].forEach((mockFn) => {
    (mockFn as jest.Mock).mockClear();
  });
}
