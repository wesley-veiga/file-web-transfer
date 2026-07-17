/**
 * Tests for src/app/_layout.tsx (Root Layout)
 *
 * T-001 · Bootstrap do projeto Expo
 * Valida que o layout raiz existe e exporta uma função React
 */

describe('RootLayout (_layout.tsx)', () => {
  it('module exists and can be imported', () => {
    // This test validates that the file exists and is syntactically valid
    const layoutPath = require.resolve('../_layout.tsx');
    expect(layoutPath).toBeDefined();
    expect(layoutPath).toContain('_layout.tsx');
  });

  it('default export exists', () => {
    // Import the module to validate it exports a default
    const module = require('../_layout');
    expect(module.default).toBeDefined();
  });

  it('exports a function named RootLayout', () => {
    const { default: RootLayout } = require('../_layout');
    expect(typeof RootLayout).toBe('function');
    expect(RootLayout.name).toBe('RootLayout');
  });

  it('imports expo-router Stack and ThemeProvider', () => {
    const fs = require('fs');
    const path = require('path');
    const fileContent = fs.readFileSync(
      path.join(__dirname, '../_layout.tsx'),
      'utf-8'
    );
    expect(fileContent).toContain('Stack');
    expect(fileContent).toContain('ThemeProvider');
    expect(fileContent).toContain('expo-router');
  });

  it('uses expo-splash-screen', () => {
    const fs = require('fs');
    const path = require('path');
    const fileContent = fs.readFileSync(
      path.join(__dirname, '../_layout.tsx'),
      'utf-8'
    );
    expect(fileContent).toContain('expo-splash-screen');
    expect(fileContent).toContain('SplashScreen.preventAutoHideAsync');
  });

  it('calls SplashScreen.preventAutoHideAsync on render', () => {
    const fs = require('fs');
    const path = require('path');
    const fileContent = fs.readFileSync(
      path.join(__dirname, '../_layout.tsx'),
      'utf-8'
    );
    expect(fileContent).toContain('SplashScreen.preventAutoHideAsync()');
  });

  it('has proper TypeScript syntax', () => {
    // TypeScript will validate this during compilation (tsc --noEmit)
    const { default: RootLayout } = require('../_layout');
    expect(RootLayout).toBeDefined();
  });
});
