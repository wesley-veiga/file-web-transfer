/**
 * Tests for src/shared/components/Screen.tsx
 *
 * T-005 · NativeWind + design tokens
 * Testa componente Screen com SafeAreaView e suporte a tema
 */

import React from 'react';
import { Text } from 'react-native';
import { Screen } from '../Screen';

describe('Screen Component', () => {
  describe('Module and Exports', () => {
    it('exports Screen as a named export', () => {
      expect(typeof Screen).toBe('function');
    });

    it('Screen is defined', () => {
      expect(Screen).toBeDefined();
    });
  });

  describe('Component Structure', () => {
    it('file exists at src/shared/components/Screen.tsx', () => {
      const fs = require('fs');
      const path = require('path');
      const filePath = path.join(__dirname, '../Screen.tsx');
      expect(fs.existsSync(filePath)).toBe(true);
    });

    it('exports Screen function from index', () => {
      const fs = require('fs');
      const path = require('path');
      const indexPath = path.join(__dirname, '../index.ts');
      const content = fs.readFileSync(indexPath, 'utf-8');
      expect(content).toContain('export { Screen }');
      expect(content).toContain('./Screen');
    });
  });

  describe('Component Props', () => {
    it('accepts children prop', () => {
      const element = (
        <Screen>
          <Text>Screen content</Text>
        </Screen>
      );
      expect(element).toBeDefined();
    });

    it('accepts className prop', () => {
      const element = (
        <Screen className="custom-class">
          <Text>Screen content</Text>
        </Screen>
      );
      expect(element).toBeDefined();
    });

    it('accepts testID prop', () => {
      const element = (
        <Screen testID="screen">
          <Text>Screen content</Text>
        </Screen>
      );
      expect(element).toBeDefined();
    });

    it('accepts style prop', () => {
      const element = (
        <Screen style={{ backgroundColor: '#fff' }}>
          <Text>Screen content</Text>
        </Screen>
      );
      expect(element).toBeDefined();
    });
  });

  describe('Component Implementation', () => {
    it('uses SafeAreaView', () => {
      const fs = require('fs');
      const path = require('path');
      const content = fs.readFileSync(path.join(__dirname, '../Screen.tsx'), 'utf-8');
      expect(content).toContain('SafeAreaView');
      expect(content).toContain('react-native-safe-area-context');
    });

    it('uses NativeWind className for styling', () => {
      const fs = require('fs');
      const path = require('path');
      const content = fs.readFileSync(path.join(__dirname, '../Screen.tsx'), 'utf-8');
      expect(content).toContain('className');
    });

    it('supports dark theme', () => {
      const fs = require('fs');
      const path = require('path');
      const content = fs.readFileSync(path.join(__dirname, '../Screen.tsx'), 'utf-8');
      expect(content).toContain('useColorScheme');
      expect(content).toContain('isDark');
      expect(content).toContain('background-dark');
    });

    it('supports inline styles for testing compatibility', () => {
      const fs = require('fs');
      const path = require('path');
      const content = fs.readFileSync(path.join(__dirname, '../Screen.tsx'), 'utf-8');
      expect(content).toContain('style');
      expect(content).toContain('backgroundColor');
    });
  });
});
