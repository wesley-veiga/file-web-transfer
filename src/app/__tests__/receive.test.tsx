/**
 * Tests for src/app/receive.tsx (ReceiveScreen — T-906 placeholder)
 *
 * T-906 · Tela "Receber": gerar QR + token visível (PLACEHOLDER)
 * Testes básicos do placeholder que será implementado em T-906.
 * Testes completos da implementação serão adicionados em T-906.
 */

import React from 'react';
import { render } from '@testing-library/react-native';
import ReceiveScreen from '../receive';

describe('ReceiveScreen (T-906 placeholder)', () => {
  describe('Module and Exports', () => {
    it('exports a default function', () => {
      expect(typeof ReceiveScreen).toBe('function');
    });

    it('default export is named ReceiveScreen', () => {
      expect(ReceiveScreen.name).toBe('ReceiveScreen');
    });
  });

  describe('Rendering - Placeholder', () => {
    it('renders the placeholder screen without crashing', async () => {
      const { toJSON } = await render(<ReceiveScreen />);
      expect(toJSON()).toBeDefined();
    });

    it('renders the placeholder text', async () => {
      const { toJSON } = await render(<ReceiveScreen />);
      const tree = toJSON();
      const json = JSON.stringify(tree);
      expect(json).toContain('Receber');
      expect(json).toContain('Esta tela será implementada em T-906');
    });
  });
});
