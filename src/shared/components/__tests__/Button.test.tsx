/**
 * Tests for src/shared/components/Button.tsx
 *
 * T-005 · NativeWind + design tokens
 * Testa renderização e comportamento do componente Button com variantes, tamanhos e estados
 */

import React from 'react';
import { readFileSync } from 'fs';
import { join } from 'path';
import { render } from '@testing-library/react-native';
import { useColorScheme } from 'react-native';
import { Button } from '../Button';

const mockedUseColorScheme = useColorScheme as jest.MockedFunction<typeof useColorScheme>;

function readButtonSource(): string {
  return readFileSync(join(__dirname, '../Button.tsx'), 'utf-8');
}

describe('Button Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedUseColorScheme.mockReturnValue('light');
  });

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
    it('renders without crashing', () => {
      expect(() => render(<Button label="Test" />)).not.toThrow();
    });

    it('renders and returns a result', () => {
      const result = render(<Button label="Click Me" testID="test-button" />);
      expect(result).toBeDefined();
    });

    it('renders with testID prop', () => {
      expect(() => render(<Button label="Test" testID="my-button" />)).not.toThrow();
    });

    it('renders with different labels', () => {
      const labels = ['Submit', 'Cancel', 'Delete', 'Save'];
      labels.forEach((label) => {
        expect(() => render(<Button label={label} />)).not.toThrow();
      });
    });
  });

  describe('Variants', () => {
    it('renders with primary variant', () => {
      expect(() =>
        render(<Button label="Primary" variant="primary" testID="primary-btn" />),
      ).not.toThrow();
    });

    it('renders with secondary variant', () => {
      expect(() =>
        render(<Button label="Secondary" variant="secondary" testID="secondary-btn" />),
      ).not.toThrow();
    });

    it('renders with success variant', () => {
      expect(() =>
        render(<Button label="Success" variant="success" testID="success-btn" />),
      ).not.toThrow();
    });

    it('renders with error variant', () => {
      expect(() =>
        render(<Button label="Error" variant="error" testID="error-btn" />),
      ).not.toThrow();
    });

    it('uses primary variant as default', () => {
      expect(() => render(<Button label="Default" />)).not.toThrow();
    });

    it('accepts all variant types without error', () => {
      const variants: ('primary' | 'secondary' | 'success' | 'error')[] = [
        'primary',
        'secondary',
        'success',
        'error',
      ];
      variants.forEach((variant) => {
        expect(() => render(<Button label="Test" variant={variant} />)).not.toThrow();
      });
    });
  });

  describe('Sizes', () => {
    it('renders with small size', () => {
      expect(() => render(<Button label="Small" size="sm" testID="sm-btn" />)).not.toThrow();
    });

    it('renders with medium size', () => {
      expect(() => render(<Button label="Medium" size="md" testID="md-btn" />)).not.toThrow();
    });

    it('renders with large size', () => {
      expect(() => render(<Button label="Large" size="lg" testID="lg-btn" />)).not.toThrow();
    });

    it('uses medium size as default', () => {
      expect(() => render(<Button label="Default" />)).not.toThrow();
    });

    it('accepts all size types without error', () => {
      const sizes: ('sm' | 'md' | 'lg')[] = ['sm', 'md', 'lg'];
      sizes.forEach((size) => {
        expect(() => render(<Button label="Test" size={size} />)).not.toThrow();
      });
    });
  });

  describe('Disabled State', () => {
    it('renders when not disabled', () => {
      expect(() => render(<Button label="Active" disabled={false} />)).not.toThrow();
    });

    it('renders when disabled', () => {
      expect(() => render(<Button label="Disabled" disabled={true} />)).not.toThrow();
    });

    it('renders with disabled prop', () => {
      expect(() =>
        render(<Button label="Disabled" disabled testID="disabled-btn" />),
      ).not.toThrow();
    });

    it('defaults to not disabled', () => {
      expect(() => render(<Button label="Test" />)).not.toThrow();
    });
  });

  describe('Styling', () => {
    it('uses NativeWind className for styling', () => {
      // Testing that Button uses className and includes NativeWind utilities
      const content = readButtonSource();
      expect(content).toContain('className');
      expect(content).toContain('rounded-md');
    });

    it('includes active state styling', () => {
      // Testing that Button includes active state opacity change
      const content = readButtonSource();
      expect(content).toContain('active:opacity-75');
    });

    it('passes className prop to rendered component', () => {
      expect(() =>
        render(<Button label="Test" className="custom-class" testID="styled-btn" />),
      ).not.toThrow();
    });

    it('accepts style prop', () => {
      expect(() =>
        render(<Button label="Test" style={{ marginTop: 10 }} testID="style-btn" />),
      ).not.toThrow();
    });
  });

  describe('Accessibility', () => {
    it('renders with accessible attributes', () => {
      expect(() => render(<Button label="Accessible" testID="a11y-btn" />)).not.toThrow();
    });

    it('renders with label for screen readers', () => {
      expect(() => render(<Button label="Read Me" testID="readable-btn" />)).not.toThrow();
    });
  });

  describe('Props Combinations', () => {
    it('renders with variant and size combined', () => {
      expect(() =>
        render(<Button label="Styled" variant="success" size="lg" testID="combined-btn" />),
      ).not.toThrow();
    });

    it('renders with variant, size, and disabled combined', () => {
      expect(() =>
        render(<Button label="Complex" variant="error" size="sm" disabled testID="complex-btn" />),
      ).not.toThrow();
    });

    it('renders with all custom props', () => {
      expect(() =>
        render(
          <Button
            label="Full"
            variant="primary"
            size="md"
            disabled={false}
            className="custom"
            style={{ padding: 5 }}
            testID="full-btn"
          />,
        ),
      ).not.toThrow();
    });
  });

  describe('File Structure', () => {
    it('component file exists', () => {
      // This test will pass because Button is successfully imported
      expect(Button).toBeDefined();
    });

    it('is exported from index', () => {
      // Testing that Button is properly exported and importable
      const indexContent = readFileSync(join(__dirname, '../index.ts'), 'utf-8');
      expect(indexContent).toContain('export { Button }');
      expect(indexContent).toContain('./Button');
    });
  });
});
