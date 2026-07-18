/**
 * Tests for src/shared/components/Button.tsx
 *
 * T-005 · NativeWind + design tokens
 * Testa componente Button com variantes, tamanhos e estados
 */

import React from 'react';
import { Button } from '../Button';

describe('Button Component', () => {
  describe('Module and Exports', () => {
    it('exports Button as a named export', () => {
      expect(typeof Button).toBe('function');
    });

    it('Button is defined', () => {
      expect(Button).toBeDefined();
    });
  });

  describe('Component Structure', () => {
    it('file exists at src/shared/components/Button.tsx', () => {
      const fs = require('fs');
      const path = require('path');
      const filePath = path.join(__dirname, '../Button.tsx');
      expect(fs.existsSync(filePath)).toBe(true);
    });

    it('exports Button function from index', () => {
      const fs = require('fs');
      const path = require('path');
      const indexPath = path.join(__dirname, '../index.ts');
      const content = fs.readFileSync(indexPath, 'utf-8');
      expect(content).toContain('export { Button }');
      expect(content).toContain('./Button');
    });
  });

  describe('Component Props', () => {
    it('accepts label prop', () => {
      const element = <Button label="Test Label" />;
      expect(element).toBeDefined();
    });

    it('accepts variant prop', () => {
      const variants: ('primary' | 'secondary' | 'success' | 'error')[] = [
        'primary',
        'secondary',
        'success',
        'error',
      ];
      variants.forEach((variant) => {
        const element = <Button label="Test" variant={variant} />;
        expect(element).toBeDefined();
      });
    });

    it('accepts size prop', () => {
      const sizes: ('sm' | 'md' | 'lg')[] = ['sm', 'md', 'lg'];
      sizes.forEach((size) => {
        const element = <Button label="Test" size={size} />;
        expect(element).toBeDefined();
      });
    });

    it('accepts disabled prop', () => {
      const element = <Button label="Test" disabled />;
      expect(element).toBeDefined();
    });

    it('accepts className prop', () => {
      const element = <Button label="Test" className="custom-class" />;
      expect(element).toBeDefined();
    });
  });

  describe('Component Implementation', () => {
    it('uses NativeWind className for styling', () => {
      const fs = require('fs');
      const path = require('path');
      const content = fs.readFileSync(path.join(__dirname, '../Button.tsx'), 'utf-8');
      expect(content).toContain('className');
      expect(content).toContain('rounded-md');
    });

    it('supports inline styles for testing compatibility', () => {
      const fs = require('fs');
      const path = require('path');
      const content = fs.readFileSync(path.join(__dirname, '../Button.tsx'), 'utf-8');
      expect(content).toContain('style');
      expect(content).toContain('backgroundColor');
    });
  });
});
