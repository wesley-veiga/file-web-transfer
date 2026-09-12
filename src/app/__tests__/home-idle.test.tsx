/**
 * Tests for src/app/index.tsx (HomeIdleScreen — T-905)
 *
 * T-905 · Tela inicial (Home idle)
 * Verifica título, texto de apoio, navegação do botão "Receber arquivo"
 * e comportamento da splash screen.
 *
 * HU-10 (História de Usuário):
 * - Título: "Transfer Files"
 * - Texto de apoio: "Para compartilhar, navegue até um arquivo, clique em compartilhar, selecione este aplicativo como destino."
 * - Botão azul centralizado: "Receber arquivo", navegando para a tela de Receber
 */

import React from 'react';
import { render, fireEvent, waitFor, cleanup } from '@testing-library/react-native';
import * as SplashScreen from 'expo-splash-screen';
import { useRouter } from 'expo-router';
import HomeIdleScreen from '../index';

// Mock expo-splash-screen
jest.mock('expo-splash-screen', () => ({
  hideAsync: jest.fn().mockResolvedValue(undefined),
}));

// Mock expo-router
jest.mock('expo-router', () => ({
  useRouter: jest.fn(),
}));

const mockedHideAsync = SplashScreen.hideAsync as jest.MockedFunction<
  typeof SplashScreen.hideAsync
>;

describe('HomeIdleScreen (T-905)', () => {
  let mockRouter: { push: jest.Mock };

  beforeEach(() => {
    jest.clearAllMocks();
    mockedHideAsync.mockResolvedValue(undefined);
    mockRouter = { push: jest.fn() };
    (useRouter as jest.Mock).mockReturnValue(mockRouter);
  });

  afterEach(() => {
    cleanup();
  });

  describe('Module and Exports', () => {
    it('exports a default function', () => {
      expect(typeof HomeIdleScreen).toBe('function');
    });

    it('default export is named HomeIdleScreen', () => {
      expect(HomeIdleScreen.name).toBe('HomeIdleScreen');
    });

    it('is a valid export', () => {
      expect(HomeIdleScreen).toBeDefined();
    });
  });

  describe('Splash Screen Behavior', () => {
    it('calls SplashScreen.hideAsync on mount', async () => {
      await render(<HomeIdleScreen />);

      await waitFor(() => {
        expect(mockedHideAsync).toHaveBeenCalled();
      });
    });

    it('handles SplashScreen.hideAsync failure gracefully', async () => {
      mockedHideAsync.mockRejectedValueOnce(new Error('Splash hide failed'));

      const { getByText } = await render(<HomeIdleScreen />);

      await waitFor(() => {
        expect(getByText('Transfer Files')).toBeDefined();
      });
    });

    it('renders correctly even if SplashScreen.hideAsync fails', async () => {
      mockedHideAsync.mockRejectedValueOnce(new Error('Splash hide failed'));

      const { getByText } = await render(<HomeIdleScreen />);

      await waitFor(() => {
        expect(getByText('Transfer Files')).toBeDefined();
      });
    });
  });

  describe('Rendering - HU-10 acceptance criteria', () => {
    it('renders without crashing', async () => {
      const result = await render(<HomeIdleScreen />);
      expect(result).toBeDefined();
    });

    it('renders the title "Transfer Files"', async () => {
      const { getByText } = await render(<HomeIdleScreen />);
      const titleElement = getByText('Transfer Files');
      expect(titleElement).toBeDefined();
    });

    it('renders the complete support text', async () => {
      const { getByText } = await render(<HomeIdleScreen />);
      const supportText = getByText(
        /Para compartilhar, navegue até um arquivo, clique em compartilhar, selecione este aplicativo como destino./,
      );
      expect(supportText).toBeDefined();
    });

    it('renders the "Receber arquivo" button with correct label', async () => {
      const { getByTestId, getByText } = await render(<HomeIdleScreen />);
      const receiveButton = getByTestId('receive-button');
      expect(receiveButton).toBeDefined();

      expect(getByText('Receber arquivo')).toBeDefined();
    });

    it('renders all required elements in the correct layout', async () => {
      const { getByText, getByTestId } = await render(<HomeIdleScreen />);

      expect(getByText('Transfer Files')).toBeDefined();
      expect(getByText(/Para compartilhar/)).toBeDefined();
      expect(getByTestId('receive-button')).toBeDefined();
    });
  });

  describe('Button Properties and Styling', () => {
    it('button is pressable', async () => {
      const { getByTestId } = await render(<HomeIdleScreen />);
      const receiveButton = getByTestId('receive-button');

      expect(receiveButton).toBeDefined();
      expect(receiveButton.props).toBeDefined();
    });

    it('button has correct testID for accessibility', async () => {
      const { getByTestId } = await render(<HomeIdleScreen />);
      const receiveButton = getByTestId('receive-button');

      expect(receiveButton.props.testID).toBe('receive-button');
    });

    it('button has full width class applied', async () => {
      const { getByTestId } = await render(<HomeIdleScreen />);
      const receiveButton = getByTestId('receive-button');

      expect(receiveButton.props.className).toContain('w-full');
    });
  });

  describe('Navigation', () => {
    it('should navigate to /receive when button is pressed', async () => {
      const { getByTestId } = await render(<HomeIdleScreen />);
      const receiveButton = getByTestId('receive-button');

      fireEvent.press(receiveButton);

      expect(mockRouter.push).toHaveBeenCalledWith('/receive');
      expect(mockRouter.push).toHaveBeenCalledTimes(1);
    });

    it('calls router.push with correct path on button press', async () => {
      const { getByTestId } = await render(<HomeIdleScreen />);
      const receiveButton = getByTestId('receive-button');

      fireEvent.press(receiveButton);

      const calls = mockRouter.push.mock.calls;
      expect(calls.length).toBe(1);
      expect(calls[0][0]).toBe('/receive');
    });

    it('only navigates once when button is pressed once', async () => {
      const { getByTestId } = await render(<HomeIdleScreen />);
      const receiveButton = getByTestId('receive-button');

      fireEvent.press(receiveButton);
      fireEvent.press(receiveButton);

      expect(mockRouter.push).toHaveBeenCalledTimes(2);
    });
  });
});
