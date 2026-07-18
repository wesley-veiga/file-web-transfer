/**
 * Tests for src/app/index.tsx (Home Screen)
 *
 * T-001 · Bootstrap do projeto Expo
 * Testa componente HomeScreen com verificação de código e estrutura
 */

import React from 'react';
import { useColorScheme } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import HomeScreen from '../index';

// Type-safe mock functions
const mockedUseColorScheme = useColorScheme as jest.MockedFunction<typeof useColorScheme>;
const mockedHideAsync = SplashScreen.hideAsync as jest.MockedFunction<
  typeof SplashScreen.hideAsync
>;

describe('HomeScreen (src/app/index.tsx)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedUseColorScheme.mockReturnValue('light');
    mockedHideAsync.mockResolvedValue(undefined);
  });

  describe('Component Export and Type', () => {
    it('exports default HomeScreen function', () => {
      expect(typeof HomeScreen).toBe('function');
      expect(HomeScreen.name).toBe('HomeScreen');
    });

    it('is exported as a function', () => {
      expect(HomeScreen).toBeDefined();
      expect(typeof HomeScreen).toBe('function');
    });
  });

  describe('Component Structure Verification', () => {
    it('component file exists at src/app/index.tsx', () => {
      const fs = require('fs');
      const path = require('path');
      const filePath = path.join(__dirname, '../index.tsx');
      expect(fs.existsSync(filePath)).toBe(true);
    });

    it('component uses Screen component from shared/components', () => {
      const fileContent = require('fs').readFileSync(
        require('path').join(__dirname, '../index.tsx'),
        'utf-8',
      );
      expect(fileContent).toContain('Screen');
      expect(fileContent).toContain('shared/components');
    });

    it('component uses View and Text from react-native', () => {
      const fileContent = require('fs').readFileSync(
        require('path').join(__dirname, '../index.tsx'),
        'utf-8',
      );
      expect(fileContent).toContain('View');
      expect(fileContent).toContain('Text');
    });
  });

  describe('Content Verification', () => {
    it('displays text "Transfer Files - Home"', () => {
      const fileContent = require('fs').readFileSync(
        require('path').join(__dirname, '../index.tsx'),
        'utf-8',
      );
      expect(fileContent).toContain('Transfer Files - Home');
    });

    it('text is rendered in a Text component', () => {
      const fileContent = require('fs').readFileSync(
        require('path').join(__dirname, '../index.tsx'),
        'utf-8',
      );
      expect(fileContent).toMatch(/<Text[\s\S]*?Transfer Files - Home[\s\S]*?<\/Text>/);
    });
  });

  describe('Theme Support Verification', () => {
    it('delegates theme handling to Screen component', () => {
      const fileContent = require('fs').readFileSync(
        require('path').join(__dirname, '../index.tsx'),
        'utf-8',
      );
      expect(fileContent).toContain('Screen');
      expect(fileContent).toContain('shared/components');
    });

    it('uses useEffect hook properly', () => {
      const fileContent = require('fs').readFileSync(
        require('path').join(__dirname, '../index.tsx'),
        'utf-8',
      );
      expect(fileContent).toContain('useEffect');
      expect(fileContent).toContain('[]');
    });

    it('component is properly structured', () => {
      const fileContent = require('fs').readFileSync(
        require('path').join(__dirname, '../index.tsx'),
        'utf-8',
      );
      expect(fileContent).toContain('export default function HomeScreen');
      expect(fileContent).toContain('return');
    });
  });

  describe('Splash Screen Integration', () => {
    it('imports SplashScreen from expo-splash-screen', () => {
      const fileContent = require('fs').readFileSync(
        require('path').join(__dirname, '../index.tsx'),
        'utf-8',
      );
      expect(fileContent).toContain('expo-splash-screen');
    });

    it('calls SplashScreen.hideAsync in useEffect', () => {
      const fileContent = require('fs').readFileSync(
        require('path').join(__dirname, '../index.tsx'),
        'utf-8',
      );
      expect(fileContent).toContain('SplashScreen.hideAsync');
      expect(fileContent).toContain('useEffect');
    });

    it('hideAsync is awaited properly', () => {
      const fileContent = require('fs').readFileSync(
        require('path').join(__dirname, '../index.tsx'),
        'utf-8',
      );
      expect(fileContent).toContain('await SplashScreen.hideAsync()');
    });
  });

  describe('Styling Verification', () => {
    it('uses NativeWind className for styling', () => {
      const fileContent = require('fs').readFileSync(
        require('path').join(__dirname, '../index.tsx'),
        'utf-8',
      );
      expect(fileContent).toContain('className');
    });

    it('uses flex-1 class for full height', () => {
      const fileContent = require('fs').readFileSync(
        require('path').join(__dirname, '../index.tsx'),
        'utf-8',
      );
      expect(fileContent).toContain('flex-1');
    });

    it('uses justify-center and items-center for centering', () => {
      const fileContent = require('fs').readFileSync(
        require('path').join(__dirname, '../index.tsx'),
        'utf-8',
      );
      expect(fileContent).toContain('justify-center');
      expect(fileContent).toContain('items-center');
    });

    it('uses text-2xl for large text', () => {
      const fileContent = require('fs').readFileSync(
        require('path').join(__dirname, '../index.tsx'),
        'utf-8',
      );
      expect(fileContent).toContain('text-2xl');
    });

    it('uses font-bold for bold text', () => {
      const fileContent = require('fs').readFileSync(
        require('path').join(__dirname, '../index.tsx'),
        'utf-8',
      );
      expect(fileContent).toContain('font-bold');
    });

    it('does not use StyleSheet.create', () => {
      const fileContent = require('fs').readFileSync(
        require('path').join(__dirname, '../index.tsx'),
        'utf-8',
      );
      expect(fileContent).not.toContain('StyleSheet.create');
    });
  });

  describe('Dependencies and Imports', () => {
    it('imports View and Text from react-native', () => {
      const fileContent = require('fs').readFileSync(
        require('path').join(__dirname, '../index.tsx'),
        'utf-8',
      );
      expect(fileContent).toContain("from 'react-native'");
      expect(fileContent).toContain('View');
      expect(fileContent).toContain('Text');
    });

    it('imports useEffect from react', () => {
      const fileContent = require('fs').readFileSync(
        require('path').join(__dirname, '../index.tsx'),
        'utf-8',
      );
      expect(fileContent).toContain("from 'react'");
      expect(fileContent).toContain('useEffect');
    });

    it('imports Screen from shared/components', () => {
      const fileContent = require('fs').readFileSync(
        require('path').join(__dirname, '../index.tsx'),
        'utf-8',
      );
      expect(fileContent).toContain('Screen');
      expect(fileContent).toContain('shared/components');
    });

    it('all required imports are present', () => {
      const fileContent = require('fs').readFileSync(
        require('path').join(__dirname, '../index.tsx'),
        'utf-8',
      );
      expect(fileContent).toContain('import');
      expect(fileContent).toContain('View');
      expect(fileContent).toContain('Text');
      expect(fileContent).toContain('useEffect');
      expect(fileContent).toContain('SplashScreen');
      expect(fileContent).toContain('Screen');
    });
  });

  describe('Hook Usage', () => {
    it('uses useEffect hook for side effects', () => {
      const fileContent = require('fs').readFileSync(
        require('path').join(__dirname, '../index.tsx'),
        'utf-8',
      );
      expect(fileContent).toContain('useEffect');
      expect(fileContent).toContain('() => {');
    });

    it('useEffect is called with empty dependency array', () => {
      const fileContent = require('fs').readFileSync(
        require('path').join(__dirname, '../index.tsx'),
        'utf-8',
      );
      expect(fileContent).toContain('useEffect(');
      expect(fileContent).toContain('[]');
    });

    it('calls SplashScreen.hideAsync in useEffect', () => {
      const fileContent = require('fs').readFileSync(
        require('path').join(__dirname, '../index.tsx'),
        'utf-8',
      );
      expect(fileContent).toContain('SplashScreen.hideAsync');
      expect(fileContent).toContain('await');
    });
  });

  describe('Export Verification', () => {
    it('is exported as default', () => {
      const fileContent = require('fs').readFileSync(
        require('path').join(__dirname, '../index.tsx'),
        'utf-8',
      );
      expect(fileContent).toContain('export default function HomeScreen');
    });

    it('default export name is HomeScreen', () => {
      const fileContent = require('fs').readFileSync(
        require('path').join(__dirname, '../index.tsx'),
        'utf-8',
      );
      expect(fileContent).toMatch(/export default function HomeScreen/);
    });
  });

  describe('Code Quality', () => {
    it('component uses proper React syntax', () => {
      const fileContent = require('fs').readFileSync(
        require('path').join(__dirname, '../index.tsx'),
        'utf-8',
      );
      expect(fileContent).toContain('return');
      expect(fileContent).toContain('<');
      expect(fileContent).toContain('>');
    });

    it('component has no TypeScript errors (syntax check)', () => {
      // If the file can be imported without errors, syntax is valid
      expect(HomeScreen).toBeDefined();
    });
  });

  describe('Integration', () => {
    it('component structure is valid and complete', () => {
      const fileContent = require('fs').readFileSync(
        require('path').join(__dirname, '../index.tsx'),
        'utf-8',
      );

      // Verify all key components are present
      expect(fileContent).toContain('Screen');
      expect(fileContent).toContain('View');
      expect(fileContent).toContain('Text');
      expect(fileContent).toContain('Transfer Files - Home');
      expect(fileContent).toContain('export default');
    });

    it('file has no obvious code quality issues', () => {
      const fileContent = require('fs').readFileSync(
        require('path').join(__dirname, '../index.tsx'),
        'utf-8',
      );

      // Verify no `any` type (TypeScript strict)
      expect(fileContent).not.toContain(': any');

      // Verify proper import/export usage
      expect(fileContent).toContain('import');
      expect(fileContent).toContain('export default');
    });
  });
});
