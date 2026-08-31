/**
 * Testes de src/app/(tabs)/recebidos.tsx — wrapper de rota (T-701).
 *
 * `ReceivedFilesScreen` (@/features/files/components/ReceivedFilesScreen) já
 * tem suíte própria e aprovada em `T-303` (ver
 * `src/features/files/components/__tests__/ReceivedFilesScreen.test.tsx`);
 * este arquivo cobre apenas o fio de ligação entre a rota `/recebidos`
 * (grupo `(tabs)`) e o componente de tela, sem duplicar sua lógica interna.
 */

import React from 'react';
import { render } from '@testing-library/react-native';
import RecebidosTab from '../recebidos';
import { ReceivedFilesScreen } from '@/features/files/components/ReceivedFilesScreen';

jest.mock('@/features/files/components/ReceivedFilesScreen', () => ({
  ReceivedFilesScreen: jest.fn(() => null),
}));

const mockedReceivedFilesScreen = ReceivedFilesScreen as jest.MockedFunction<
  typeof ReceivedFilesScreen
>;

describe('RecebidosTab ((tabs)/recebidos.tsx)', () => {
  beforeEach(() => {
    mockedReceivedFilesScreen.mockClear();
  });

  it('exporta uma função default nomeada RecebidosTab', () => {
    expect(typeof RecebidosTab).toBe('function');
    expect(RecebidosTab.name).toBe('RecebidosTab');
  });

  it('renderiza sem lançar erro', async () => {
    await expect(render(<RecebidosTab />)).resolves.toBeDefined();
  });

  it('renderiza o ReceivedFilesScreen (T-303) sem props extras', async () => {
    await render(<RecebidosTab />);

    expect(mockedReceivedFilesScreen).toHaveBeenCalledTimes(1);
    expect(mockedReceivedFilesScreen).toHaveBeenCalledWith({}, undefined);
  });
});
