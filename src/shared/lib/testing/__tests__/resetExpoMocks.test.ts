/**
 * Testes aprofundados de `resetExpoMocks` (T-003 · Infra de testes).
 *
 * `src/shared/lib/__tests__/example.test.ts` já cobre o caminho feliz básico (reset após uma
 * chamada). Este arquivo cobre casos de borda adicionais: reset sem nenhuma chamada prévia,
 * reset de múltiplos mocks simultaneamente, preservação de overrides configurados com
 * `mockResolvedValueOnce`/`mockImplementationOnce`, e chamadas repetidas de `resetExpoMocks`.
 */
import * as FileSystem from 'expo-file-system';
import * as Network from 'expo-network';

import { resetExpoMocks } from '../resetExpoMocks';

describe('resetExpoMocks — casos de borda', () => {
  it('não lança e não altera nada quando chamado sem nenhuma chamada prévia registrada', () => {
    expect(FileSystem.getInfoAsync).toHaveBeenCalledTimes(0);
    expect(Network.getIpAddressAsync).toHaveBeenCalledTimes(0);

    expect(() => resetExpoMocks()).not.toThrow();

    expect(FileSystem.getInfoAsync).toHaveBeenCalledTimes(0);
    expect(Network.getIpAddressAsync).toHaveBeenCalledTimes(0);
  });

  it('chamado duas vezes seguidas (idempotente) não lança e mantém as contagens zeradas', () => {
    resetExpoMocks();
    resetExpoMocks();

    expect(FileSystem.writeAsStringAsync).toHaveBeenCalledTimes(0);
  });

  it('reseta simultaneamente múltiplos mocks de expo-file-system e expo-network que foram chamados', async () => {
    await FileSystem.writeAsStringAsync('file:///a.txt', 'x');
    await FileSystem.getInfoAsync('file:///a.txt');
    await FileSystem.deleteAsync('file:///a.txt');
    await Network.getNetworkStateAsync();
    await Network.getIpAddressAsync();

    expect(FileSystem.writeAsStringAsync).toHaveBeenCalledTimes(1);
    expect(FileSystem.getInfoAsync).toHaveBeenCalledTimes(1);
    expect(FileSystem.deleteAsync).toHaveBeenCalledTimes(1);
    expect(Network.getNetworkStateAsync).toHaveBeenCalledTimes(1);
    expect(Network.getIpAddressAsync).toHaveBeenCalledTimes(1);

    resetExpoMocks();

    expect(FileSystem.writeAsStringAsync).toHaveBeenCalledTimes(0);
    expect(FileSystem.getInfoAsync).toHaveBeenCalledTimes(0);
    expect(FileSystem.deleteAsync).toHaveBeenCalledTimes(0);
    expect(Network.getNetworkStateAsync).toHaveBeenCalledTimes(0);
    expect(Network.getIpAddressAsync).toHaveBeenCalledTimes(0);
  });

  it('reseta mocks que ainda não têm resultado pendente (funções síncronas como addNetworkStateListener/useNetworkState)', () => {
    Network.addNetworkStateListener(() => {});
    Network.useNetworkState();

    expect(Network.addNetworkStateListener).toHaveBeenCalledTimes(1);
    expect(Network.useNetworkState).toHaveBeenCalledTimes(1);

    resetExpoMocks();

    expect(Network.addNetworkStateListener).toHaveBeenCalledTimes(0);
    expect(Network.useNetworkState).toHaveBeenCalledTimes(0);
  });

  it('não remove overrides de implementação configurados com mockResolvedValueOnce antes do reset', async () => {
    (FileSystem.readAsStringAsync as jest.Mock).mockResolvedValueOnce('conteudo customizado');

    resetExpoMocks();

    // mockClear() limpa apenas mock.calls/mock.results, não a fila de mockResolvedValueOnce —
    // o valor customizado configurado antes do reset ainda deve ser consumido na próxima chamada.
    await expect(FileSystem.readAsStringAsync('file:///qualquer.txt')).resolves.toBe(
      'conteudo customizado'
    );
  });

  it('reseta corretamente após uma rejeição registrada em um mock (mockRejectedValueOnce)', async () => {
    (FileSystem.getInfoAsync as jest.Mock).mockRejectedValueOnce(new Error('falha simulada'));

    await expect(FileSystem.getInfoAsync('file:///a.txt')).rejects.toThrow('falha simulada');
    expect(FileSystem.getInfoAsync).toHaveBeenCalledTimes(1);

    resetExpoMocks();

    expect(FileSystem.getInfoAsync).toHaveBeenCalledTimes(0);
    // Implementação padrão (não a rejeição, que já foi consumida) volta a valer:
    await expect(FileSystem.getInfoAsync('file:///a.txt')).resolves.toMatchObject({
      exists: true,
    });
  });
});
