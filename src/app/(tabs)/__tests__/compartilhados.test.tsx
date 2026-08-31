/**
 * Testes de src/app/(tabs)/compartilhados.tsx — wrapper de rota (T-701).
 *
 * `SharedFilesScreen` (@/features/files/components/SharedFilesScreen) já tem
 * suíte própria e aprovada em `T-302` (ver
 * `src/features/files/components/__tests__/SharedFilesScreen.test.tsx`); este
 * arquivo cobre apenas o fio de ligação entre a rota `/compartilhados`
 * (grupo `(tabs)`) e o componente de tela, sem duplicar sua lógica interna.
 */

import React from 'react';
import { render } from '@testing-library/react-native';
import CompartilhadosTab from '../compartilhados';
import { SharedFilesScreen } from '@/features/files/components/SharedFilesScreen';

jest.mock('@/features/files/components/SharedFilesScreen', () => ({
  SharedFilesScreen: jest.fn(() => null),
}));

const mockedSharedFilesScreen = SharedFilesScreen as jest.MockedFunction<typeof SharedFilesScreen>;

describe('CompartilhadosTab ((tabs)/compartilhados.tsx)', () => {
  beforeEach(() => {
    mockedSharedFilesScreen.mockClear();
  });

  it('exporta uma função default nomeada CompartilhadosTab', () => {
    expect(typeof CompartilhadosTab).toBe('function');
    expect(CompartilhadosTab.name).toBe('CompartilhadosTab');
  });

  it('renderiza sem lançar erro', async () => {
    await expect(render(<CompartilhadosTab />)).resolves.toBeDefined();
  });

  it('renderiza o SharedFilesScreen (T-302) sem props extras', async () => {
    await render(<CompartilhadosTab />);

    expect(mockedSharedFilesScreen).toHaveBeenCalledTimes(1);
    expect(mockedSharedFilesScreen).toHaveBeenCalledWith({}, undefined);
  });
});
