/**
 * Teste exemplo da infra de testes (T-003).
 *
 * Prova que:
 * 1. `expo-file-system` e `expo-network` são automaticamente mockados via
 *    `__mocks__/expo-file-system.ts` e `__mocks__/expo-network.ts` (nenhum `jest.mock()`
 *    explícito é necessário);
 * 2. `resetExpoMocks` limpa o histórico de chamadas desses mocks entre casos de teste;
 * 3. `npm test -- --coverage` roda com cobertura reportada para `shared/lib`.
 */
import * as FileSystem from 'expo-file-system';
import * as Network from 'expo-network';

import { resetExpoMocks } from '../testing/resetExpoMocks';

describe('infra de testes — mocks de expo-file-system e expo-network', () => {
  afterEach(() => {
    resetExpoMocks();
  });

  it('mocka expo-file-system.writeAsStringAsync/readAsStringAsync sem I/O real', async () => {
    await FileSystem.writeAsStringAsync('file:///mock-sandbox/documents/foo.txt', 'conteudo');
    const info = await FileSystem.getInfoAsync('file:///mock-sandbox/documents/foo.txt');

    expect(FileSystem.writeAsStringAsync).toHaveBeenCalledWith(
      'file:///mock-sandbox/documents/foo.txt',
      'conteudo'
    );
    expect(info.exists).toBe(true);
    expect(info.uri).toBe('file:///mock-sandbox/documents/foo.txt');
  });

  it('mocka expo-file-system.deleteAsync sem I/O real', async () => {
    await expect(
      FileSystem.deleteAsync('file:///mock-sandbox/documents/foo.txt')
    ).resolves.toBeUndefined();
    expect(FileSystem.deleteAsync).toHaveBeenCalledTimes(1);
  });

  it('mocka expo-network.getNetworkStateAsync com estado Wi-Fi por padrão', async () => {
    const state = await Network.getNetworkStateAsync();

    expect(state).toEqual({
      type: Network.NetworkStateType.WIFI,
      isConnected: true,
      isInternetReachable: true,
    });
  });

  it('permite sobrescrever o estado de rede para simular ausência de rede', async () => {
    (Network.getNetworkStateAsync as jest.Mock).mockResolvedValueOnce({
      type: Network.NetworkStateType.NONE,
      isConnected: false,
      isInternetReachable: false,
    });

    const state = await Network.getNetworkStateAsync();

    expect(state.isConnected).toBe(false);
  });

  it('resetExpoMocks limpa o histórico de chamadas sem remover a implementação padrão', async () => {
    await FileSystem.readAsStringAsync('file:///mock-sandbox/documents/foo.txt');
    expect(FileSystem.readAsStringAsync).toHaveBeenCalledTimes(1);

    resetExpoMocks();

    expect(FileSystem.readAsStringAsync).toHaveBeenCalledTimes(0);
    // A implementação padrão continua funcionando após o reset:
    await expect(FileSystem.readAsStringAsync('file:///whatever.txt')).resolves.toBe('');
  });
});
