/**
 * Tests for src/shared/components/Card.tsx
 *
 * T-005 · NativeWind + design tokens
 * Verifica renderização real com className correto via RNTL render() assíncrono
 */

import React from 'react';
import { render } from '@testing-library/react-native';
import { Text } from 'react-native';
import { Card } from '../Card';

describe('Card Component', () => {
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
    it('renders without crashing', async () => {
      const { toJSON } = await render(
        <Card>
          <Text>Content</Text>
        </Card>,
      );
      expect(toJSON()).toBeDefined();
    });

    it('renders with children', async () => {
      const { toJSON } = await render(
        <Card>
          <Text>Card Content</Text>
        </Card>,
      );
      const tree = toJSON() as { props?: { className?: string }; children?: unknown[] };
      expect(tree?.children).toBeDefined();
    });

    it('renders with multiple children', async () => {
      const { toJSON } = await render(
        <Card>
          <Text>Title</Text>
          <Text>Description</Text>
        </Card>,
      );
      expect(toJSON()).toBeDefined();
    });
  });

  describe('Styling and Props', () => {
    it('includes bg-surface-light in className', async () => {
      const { toJSON } = await render(
        <Card>
          <Text>Themed</Text>
        </Card>,
      );
      const tree = toJSON() as { props?: { className?: string }; children?: unknown[] };
      const className = tree?.props?.className || '';
      expect(className).toContain('bg-surface-light');
    });

    it('includes dark:bg-surface-dark in className', async () => {
      const { toJSON } = await render(
        <Card>
          <Text>Dark</Text>
        </Card>,
      );
      const tree = toJSON() as { props?: { className?: string }; children?: unknown[] };
      const className = tree?.props?.className || '';
      expect(className).toContain('dark:bg-surface-dark');
    });

    it('includes rounded-lg in className', async () => {
      const { toJSON } = await render(
        <Card>
          <Text>Rounded</Text>
        </Card>,
      );
      const tree = toJSON() as { props?: { className?: string }; children?: unknown[] };
      const className = tree?.props?.className || '';
      expect(className).toContain('rounded-lg');
    });

    it('includes p-4 in className', async () => {
      const { toJSON } = await render(
        <Card>
          <Text>Padded</Text>
        </Card>,
      );
      const tree = toJSON() as { props?: { className?: string }; children?: unknown[] };
      const className = tree?.props?.className || '';
      expect(className).toContain('p-4');
    });

    it('accepts custom className when provided', async () => {
      const { toJSON } = await render(
        <Card className="custom-class">
          <Text>Custom</Text>
        </Card>,
      );
      const tree = toJSON() as { props?: { className?: string }; children?: unknown[] };
      const className = tree?.props?.className || '';
      expect(className).toContain('custom-class');
    });

    it('accepts testID prop', async () => {
      const { toJSON } = await render(
        <Card testID="my-card">
          <Text>With ID</Text>
        </Card>,
      );
      expect(toJSON()).toBeDefined();
    });

    it('accepts style prop', async () => {
      const { toJSON } = await render(
        <Card style={{ marginVertical: 12 }}>
          <Text>Styled</Text>
        </Card>,
      );
      expect(toJSON()).toBeDefined();
    });
  });

  describe('Content Variations', () => {
    it('renders with text content', async () => {
      const { toJSON } = await render(
        <Card>
          <Text>Simple text</Text>
        </Card>,
      );
      expect(toJSON()).toBeDefined();
    });

    it('renders with complex children structure', async () => {
      const { toJSON } = await render(
        <Card>
          <Text>Title</Text>
          <Text>Subtitle</Text>
          <Text>Description</Text>
        </Card>,
      );
      expect(toJSON()).toBeDefined();
    });
  });
});
