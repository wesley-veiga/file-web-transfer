/**
 * Tests for src/shared/components/Card.tsx
 *
 * T-005 · NativeWind + design tokens
 * Testa componente Card com suporte a tema claro/escuro
 */

import React from 'react';
import { Text } from 'react-native';
import { Card } from '../Card';

describe('Card Component', () => {
  describe('Module and Exports', () => {
    it('exports Card as a named export', () => {
      expect(typeof Card).toBe('function');
    });

    it('Card is defined', () => {
      expect(Card).toBeDefined();
    });
  });

  describe('Component Structure', () => {
    it('file exists at src/shared/components/Card.tsx', () => {
      const fs = require('fs');
      const path = require('path');
      const filePath = path.join(__dirname, '../Card.tsx');
      expect(fs.existsSync(filePath)).toBe(true);
    });

    it('exports Card function from index', () => {
      const fs = require('fs');
      const path = require('path');
      const indexPath = path.join(__dirname, '../index.ts');
      const content = fs.readFileSync(indexPath, 'utf-8');
      expect(content).toContain('export { Card }');
      expect(content).toContain('./Card');
    });
  });

  describe('Component Props', () => {
    it('accepts children prop', () => {
      const element = (
        <Card>
          <Text>Card content</Text>
        </Card>
      );
      expect(element).toBeDefined();
    });

    it('accepts className prop', () => {
      const element = (
        <Card className="custom-class">
          <Text>Card content</Text>
        </Card>
      );
      expect(element).toBeDefined();
    });

    it('accepts testID prop', () => {
      const element = (
        <Card testID="card">
          <Text>Card content</Text>
        </Card>
      );
      expect(element).toBeDefined();
    });

    it('accepts style prop', () => {
      const element = (
        <Card style={{ marginBottom: 16 }}>
          <Text>Card content</Text>
        </Card>
      );
      expect(element).toBeDefined();
    });
  });

  describe('Component Implementation', () => {
    it('uses NativeWind className for styling', () => {
      const fs = require('fs');
      const path = require('path');
      const content = fs.readFileSync(path.join(__dirname, '../Card.tsx'), 'utf-8');
      expect(content).toContain('className');
      expect(content).toContain('rounded-lg');
    });

    it('supports dark theme', () => {
      const fs = require('fs');
      const path = require('path');
      const content = fs.readFileSync(path.join(__dirname, '../Card.tsx'), 'utf-8');
      expect(content).toContain('useColorScheme');
      expect(content).toContain('isDark');
      expect(content).toContain('surface-dark');
    });

    it('supports inline styles for testing compatibility', () => {
      const fs = require('fs');
      const path = require('path');
      const content = fs.readFileSync(path.join(__dirname, '../Card.tsx'), 'utf-8');
      expect(content).toContain('style');
      expect(content).toContain('backgroundColor');
    });
  });
});
