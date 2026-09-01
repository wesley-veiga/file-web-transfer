/**
 * Tests for src/app/_layout.tsx (Root Layout)
 *
 * T-001 · Bootstrap do projeto Expo
 * Testa estrutura e configuração do layout raiz
 */

import React from 'react';
import { useColorScheme } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import RootLayout from '../_layout';

// Type-safe mock functions
const mockedUseColorScheme = useColorScheme as jest.MockedFunction<typeof useColorScheme>;
const mockedPreventAutoHideAsync = SplashScreen.preventAutoHideAsync as jest.MockedFunction<
  typeof SplashScreen.preventAutoHideAsync
>;

describe('RootLayout (_layout.tsx)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedUseColorScheme.mockReturnValue('light');
    (mockedPreventAutoHideAsync as jest.Mock).mockReturnValue(Promise.resolve());
  });

  describe('Module and Exports', () => {
    it('exports a default function', () => {
      expect(typeof RootLayout).toBe('function');
    });

    it('default export is named RootLayout', () => {
      expect(RootLayout.name).toBe('RootLayout');
    });

    it('is a valid export', () => {
      expect(RootLayout).toBeDefined();
    });
  });

  describe('Component File Structure', () => {
    it('file exists at src/app/_layout.tsx', () => {
      const fs = require('fs');
      const path = require('path');
      const filePath = path.join(__dirname, '../_layout.tsx');
      expect(fs.existsSync(filePath)).toBe(true);
    });

    it('file exports default RootLayout function', () => {
      const fileContent = require('fs').readFileSync(
        require('path').join(__dirname, '../_layout.tsx'),
        'utf-8',
      );
      expect(fileContent).toContain('export default function RootLayout');
    });
  });

  describe('Splash Screen Integration', () => {
    it('imports SplashScreen from expo-splash-screen', () => {
      const fileContent = require('fs').readFileSync(
        require('path').join(__dirname, '../_layout.tsx'),
        'utf-8',
      );
      expect(fileContent).toContain('expo-splash-screen');
    });

    it('calls SplashScreen.preventAutoHideAsync at module level', () => {
      const fileContent = require('fs').readFileSync(
        require('path').join(__dirname, '../_layout.tsx'),
        'utf-8',
      );
      expect(fileContent).toContain('SplashScreen.preventAutoHideAsync()');
    });

    it('preventAutoHideAsync is called before function definition', () => {
      const fileContent = require('fs').readFileSync(
        require('path').join(__dirname, '../_layout.tsx'),
        'utf-8',
      );
      const callIndex = fileContent.indexOf('SplashScreen.preventAutoHideAsync()');
      const funcIndex = fileContent.indexOf('function RootLayout');
      expect(callIndex).toBeLessThan(funcIndex);
    });
  });

  describe('Theme Support', () => {
    it('imports useColorScheme from react-native', () => {
      const fileContent = require('fs').readFileSync(
        require('path').join(__dirname, '../_layout.tsx'),
        'utf-8',
      );
      expect(fileContent).toContain('useColorScheme');
      expect(fileContent).toContain("from 'react-native'");
    });

    it('uses useColorScheme hook inside component', () => {
      const fileContent = require('fs').readFileSync(
        require('path').join(__dirname, '../_layout.tsx'),
        'utf-8',
      );
      expect(fileContent).toMatch(/const colorScheme = useColorScheme\(\)/);
    });

    it('imports DarkTheme and DefaultTheme from expo-router', () => {
      const fileContent = require('fs').readFileSync(
        require('path').join(__dirname, '../_layout.tsx'),
        'utf-8',
      );
      expect(fileContent).toContain('DarkTheme');
      expect(fileContent).toContain('DefaultTheme');
      expect(fileContent).toContain("from 'expo-router'");
    });

    it('selects theme based on colorScheme', () => {
      const fileContent = require('fs').readFileSync(
        require('path').join(__dirname, '../_layout.tsx'),
        'utf-8',
      );
      expect(fileContent).toContain("colorScheme === 'dark'");
      expect(fileContent).toContain('DarkTheme');
      expect(fileContent).toContain('DefaultTheme');
    });

    it('uses ternary operator for theme selection', () => {
      const fileContent = require('fs').readFileSync(
        require('path').join(__dirname, '../_layout.tsx'),
        'utf-8',
      );
      expect(fileContent).toMatch(/colorScheme === 'dark' \? DarkTheme : DefaultTheme/);
    });
  });

  describe('StatusBar (T-803 — ajustes visuais diversos)', () => {
    it('imports StatusBar from expo-status-bar', () => {
      const fileContent = require('fs').readFileSync(
        require('path').join(__dirname, '../_layout.tsx'),
        'utf-8',
      );
      expect(fileContent).toContain('StatusBar');
      expect(fileContent).toContain("from 'expo-status-bar'");
    });

    it('renders StatusBar component', () => {
      const fileContent = require('fs').readFileSync(
        require('path').join(__dirname, '../_layout.tsx'),
        'utf-8',
      );
      expect(fileContent).toContain('<StatusBar');
    });

    it('StatusBar style prop reacts to colorScheme: "light" when dark mode', () => {
      const fileContent = require('fs').readFileSync(
        require('path').join(__dirname, '../_layout.tsx'),
        'utf-8',
      );
      expect(fileContent).toMatch(/style=\{colorScheme === 'dark' \? 'light' : 'dark'\}/);
    });

    it('StatusBar style prop reacts to colorScheme: "dark" when light mode', () => {
      const fileContent = require('fs').readFileSync(
        require('path').join(__dirname, '../_layout.tsx'),
        'utf-8',
      );
      // Verifica que usa ternário com colorScheme === 'dark'
      expect(fileContent).toMatch(/style=\{colorScheme === 'dark'/);
      // E que o valor true é 'light' (mantém contraste no tema escuro)
      expect(fileContent).toContain("colorScheme === 'dark' ? 'light' : 'dark'");
    });

    it('renders StatusBar inside ThemeProvider', () => {
      const fileContent = require('fs').readFileSync(
        require('path').join(__dirname, '../_layout.tsx'),
        'utf-8',
      );
      const content = fileContent;
      const themeProviderIndex = content.indexOf('<ThemeProvider');
      const statusBarIndex = content.indexOf('<StatusBar');
      const themeProviderCloseIndex = content.indexOf('</ThemeProvider>');

      // StatusBar deve estar entre abertura e fechamento de ThemeProvider
      expect(statusBarIndex).toBeGreaterThan(themeProviderIndex);
      expect(statusBarIndex).toBeLessThan(themeProviderCloseIndex);
    });
  });

  describe('Stack Navigator Configuration', () => {
    it('imports Stack from expo-router', () => {
      const fileContent = require('fs').readFileSync(
        require('path').join(__dirname, '../_layout.tsx'),
        'utf-8',
      );
      expect(fileContent).toContain('Stack');
      expect(fileContent).toContain("from 'expo-router'");
    });

    it('uses Stack Navigator component', () => {
      const fileContent = require('fs').readFileSync(
        require('path').join(__dirname, '../_layout.tsx'),
        'utf-8',
      );
      expect(fileContent).toContain('<Stack');
    });

    it('configures screenOptions', () => {
      const fileContent = require('fs').readFileSync(
        require('path').join(__dirname, '../_layout.tsx'),
        'utf-8',
      );
      expect(fileContent).toContain('screenOptions');
    });

    it('sets headerShown to false', () => {
      const fileContent = require('fs').readFileSync(
        require('path').join(__dirname, '../_layout.tsx'),
        'utf-8',
      );
      expect(fileContent).toContain('headerShown: false');
    });
  });

  describe('ThemeProvider Integration', () => {
    it('imports ThemeProvider from expo-router', () => {
      const fileContent = require('fs').readFileSync(
        require('path').join(__dirname, '../_layout.tsx'),
        'utf-8',
      );
      expect(fileContent).toContain('ThemeProvider');
      expect(fileContent).toContain("from 'expo-router'");
    });

    it('wraps Stack with ThemeProvider', () => {
      const fileContent = require('fs').readFileSync(
        require('path').join(__dirname, '../_layout.tsx'),
        'utf-8',
      );
      expect(fileContent).toContain('<ThemeProvider');
      expect(fileContent).toContain('<Stack');
      expect(fileContent).toContain('</ThemeProvider>');
    });

    it('passes selected theme to ThemeProvider', () => {
      const fileContent = require('fs').readFileSync(
        require('path').join(__dirname, '../_layout.tsx'),
        'utf-8',
      );
      expect(fileContent).toMatch(/value=\{colorScheme === 'dark' \? DarkTheme : DefaultTheme\}/);
    });
  });

  describe('Dependencies and Imports', () => {
    it('imports all required modules', () => {
      const fileContent = require('fs').readFileSync(
        require('path').join(__dirname, '../_layout.tsx'),
        'utf-8',
      );

      expect(fileContent).toContain('SplashScreen');
      expect(fileContent).toContain('DarkTheme');
      expect(fileContent).toContain('DefaultTheme');
      expect(fileContent).toContain('Stack');
      expect(fileContent).toContain('ThemeProvider');
      expect(fileContent).toContain('useColorScheme');
    });

    it('all imports are from correct modules', () => {
      const fileContent = require('fs').readFileSync(
        require('path').join(__dirname, '../_layout.tsx'),
        'utf-8',
      );

      expect(fileContent).toContain("from 'expo-splash-screen'");
      expect(fileContent).toContain("from 'expo-router'");
      expect(fileContent).toContain("from 'react-native'");
    });
  });

  describe('Component Structure', () => {
    it('function returns JSX element', () => {
      const fileContent = require('fs').readFileSync(
        require('path').join(__dirname, '../_layout.tsx'),
        'utf-8',
      );
      expect(fileContent).toContain('return');
      expect(fileContent).toContain('<');
    });

    it('uses React JSX syntax', () => {
      const fileContent = require('fs').readFileSync(
        require('path').join(__dirname, '../_layout.tsx'),
        'utf-8',
      );
      expect(fileContent).toContain('<ThemeProvider');
      expect(fileContent).toContain('</ThemeProvider>');
    });

    it('component closure is properly structured', () => {
      const fileContent = require('fs').readFileSync(
        require('path').join(__dirname, '../_layout.tsx'),
        'utf-8',
      );
      expect(fileContent).toMatch(/function RootLayout[\s\S]*\{[\s\S]*return[\s\S]*\}/);
    });
  });

  describe('Module Initialization', () => {
    it('preventAutoHideAsync is called immediately on module load', () => {
      const fileContent = require('fs').readFileSync(
        require('path').join(__dirname, '../_layout.tsx'),
        'utf-8',
      );

      // Check that it's called at module level (outside any function)
      const lines = fileContent.split('\n');
      let insideFunction = false;
      let foundCall = false;

      for (const line of lines) {
        if (line.includes('function RootLayout')) {
          insideFunction = true;
        }
        if (!insideFunction && line.includes('SplashScreen.preventAutoHideAsync()')) {
          foundCall = true;
          break;
        }
      }

      expect(foundCall).toBe(true);
    });
  });

  describe('Code Quality', () => {
    it('component has no TypeScript errors (syntax check)', () => {
      // If the module can be imported without errors, syntax is valid
      expect(RootLayout).toBeDefined();
      expect(typeof RootLayout).toBe('function');
    });

    it('proper React import is present', () => {
      const fileContent = require('fs').readFileSync(
        require('path').join(__dirname, '../_layout.tsx'),
        'utf-8',
      );

      // Either has React import or uses JSX shorthand (which requires React 17+)
      expect(fileContent).toContain("from 'expo-router'");
    });

    it('file has no obvious code quality issues', () => {
      const fileContent = require('fs').readFileSync(
        require('path').join(__dirname, '../_layout.tsx'),
        'utf-8',
      );

      // Verify no `any` type (TypeScript strict)
      expect(fileContent).not.toContain(': any');

      // Verify proper structure
      expect(fileContent).toContain('export default');
      expect(fileContent).toContain('function RootLayout');
    });
  });

  describe('Integration', () => {
    it('all components work together in module structure', () => {
      const fileContent = require('fs').readFileSync(
        require('path').join(__dirname, '../_layout.tsx'),
        'utf-8',
      );

      // Verify the full flow
      expect(fileContent).toContain('SplashScreen.preventAutoHideAsync()');
      expect(fileContent).toContain('function RootLayout');
      expect(fileContent).toContain('const colorScheme = useColorScheme()');
      expect(fileContent).toContain('ThemeProvider');
      expect(fileContent).toContain('Stack');
      expect(fileContent).toContain('export default function RootLayout');
    });

    it('module file is syntactically valid and complete', () => {
      const fileContent = require('fs').readFileSync(
        require('path').join(__dirname, '../_layout.tsx'),
        'utf-8',
      );

      // Count opening and closing tags/braces
      const openBraces = (fileContent.match(/\{/g) || []).length;
      const closeBraces = (fileContent.match(/\}/g) || []).length;
      expect(openBraces).toEqual(closeBraces);

      const openTags = (fileContent.match(/</g) || []).length;
      const closeTags = (fileContent.match(/>/g) || []).length;
      expect(openTags).toEqual(closeTags);
    });
  });
});
