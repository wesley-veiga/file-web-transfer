/**
 * Testes de src/app/(tabs)/transferencias.tsx — wrapper de rota (T-701).
 *
 * `TransferListScreen` (@/features/transfer/components) já tem suíte própria
 * e aprovada em `T-603` (ver `src/features/transfer/components/__tests__/TransferListScreen.test.tsx`);
 * este arquivo cobre apenas o fio de ligação entre a rota `/transferencias`
 * (grupo `(tabs)`) e o componente de tela, sem duplicar sua lógica interna.
 */

import React from 'react';
import { render } from '@testing-library/react-native';
import TransferenciasTab from '../transferencias';
import { TransferListScreen } from '@/features/transfer/components';

jest.mock('@/features/transfer/components', () => ({
  TransferListScreen: jest.fn(() => null),
}));

const mockedTransferListScreen = TransferListScreen as jest.MockedFunction<
  typeof TransferListScreen
>;

describe('TransferenciasTab ((tabs)/transferencias.tsx)', () => {
  beforeEach(() => {
    mockedTransferListScreen.mockClear();
  });

  it('exporta uma função default nomeada TransferenciasTab', () => {
    expect(typeof TransferenciasTab).toBe('function');
    expect(TransferenciasTab.name).toBe('TransferenciasTab');
  });

  it('renderiza sem lançar erro', async () => {
    await expect(render(<TransferenciasTab />)).resolves.toBeDefined();
  });

  it('renderiza o TransferListScreen (T-603) sem props extras', async () => {
    await render(<TransferenciasTab />);

    expect(mockedTransferListScreen).toHaveBeenCalledTimes(1);
    expect(mockedTransferListScreen).toHaveBeenCalledWith({}, undefined);
  });
});
