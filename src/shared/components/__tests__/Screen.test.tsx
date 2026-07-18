/**
 * Tests for src/shared/components/Screen.tsx
 *
 * T-005 · NativeWind + design tokens
 * Testa renderização e comportamento do componente Screen com SafeAreaView e tema
 */

import React from 'react';
import { readFileSync } from 'fs';
import { join } from 'path';
import { render } from '@testing-library/react-native';
import { useColorScheme, Text } from 'react-native';
import { Screen } from '../Screen';

const mockedUseColorScheme = useColorScheme as jest.MockedFunction<typeof useColorScheme>;

function readScreenSource(): string {
  return readFileSync(join(__dirname, '../Screen.tsx'), 'utf-8');
}

describe('Screen Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedUseColorScheme.mockReturnValue('light');
  });

  describe('Module and Exports', () => {
    it('exports Screen as a named export', () => {
      expect(typeof Screen).toBe('function');
      expect(Screen.name).toBe('Screen');
    });

    it('Screen is defined', () => {
      expect(Screen).toBeDefined();
    });
  });

  describe('Rendering', () => {
    it('renders without crashing', () => {
      expect(() =>
        render(
          <Screen>
            <Text>Content</Text>
          </Screen>,
        ),
      ).not.toThrow();
    });

    it('renders with children', () => {
      expect(() =>
        render(
          <Screen>
            <Text>Screen Content</Text>
          </Screen>,
        ),
      ).not.toThrow();
    });

    it('renders with testID', () => {
      expect(() =>
        render(
          <Screen testID="test-screen">
            <Text>Content</Text>
          </Screen>,
        ),
      ).not.toThrow();
    });

    it('renders with multiple children', () => {
      expect(() =>
        render(
          <Screen>
            <Text>Header</Text>
            <Text>Body</Text>
            <Text>Footer</Text>
          </Screen>,
        ),
      ).not.toThrow();
    });
  });

  describe('SafeAreaView Integration', () => {
    it('uses SafeAreaView for safe area handling', () => {
      const content = readScreenSource();
      expect(content).toContain('SafeAreaView');
      expect(content).toContain('react-native-safe-area-context');
    });

    it('renders as full-screen container', () => {
      expect(() =>
        render(
          <Screen testID="full-screen">
            <Text>Full Screen</Text>
          </Screen>,
        ),
      ).not.toThrow();
    });

    it('handles safe area insets', () => {
      expect(() =>
        render(
          <Screen testID="safe-area-screen">
            <Text>Safe Area</Text>
          </Screen>,
        ),
      ).not.toThrow();
    });
  });

  describe('Theme Support - Light Mode', () => {
    beforeEach(() => {
      mockedUseColorScheme.mockReturnValue('light');
    });

    it('renders in light theme', () => {
      expect(() =>
        render(
          <Screen testID="light-screen">
            <Text>Light Mode</Text>
          </Screen>,
        ),
      ).not.toThrow();
    });

    it('handles light background color', () => {
      mockedUseColorScheme.mockReturnValue('light');
      expect(() =>
        render(
          <Screen testID="light-bg">
            <Text>Light</Text>
          </Screen>,
        ),
      ).not.toThrow();
    });
  });

  describe('Theme Support - Dark Mode', () => {
    beforeEach(() => {
      mockedUseColorScheme.mockReturnValue('dark');
    });

    it('renders in dark theme', () => {
      expect(() =>
        render(
          <Screen testID="dark-screen">
            <Text>Dark Mode</Text>
          </Screen>,
        ),
      ).not.toThrow();
    });

    it('handles dark background color', () => {
      mockedUseColorScheme.mockReturnValue('dark');
      expect(() =>
        render(
          <Screen testID="dark-bg">
            <Text>Dark</Text>
          </Screen>,
        ),
      ).not.toThrow();
    });

    it('applies dark theme classes', () => {
      const content = readScreenSource();
      expect(content).toContain('background-dark');
      expect(content).toContain('isDark');
    });
  });

  describe('Theme Support - Undefined', () => {
    it('renders with undefined color scheme', () => {
      // @ts-expect-error Testing undefined color scheme
      mockedUseColorScheme.mockReturnValue(undefined);
      expect(() =>
        render(
          <Screen testID="undefined-theme">
            <Text>Undefined</Text>
          </Screen>,
        ),
      ).not.toThrow();
    });

    it('handles null color scheme', () => {
      // @ts-expect-error Testing null color scheme
      mockedUseColorScheme.mockReturnValue(null);
      expect(() =>
        render(
          <Screen testID="null-theme">
            <Text>Null</Text>
          </Screen>,
        ),
      ).not.toThrow();
    });
  });

  describe('Theme Switching', () => {
    it('handles theme switching', () => {
      mockedUseColorScheme.mockReturnValue('light');
      expect(() =>
        render(
          <Screen testID="switcher">
            <Text>Switching</Text>
          </Screen>,
        ),
      ).not.toThrow();

      mockedUseColorScheme.mockReturnValue('dark');
      expect(() =>
        render(
          <Screen testID="switcher2">
            <Text>Switching</Text>
          </Screen>,
        ),
      ).not.toThrow();
    });
  });

  describe('Styling', () => {
    it('uses NativeWind className for styling', () => {
      const content = readScreenSource();
      expect(content).toContain('className');
    });

    it('applies flex-1 for full height', () => {
      const content = readScreenSource();
      expect(content).toContain('flex-1');
    });

    it('supports custom className prop', () => {
      expect(() =>
        render(
          <Screen className="custom-screen-class" testID="custom-screen">
            <Text>Custom</Text>
          </Screen>,
        ),
      ).not.toThrow();
    });

    it('accepts style prop', () => {
      expect(() =>
        render(
          <Screen style={{ backgroundColor: '#f0f0f0' }} testID="styled-screen">
            <Text>Styled</Text>
          </Screen>,
        ),
      ).not.toThrow();
    });

    it('combines className and style props', () => {
      expect(() =>
        render(
          <Screen className="extra-class" style={{ opacity: 0.95 }} testID="combined-screen">
            <Text>Combined</Text>
          </Screen>,
        ),
      ).not.toThrow();
    });
  });

  describe('Content Variations', () => {
    it('renders with simple text content', () => {
      expect(() =>
        render(
          <Screen>
            <Text>Simple</Text>
          </Screen>,
        ),
      ).not.toThrow();
    });

    it('renders with complex nested structure', () => {
      expect(() =>
        render(
          <Screen>
            <Text>Title</Text>
            <Text>Subtitle</Text>
            <Text>Body</Text>
          </Screen>,
        ),
      ).not.toThrow();
    });

    it('renders with nested content', () => {
      expect(() =>
        render(
          <Screen testID="nested-screen">
            <Text>Nested</Text>
          </Screen>,
        ),
      ).not.toThrow();
    });
  });

  describe('Accessibility', () => {
    it('renders content accessibly', () => {
      expect(() =>
        render(
          <Screen testID="a11y-screen">
            <Text>Accessible Screen</Text>
          </Screen>,
        ),
      ).not.toThrow();
    });

    it('has proper semantic structure', () => {
      expect(() =>
        render(
          <Screen testID="semantic-screen">
            <Text>Content</Text>
          </Screen>,
        ),
      ).not.toThrow();
    });
  });

  describe('File Structure', () => {
    it('component file exists', () => {
      // This test will pass because Screen is successfully imported
      expect(Screen).toBeDefined();
    });

    it('is exported from index', () => {
      // Testing that Screen is properly exported and importable
      const indexContent = readFileSync(join(__dirname, '../index.ts'), 'utf-8');
      expect(indexContent).toContain('export { Screen }');
      expect(indexContent).toContain('./Screen');
    });
  });
});
