/**
 * Smoke tests for ServerHomeScreen component (T-204)
 *
 * Testa os estados principais e comportamento básico da tela Home/Servidor
 */

import React from 'react';
import { render } from '@testing-library/react-native';
import { ServerHomeScreen } from '../ServerHomeScreen';

describe('ServerHomeScreen (T-204)', () => {
  describe('Rendering', () => {
    it('renders without crashing', () => {
      expect(() => render(<ServerHomeScreen />)).not.toThrow();
    });

    it('renders with onCreateNetworkPress prop', () => {
      const mockHandler = jest.fn();
      expect(() => render(<ServerHomeScreen onCreateNetworkPress={mockHandler} />)).not.toThrow();
    });

    it('renders with httpModule prop (for testing)', () => {
      const mockHttpModule = {
        start: jest.fn(),
        stop: jest.fn(),
        isRunning: jest.fn(() => false),
      };
      expect(() => render(<ServerHomeScreen httpModule={mockHttpModule} />)).not.toThrow();
    });
  });

  describe('Component Structure', () => {
    it('renders without errors', () => {
      expect(() => render(<ServerHomeScreen />)).not.toThrow();
    });
  });

  describe('Props Handling', () => {
    it('handles undefined onCreateNetworkPress', () => {
      expect(() => render(<ServerHomeScreen onCreateNetworkPress={undefined} />)).not.toThrow();
    });

    it('handles null onCreateNetworkPress', () => {
      const nullHandler = null as unknown as () => void;
      expect(() => render(<ServerHomeScreen onCreateNetworkPress={nullHandler} />)).not.toThrow();
    });

    it('handles function onCreateNetworkPress', () => {
      const mockFn = jest.fn();
      expect(() => render(<ServerHomeScreen onCreateNetworkPress={mockFn} />)).not.toThrow();
    });
  });
});
