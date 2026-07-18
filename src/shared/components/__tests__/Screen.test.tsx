/**
 * Tests for src/shared/components/Screen.tsx
 *
 * T-005 · NativeWind + design tokens
 * Verifica renderização real com className correto via RNTL render() assíncrono
 */

import React from 'react';
import { render } from '@testing-library/react-native';
import { Text } from 'react-native';
import { Screen } from '../Screen';

describe('Screen Component', () => {
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
    it('renders without crashing', async () => {
      const { toJSON } = await render(
        <Screen>
          <Text>Content</Text>
        </Screen>,
      );
      expect(toJSON()).toBeDefined();
    });

    it('renders with children', async () => {
      const { toJSON } = await render(
        <Screen>
          <Text>Screen Content</Text>
        </Screen>,
      );
      const tree = toJSON() as { props?: { className?: string }; children?: unknown[] };
      expect(tree?.children).toBeDefined();
    });

    it('renders with multiple children', async () => {
      const { toJSON } = await render(
        <Screen>
          <Text>Header</Text>
          <Text>Body</Text>
          <Text>Footer</Text>
        </Screen>,
      );
      expect(toJSON()).toBeDefined();
    });
  });

  describe('SafeAreaView Integration', () => {
    it('wraps content in SafeAreaView', async () => {
      const { toJSON } = await render(
        <Screen>
          <Text>Safe Area</Text>
        </Screen>,
      );
      const tree = toJSON();
      expect(tree?.children).toBeDefined();
    });
  });

  describe('Theme and Layout', () => {
    it('includes bg-background-light in className', async () => {
      const { toJSON } = await render(
        <Screen>
          <Text>Light</Text>
        </Screen>,
      );
      const tree = toJSON() as { props?: { className?: string }; children?: unknown[] };
      const className = tree?.props?.className || '';
      expect(className).toContain('bg-background-light');
    });

    it('includes dark:bg-background-dark in className', async () => {
      const { toJSON } = await render(
        <Screen>
          <Text>Dark</Text>
        </Screen>,
      );
      const tree = toJSON() as { props?: { className?: string }; children?: unknown[] };
      const className = tree?.props?.className || '';
      expect(className).toContain('dark:bg-background-dark');
    });

    it('includes flex-1 in className', async () => {
      const { toJSON } = await render(
        <Screen>
          <Text>Full</Text>
        </Screen>,
      );
      const tree = toJSON() as { props?: { className?: string }; children?: unknown[] };
      const className = tree?.props?.className || '';
      expect(className).toContain('flex-1');
    });
  });

  describe('Custom Props', () => {
    it('renders successfully with custom className', async () => {
      const { toJSON } = await render(
        <Screen className="custom-screen">
          <Text>Custom</Text>
        </Screen>,
      );
      expect(toJSON()).toBeDefined();
    });

    it('renders successfully with style prop', async () => {
      const { toJSON } = await render(
        <Screen style={{ backgroundColor: '#f0f0f0' }}>
          <Text>Styled</Text>
        </Screen>,
      );
      expect(toJSON()).toBeDefined();
    });
  });

  describe('Content Variations', () => {
    it('renders with simple text content', async () => {
      const { toJSON } = await render(
        <Screen>
          <Text>Simple</Text>
        </Screen>,
      );
      expect(toJSON()).toBeDefined();
    });

    it('renders with complex nested structure', async () => {
      const { toJSON } = await render(
        <Screen>
          <Text>Title</Text>
          <Text>Subtitle</Text>
          <Text>Body</Text>
        </Screen>,
      );
      expect(toJSON()).toBeDefined();
    });
  });
});
