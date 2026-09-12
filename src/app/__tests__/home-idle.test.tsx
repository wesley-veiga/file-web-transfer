/**
 * Tests for src/app/index.tsx (HomeIdleScreen — T-905)
 *
 * T-905 · Tela inicial (Home idle)
 * Verifica título, texto de apoio e navegação do botão "Receber arquivo"
 */

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
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

  describe('Rendering - HU-10 acceptance criteria', () => {
    it('renders without crashing', async () => {
      const { toJSON } = await render(<HomeIdleScreen />);
      expect(toJSON()).toBeDefined();
    });

    it('renders the title "Transfer Files"', async () => {
      const { toJSON } = await render(<HomeIdleScreen />);
      const tree = toJSON();
      const json = JSON.stringify(tree);
      expect(json).toContain('Transfer Files');
    });

    it('renders the support text', async () => {
      const { toJSON } = await render(<HomeIdleScreen />);
      const tree = toJSON();
      const json = JSON.stringify(tree);
      expect(json).toContain('Para compartilhar');
      expect(json).toContain('navegue até um arquivo');
      expect(json).toContain('selecione este aplicativo como destino');
    });

    it('renders the "Receber arquivo" button', async () => {
      const { toJSON } = await render(<HomeIdleScreen />);
      const tree = toJSON();
      const json = JSON.stringify(tree);
      expect(json).toContain('Receber arquivo');
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
  });

  describe('Button styling', () => {
    it('button has primary variant (blue color)', async () => {
      const { toJSON } = await render(<HomeIdleScreen />);
      const tree = toJSON();
      const json = JSON.stringify(tree);
      expect(json).toContain('primary');
    });

    it('button has large size', async () => {
      const { toJSON } = await render(<HomeIdleScreen />);
      const tree = toJSON();
      const json = JSON.stringify(tree);
      // Check for size-lg classes or similar
      expect(json).toContain('lg');
    });
  });
});
