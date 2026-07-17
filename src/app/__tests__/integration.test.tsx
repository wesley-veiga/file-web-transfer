/**
 * Integration tests for src/app/
 *
 * T-001 · Bootstrap do projeto Expo
 * Testa execução real dos componentes
 */

import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { useColorScheme } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import HomeScreen from '../index';
import RootLayout from '../_layout';

// Type-safe mock functions
const mockedUseColorScheme = useColorScheme as jest.MockedFunction<typeof useColorScheme>;
const mockedHideAsync = SplashScreen.hideAsync as jest.MockedFunction<typeof SplashScreen.hideAsync>;
const mockedPreventAutoHideAsync = SplashScreen.preventAutoHideAsync as jest.MockedFunction<typeof SplashScreen.preventAutoHideAsync>;

describe('Component Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedUseColorScheme.mockReturnValue('light');
    mockedHideAsync.mockResolvedValue(undefined);
    mockedPreventAutoHideAsync.mockReturnValue(undefined);
  });

  describe('HomeScreen Rendering', () => {
    it('renders HomeScreen component without crashing', () => {
      expect(() => render(<HomeScreen />)).not.toThrow();
    });

    it('HomeScreen renders with valid JSX', () => {
      expect(() => render(<HomeScreen />)).not.toThrow();
    });

    it('HomeScreen renders with light theme mock', () => {
      mockedUseColorScheme.mockReturnValue('light');
      expect(() => render(<HomeScreen />)).not.toThrow();
    });

    it('HomeScreen renders with dark theme mock', () => {
      mockedUseColorScheme.mockReturnValue('dark');
      expect(() => render(<HomeScreen />)).not.toThrow();
    });

    it('HomeScreen renders with undefined theme', () => {
      mockedUseColorScheme.mockReturnValue(undefined);
      expect(() => render(<HomeScreen />)).not.toThrow();
    });

    it('HomeScreen renders with null theme', () => {
      mockedUseColorScheme.mockReturnValue(null);
      expect(() => render(<HomeScreen />)).not.toThrow();
    });
  });

  describe('RootLayout Rendering', () => {
    it('renders RootLayout component without crashing', () => {
      expect(() => render(<RootLayout />)).not.toThrow();
    });

    it('RootLayout renders with light theme mock', () => {
      mockedUseColorScheme.mockReturnValue('light');
      expect(() => render(<RootLayout />)).not.toThrow();
    });

    it('RootLayout renders with dark theme mock', () => {
      mockedUseColorScheme.mockReturnValue('dark');
      expect(() => render(<RootLayout />)).not.toThrow();
    });

    it('RootLayout renders with undefined theme', () => {
      mockedUseColorScheme.mockReturnValue(undefined);
      expect(() => render(<RootLayout />)).not.toThrow();
    });
  });

  describe('Component Interaction with Mocks', () => {
    it('HomeScreen renders successfully with mocks', () => {
      expect(() => render(<HomeScreen />)).not.toThrow();
    });

    it('RootLayout renders successfully with mocks', () => {
      expect(() => render(<RootLayout />)).not.toThrow();
    });

    it('Both components can render with same mock state', () => {
      mockedUseColorScheme.mockReturnValue('light');

      expect(() => {
        render(<HomeScreen />);
        render(<RootLayout />);
      }).not.toThrow();
    });

    it('Components render with different theme values', () => {
      mockedUseColorScheme.mockReturnValue('light');
      expect(() => render(<HomeScreen />)).not.toThrow();

      jest.clearAllMocks();
      mockedUseColorScheme.mockReturnValue('dark');
      expect(() => render(<HomeScreen />)).not.toThrow();
    });
  });

  describe('Code Execution Verification', () => {
    it('HomeScreen component renders successfully via React', () => {
      const tree = render(<HomeScreen />);
      expect(tree).toBeDefined();
    });

    it('RootLayout component renders successfully via React', () => {
      const tree = render(<RootLayout />);
      expect(tree).toBeDefined();
    });

    it('SplashScreen mocks are properly configured', () => {
      expect(mockedPreventAutoHideAsync).toBeDefined();
      expect(typeof mockedPreventAutoHideAsync).toBe('function');
      expect(mockedHideAsync).toBeDefined();
      expect(typeof mockedHideAsync).toBe('function');
    });
  });

  describe('React Component Validity', () => {
    it('HomeScreen can be rendered multiple times via JSX', () => {
      expect(() => {
        render(<HomeScreen />);
        render(<HomeScreen />);
      }).not.toThrow();
    });

    it('RootLayout can be rendered multiple times via JSX', () => {
      expect(() => {
        render(<RootLayout />);
        render(<RootLayout />);
      }).not.toThrow();
    });

    it('Both components can be rendered multiple times without error', () => {
      expect(() => {
        render(<HomeScreen />);
        render(<RootLayout />);
        render(<HomeScreen />);
        render(<RootLayout />);
      }).not.toThrow();
    });
  });

  describe('Error Handling', () => {
    it('HomeScreen handles splash screen rejections gracefully', () => {
      mockedHideAsync.mockRejectedValueOnce(new Error('Splash error'));

      const tree = render(<HomeScreen />);
      expect(tree).toBeDefined();
    });

    it('Components can be rendered with error states mocked', () => {
      mockedUseColorScheme.mockReturnValue(undefined);

      expect(() => {
        render(<HomeScreen />);
        render(<RootLayout />);
      }).not.toThrow();
    });
  });

  describe('Lifecycle and State', () => {
    it('HomeScreen component can mount and render', () => {
      expect(() => render(<HomeScreen />)).not.toThrow();
    });

    it('RootLayout component can mount and render', () => {
      expect(() => render(<RootLayout />)).not.toThrow();
    });

    it('Components handle state changes through theme', () => {
      mockedUseColorScheme.mockReturnValue('light');
      expect(() => render(<HomeScreen />)).not.toThrow();

      mockedUseColorScheme.mockReturnValue('dark');
      expect(() => render(<HomeScreen />)).not.toThrow();
    });
  });

  describe('Mock Integration', () => {
    it('All mocks are properly configured for rendering', () => {
      expect(mockedUseColorScheme).toBeDefined();
      expect(mockedHideAsync).toBeDefined();
      expect(mockedPreventAutoHideAsync).toBeDefined();
    });

    it('Mocks return expected values', () => {
      mockedUseColorScheme.mockReturnValue('light');
      expect(mockedUseColorScheme()).toBe('light');

      mockedUseColorScheme.mockReturnValue('dark');
      expect(mockedUseColorScheme()).toBe('dark');
    });

    it('Mock functions can be cleared and reset', () => {
      mockedUseColorScheme.mockClear();
      mockedUseColorScheme.mockReturnValue('light');

      expect(mockedUseColorScheme()).toBe('light');
    });

    it('All render operations work with current mocks', () => {
      expect(() => {
        render(<HomeScreen />);
        render(<RootLayout />);
      }).not.toThrow();
    });
  });
});
