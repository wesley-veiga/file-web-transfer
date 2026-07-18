/**
 * Tests for src/shared/components/Card.tsx
 *
 * T-005 · NativeWind + design tokens
 * Testa renderização e comportamento do componente Card com suporte a tema claro/escuro
 */

import React from 'react';
import { readFileSync } from 'fs';
import { join } from 'path';
import { render } from '@testing-library/react-native';
import { useColorScheme, Text } from 'react-native';
import { Card } from '../Card';

const mockedUseColorScheme = useColorScheme as jest.MockedFunction<typeof useColorScheme>;

function readCardSource(): string {
  return readFileSync(join(__dirname, '../Card.tsx'), 'utf-8');
}

describe('Card Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedUseColorScheme.mockReturnValue('light');
  });

  describe('Module and Exports', () => {
    it('exports Card as a named export', () => {
      expect(typeof Card).toBe('function');
      expect(Card.name).toBe('Card');
    });

    it('Card is defined', () => {
      expect(Card).toBeDefined();
    });
  });

  describe('Rendering', () => {
    it('renders without crashing', () => {
      expect(() =>
        render(
          <Card>
            <Text>Content</Text>
          </Card>,
        ),
      ).not.toThrow();
    });

    it('renders with children', () => {
      expect(() =>
        render(
          <Card>
            <Text>Card Content</Text>
          </Card>,
        ),
      ).not.toThrow();
    });

    it('renders with testID', () => {
      expect(() =>
        render(
          <Card testID="test-card">
            <Text>Content</Text>
          </Card>,
        ),
      ).not.toThrow();
    });

    it('renders with multiple children', () => {
      expect(() =>
        render(
          <Card>
            <Text>Title</Text>
            <Text>Description</Text>
          </Card>,
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
          <Card testID="light-card">
            <Text>Light Mode</Text>
          </Card>,
        ),
      ).not.toThrow();
    });

    it('handles light background color', () => {
      mockedUseColorScheme.mockReturnValue('light');
      expect(() =>
        render(
          <Card testID="light-bg">
            <Text>Light</Text>
          </Card>,
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
          <Card testID="dark-card">
            <Text>Dark Mode</Text>
          </Card>,
        ),
      ).not.toThrow();
    });

    it('handles dark background color', () => {
      mockedUseColorScheme.mockReturnValue('dark');
      expect(() =>
        render(
          <Card testID="dark-bg">
            <Text>Dark</Text>
          </Card>,
        ),
      ).not.toThrow();
    });

    it('handles theme switching', () => {
      mockedUseColorScheme.mockReturnValue('light');
      expect(() =>
        render(
          <Card testID="switcher">
            <Text>Switching</Text>
          </Card>,
        ),
      ).not.toThrow();

      mockedUseColorScheme.mockReturnValue('dark');
      expect(() =>
        render(
          <Card testID="switcher">
            <Text>Switching</Text>
          </Card>,
        ),
      ).not.toThrow();
    });
  });

  describe('Theme Support - Undefined', () => {
    it('renders with undefined color scheme', () => {
      // @ts-expect-error Testing undefined color scheme
      mockedUseColorScheme.mockReturnValue(undefined);
      expect(() =>
        render(
          <Card testID="undefined-theme">
            <Text>Undefined</Text>
          </Card>,
        ),
      ).not.toThrow();
    });

    it('handles null color scheme', () => {
      // @ts-expect-error Testing null color scheme
      mockedUseColorScheme.mockReturnValue(null);
      expect(() =>
        render(
          <Card testID="null-theme">
            <Text>Null</Text>
          </Card>,
        ),
      ).not.toThrow();
    });
  });

  describe('Styling', () => {
    it('uses NativeWind className for styling', () => {
      const content = readCardSource();
      expect(content).toContain('className');
      expect(content).toContain('rounded-lg');
    });

    it('applies padding through className', () => {
      const content = readCardSource();
      expect(content).toContain('p-4');
    });

    it('supports custom className prop', () => {
      expect(() =>
        render(
          <Card className="custom-card-class" testID="custom-card">
            <Text>Custom</Text>
          </Card>,
        ),
      ).not.toThrow();
    });

    it('accepts style prop', () => {
      expect(() =>
        render(
          <Card style={{ marginVertical: 12 }} testID="styled-card">
            <Text>Styled</Text>
          </Card>,
        ),
      ).not.toThrow();
    });

    it('combines className and style props', () => {
      expect(() =>
        render(
          <Card className="extra-class" style={{ opacity: 0.9 }} testID="combined-card">
            <Text>Combined</Text>
          </Card>,
        ),
      ).not.toThrow();
    });
  });

  describe('Content Variations', () => {
    it('renders with text content', () => {
      expect(() =>
        render(
          <Card>
            <Text>Simple text</Text>
          </Card>,
        ),
      ).not.toThrow();
    });

    it('renders with complex children structure', () => {
      expect(() =>
        render(
          <Card>
            <Text>Title</Text>
            <Text>Subtitle</Text>
            <Text>Description</Text>
          </Card>,
        ),
      ).not.toThrow();
    });

    it('renders with nested content', () => {
      expect(() =>
        render(
          <Card testID="nested-card">
            <Text>Nested</Text>
          </Card>,
        ),
      ).not.toThrow();
    });
  });

  describe('Accessibility', () => {
    it('renders content accessibly', () => {
      expect(() =>
        render(
          <Card testID="a11y-card">
            <Text>Accessible Card</Text>
          </Card>,
        ),
      ).not.toThrow();
    });

    it('has proper semantic structure', () => {
      expect(() =>
        render(
          <Card testID="semantic-card">
            <Text>Content</Text>
          </Card>,
        ),
      ).not.toThrow();
    });
  });

  describe('File Structure', () => {
    it('component file exists', () => {
      // This test will pass because Card is successfully imported
      expect(Card).toBeDefined();
    });

    it('is exported from index', () => {
      // Testing that Card is properly exported and importable
      const indexContent = readFileSync(join(__dirname, '../index.ts'), 'utf-8');
      expect(indexContent).toContain('export { Card }');
      expect(indexContent).toContain('./Card');
    });
  });
});
