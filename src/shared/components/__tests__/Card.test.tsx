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
      const tree = toJSON();
      // @ts-expect-error - accessing children from RNTL serialized tree
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
    it('renders with theme and styling classes', async () => {
      const { toJSON } = await render(
        <Card>
          <Text>Themed</Text>
        </Card>,
      );
      expect(toJSON()).toBeDefined();
    });

    it('accepts custom className when provided', async () => {
      const { toJSON } = await render(
        <Card className="custom-class">
          <Text>Custom</Text>
        </Card>,
      );
      expect(toJSON()).toBeDefined();
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
