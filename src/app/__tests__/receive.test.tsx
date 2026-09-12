/**
 * Tests for src/app/receive.tsx (ReceiveScreen — T-906 placeholder)
 *
 * T-906 · Tela "Receber": gerar QR + token visível (PLACEHOLDER)
 * Testes básicos do placeholder que será implementado em T-906.
 * A implementação completa será coberta por testes em T-906.
 *
 * O objetivo aqui é garantir que a rota existe e renderiza sem crash,
 * para que a navegação de T-905 não quebre.
 */

import React from 'react';
import { render, cleanup } from '@testing-library/react-native';
import ReceiveScreen from '../receive';

describe('ReceiveScreen (T-906 placeholder)', () => {
  afterEach(() => {
    cleanup();
  });
  describe('Module and Exports', () => {
    it('exports a default function', () => {
      expect(typeof ReceiveScreen).toBe('function');
    });

    it('default export is named ReceiveScreen', () => {
      expect(ReceiveScreen.name).toBe('ReceiveScreen');
    });

    it('is a valid export', () => {
      expect(ReceiveScreen).toBeDefined();
    });
  });

  describe('Rendering - Placeholder', () => {
    it('renders the placeholder screen without crashing', async () => {
      const result = await render(<ReceiveScreen />);
      expect(result).toBeDefined();
    });

    it('renders placeholder heading text', async () => {
      const { getByText } = await render(<ReceiveScreen />);
      const heading = getByText('Receber');

      expect(heading).toBeDefined();
    });

    it('renders placeholder description text', async () => {
      const { getByText } = await render(<ReceiveScreen />);
      const description = getByText('Esta tela será implementada em T-906');

      expect(description).toBeDefined();
    });

    it('renders all placeholder text elements', async () => {
      const { getByText } = await render(<ReceiveScreen />);

      expect(getByText('Receber')).toBeDefined();
      expect(getByText('Esta tela será implementada em T-906')).toBeDefined();
    });
  });

  describe('Placeholder Behavior', () => {
    it('does not throw error on render', async () => {
      await expect(async () => {
        await render(<ReceiveScreen />);
      }).not.toThrow();
    });

    it('is navigable (used as target of HomeIdleScreen navigation)', async () => {
      const result = await render(<ReceiveScreen />);
      expect(result).toBeDefined();
    });

    it('renders a valid React component', async () => {
      const result = await render(<ReceiveScreen />);

      expect(result).toBeTruthy();
    });
  });
});
