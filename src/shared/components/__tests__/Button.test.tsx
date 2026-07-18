/**
 * Tests for src/shared/components/Button.tsx
 *
 * T-005 · NativeWind + design tokens
 * Verifica renderização real com className correto via RNTL render() assíncrono
 */

import React from 'react';
import { render } from '@testing-library/react-native';
import { Button } from '../Button';

describe('Button Component', () => {
  describe('Module and Exports', () => {
    it('exports Button as a named export', () => {
      expect(typeof Button).toBe('function');
      expect(Button.name).toBe('Button');
    });

    it('Button is defined', () => {
      expect(Button).toBeDefined();
    });
  });

  describe('Rendering', () => {
    it('renders without crashing', async () => {
      const { toJSON } = await render(<Button label="Test" />);
      expect(toJSON()).toBeDefined();
    });

    it('renders with label text', async () => {
      const { toJSON } = await render(<Button label="Click Me" testID="test-btn" />);
      const tree = toJSON();
      expect(tree).toBeDefined();
      expect(tree?.children).toBeDefined();
    });

    it('renders with different labels', async () => {
      const labels = ['Submit', 'Cancel', 'Delete', 'Save'];
      for (const label of labels) {
        const { toJSON } = await render(<Button label={label} />);
        expect(toJSON()).toBeDefined();
      }
    });
  });

  describe('Variant Classes', () => {
    it('applies bg-primary class for primary variant', async () => {
      const { toJSON } = await render(<Button label="Primary" variant="primary" />);
      const tree = toJSON();
      // @ts-expect-error - accessing props from RNTL serialized tree
      const className = tree?.props?.className || '';
      expect(className).toContain('bg-primary');
    });

    it('applies bg-secondary class for secondary variant', async () => {
      const { toJSON } = await render(<Button label="Secondary" variant="secondary" />);
      const tree = toJSON();
      // @ts-expect-error - accessing props from RNTL serialized tree
      const className = tree?.props?.className || '';
      expect(className).toContain('bg-secondary');
    });

    it('applies bg-success class for success variant', async () => {
      const { toJSON } = await render(<Button label="Success" variant="success" />);
      const tree = toJSON();
      // @ts-expect-error - accessing props from RNTL serialized tree
      const className = tree?.props?.className || '';
      expect(className).toContain('bg-success');
    });

    it('applies bg-error class for error variant', async () => {
      const { toJSON } = await render(<Button label="Error" variant="error" />);
      const tree = toJSON();
      // @ts-expect-error - accessing props from RNTL serialized tree
      const className = tree?.props?.className || '';
      expect(className).toContain('bg-error');
    });

    it('uses primary variant as default', async () => {
      const { toJSON } = await render(<Button label="Default" />);
      const tree = toJSON();
      // @ts-expect-error - accessing props from RNTL serialized tree
      const className = tree?.props?.className || '';
      expect(className).toContain('bg-primary');
    });
  });

  describe('Size Classes', () => {
    it('applies px-3 py-1 text-xs for small size', async () => {
      const { toJSON } = await render(<Button label="Small" size="sm" />);
      const tree = toJSON();
      // @ts-expect-error - accessing props from RNTL serialized tree
      const className = tree?.props?.className || '';
      expect(className).toContain('px-3');
      expect(className).toContain('py-1');
      expect(className).toContain('text-xs');
    });

    it('applies px-4 py-2 text-base for medium size', async () => {
      const { toJSON } = await render(<Button label="Medium" size="md" />);
      const tree = toJSON();
      // @ts-expect-error - accessing props from RNTL serialized tree
      const className = tree?.props?.className || '';
      expect(className).toContain('px-4');
      expect(className).toContain('py-2');
      expect(className).toContain('text-base');
    });

    it('applies px-6 py-3 text-lg for large size', async () => {
      const { toJSON } = await render(<Button label="Large" size="lg" />);
      const tree = toJSON();
      // @ts-expect-error - accessing props from RNTL serialized tree
      const className = tree?.props?.className || '';
      expect(className).toContain('px-6');
      expect(className).toContain('py-3');
      expect(className).toContain('text-lg');
    });

    it('uses medium size as default', async () => {
      const { toJSON } = await render(<Button label="Default" />);
      const tree = toJSON();
      // @ts-expect-error - accessing props from RNTL serialized tree
      const className = tree?.props?.className || '';
      expect(className).toContain('px-4');
      expect(className).toContain('py-2');
    });
  });

  describe('Disabled State', () => {
    it('applies opacity-50 when disabled is true', async () => {
      const { toJSON } = await render(<Button label="Disabled" disabled={true} />);
      const tree = toJSON();
      // @ts-expect-error - accessing props from RNTL serialized tree
      const className = tree?.props?.className || '';
      expect(className).toContain('opacity-50');
    });

    it('does not apply opacity-50 when disabled is false', async () => {
      const { toJSON } = await render(<Button label="Enabled" disabled={false} />);
      const tree = toJSON();
      // @ts-expect-error - accessing props from RNTL serialized tree
      const className = tree?.props?.className || '';
      expect(className).not.toContain('opacity-50');
    });

    it('does not apply opacity-50 by default', async () => {
      const { toJSON } = await render(<Button label="Default" />);
      const tree = toJSON();
      // @ts-expect-error - accessing props from RNTL serialized tree
      const className = tree?.props?.className || '';
      expect(className).not.toContain('opacity-50');
    });
  });

  describe('Base Classes Always Present', () => {
    it('always includes rounded-md', async () => {
      const { toJSON } = await render(<Button label="Test" />);
      const tree = toJSON();
      // @ts-expect-error - accessing props from RNTL serialized tree
      const className = tree?.props?.className || '';
      expect(className).toContain('rounded-md');
    });

    it('always includes items-center and justify-center', async () => {
      const { toJSON } = await render(<Button label="Test" />);
      const tree = toJSON();
      // @ts-expect-error - accessing props from RNTL serialized tree
      const className = tree?.props?.className || '';
      expect(className).toContain('items-center');
      expect(className).toContain('justify-center');
    });

    it('always includes active:opacity-75', async () => {
      const { toJSON } = await render(<Button label="Test" />);
      const tree = toJSON();
      // @ts-expect-error - accessing props from RNTL serialized tree
      const className = tree?.props?.className || '';
      expect(className).toContain('active:opacity-75');
    });

    it('text child is white and bold', async () => {
      const { toJSON } = await render(<Button label="Test" />);
      const tree = toJSON();
      // @ts-expect-error - accessing children and props from RNTL serialized tree
      const textElement = tree?.children?.[0];
      // @ts-expect-error - accessing props from RNTL serialized tree
      const textClassName = textElement?.props?.className || '';
      expect(textClassName).toContain('text-white');
      expect(textClassName).toContain('font-bold');
    });
  });

  describe('Props Combinations', () => {
    it('combines variant, size, and disabled correctly', async () => {
      const { toJSON } = await render(
        <Button label="Complex" variant="error" size="lg" disabled={true} />,
      );
      const tree = toJSON();
      // @ts-expect-error - accessing props from RNTL serialized tree
      const className = tree?.props?.className || '';
      expect(className).toContain('bg-error');
      expect(className).toContain('px-6');
      expect(className).toContain('py-3');
      expect(className).toContain('opacity-50');
    });

    it('applies custom className when provided', async () => {
      const { toJSON } = await render(<Button label="Custom" className="custom-class" />);
      const tree = toJSON();
      // @ts-expect-error - accessing props from RNTL serialized tree
      const className = tree?.props?.className || '';
      expect(className).toContain('custom-class');
    });
  });
});
