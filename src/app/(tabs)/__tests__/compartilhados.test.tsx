/**
 * Testes de src/app/(tabs)/compartilhados.tsx — wrapper de rota (T-701).
 *
 * `SharedFilesScreen` (@/features/files/components/SharedFilesScreen) já tem
 * suíte própria e aprovada em `T-302` (ver
 * `src/features/files/components/__tests__/SharedFilesScreen.test.tsx`); este
 * arquivo cove apenas o fio de ligação entre a rota `/compartilhados`
 * (grupo `(tabs)`) e o componente de tela, sem duplicar sua lógica interna.
 *
 * T-801: CompartilhadosTab agora compõe useServerStore (via composição em src/app/)
 * e passa isServerRunning como prop para SharedFilesScreen.
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

  it('renderiza o SharedFilesScreen (T-302) passando o status do servidor (T-801)', async () => {
    await render(<CompartilhadosTab />);

    expect(mockedSharedFilesScreen).toHaveBeenCalledTimes(1);
    // Verifica que isServerRunning foi passado como prop
    const callArgs = mockedSharedFilesScreen.mock.calls[0];
    expect(callArgs[0]).toHaveProperty('isServerRunning');
    expect(typeof callArgs[0].isServerRunning).toBe('boolean');
  });
});
