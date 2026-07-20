/**
 * Integration tests for T-001 bootstrap
 *
 * Valida configuração do TypeScript, Expo Router e estrutura base
 */

import * as fs from 'fs';
import * as path from 'path';

describe('T-001 Bootstrap - Integration', () => {
  describe('TypeScript Configuration', () => {
    it('tsconfig.json exists', () => {
      const tsconfigPath = path.join(process.cwd(), 'tsconfig.json');
      expect(fs.existsSync(tsconfigPath)).toBe(true);
    });

    it('TypeScript strict mode is enabled', () => {
      const tsconfigPath = path.join(process.cwd(), 'tsconfig.json');
      const tsconfig = JSON.parse(fs.readFileSync(tsconfigPath, 'utf-8'));
      expect(tsconfig.compilerOptions.strict).toBe(true);
    });

    it('has path alias configured for src', () => {
      const tsconfigPath = path.join(process.cwd(), 'tsconfig.json');
      const tsconfig = JSON.parse(fs.readFileSync(tsconfigPath, 'utf-8'));
      expect(tsconfig.compilerOptions.paths['@/*']).toBeDefined();
    });
  });

  describe('Expo Configuration', () => {
    it('app.json exists', () => {
      const appJsonPath = path.join(process.cwd(), 'app.json');
      expect(fs.existsSync(appJsonPath)).toBe(true);
    });

    it('minSdkVersion is set to 34', () => {
      const appJsonPath = path.join(process.cwd(), 'app.json');
      const appConfig = JSON.parse(fs.readFileSync(appJsonPath, 'utf-8'));
      expect(appConfig.expo.android.minSdkVersion).toBe(34);
    });

    it('Expo Router is configured as main entry', () => {
      const packageJsonPath = path.join(process.cwd(), 'package.json');
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
      expect(packageJson.main).toBe('expo-router/entry');
    });

    it('expo-router is in dependencies', () => {
      const packageJsonPath = path.join(process.cwd(), 'package.json');
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
      expect(packageJson.dependencies['expo-router']).toBeDefined();
    });

    it('nativewind is installed', () => {
      const packageJsonPath = path.join(process.cwd(), 'package.json');
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
      expect(packageJson.dependencies.nativewind).toBeDefined();
    });
  });

  describe('Project Structure', () => {
    const requiredDirs = [
      'src/app',
      'src/features/server',
      'src/features/transfer',
      'src/features/files',
      'src/shared/components',
      'src/shared/hooks',
      'src/shared/lib',
      'src/shared/types',
      'web-ui',
    ];

    requiredDirs.forEach((dir) => {
      it(`${dir} directory exists`, () => {
        const dirPath = path.join(process.cwd(), dir);
        expect(fs.existsSync(dirPath)).toBe(true);
      });
    });

    it('src/app/index.tsx exists', () => {
      const filePath = path.join(process.cwd(), 'src/app/index.tsx');
      expect(fs.existsSync(filePath)).toBe(true);
    });

    it('src/app/_layout.tsx exists', () => {
      const filePath = path.join(process.cwd(), 'src/app/_layout.tsx');
      expect(fs.existsSync(filePath)).toBe(true);
    });
  });

  describe('Home Screen Content', () => {
    it('Home screen uses ServerHomeScreen component (T-204)', () => {
      const indexPath = path.join(process.cwd(), 'src/app/index.tsx');
      const content = fs.readFileSync(indexPath, 'utf-8');
      expect(content).toContain('ServerHomeScreen');
      expect(content).toContain('features/server');
    });

    it('ServerHomeScreen uses Screen component from shared/components', () => {
      const screenHomePath = path.join(
        process.cwd(),
        'src/features/server/components/ServerHomeScreen.tsx',
      );
      const content = fs.readFileSync(screenHomePath, 'utf-8');
      expect(content).toContain('Screen');
      expect(content).toContain('shared/components');
    });

    it('Home screen uses expo-splash-screen', () => {
      const indexPath = path.join(process.cwd(), 'src/app/index.tsx');
      const content = fs.readFileSync(indexPath, 'utf-8');
      expect(content).toContain('expo-splash-screen');
    });

    it('Home screen has proper theme support via Screen component', () => {
      const indexPath = path.join(process.cwd(), 'src/app/index.tsx');
      const content = fs.readFileSync(indexPath, 'utf-8');
      // Screen component handles theme support internally
      expect(content).toContain('Screen');
      // Verify Screen component file has theme support via NativeWind dark: variant
      const screenPath = path.join(process.cwd(), 'src/shared/components/Screen.tsx');
      const screenContent = fs.readFileSync(screenPath, 'utf-8');
      expect(screenContent).toContain('dark:');
      expect(screenContent).toContain('SafeAreaView');
    });
  });

  describe('Tailwind/NativeWind Setup', () => {
    it('tailwind.config.js exists', () => {
      const tailwindPath = path.join(process.cwd(), 'tailwind.config.js');
      expect(fs.existsSync(tailwindPath)).toBe(true);
    });

    it('global.css exists', () => {
      const globalCssPath = path.join(process.cwd(), 'src/global.css');
      expect(fs.existsSync(globalCssPath)).toBe(true);
    });

    it('tailwind.config.js exports configuration', () => {
      const tailwindPath = path.join(process.cwd(), 'tailwind.config.js');
      const config = require(tailwindPath);
      expect(config.theme).toBeDefined();
      expect(config.plugins).toBeDefined();
    });

    it('tailwind config has colors tokens', () => {
      const tailwindPath = path.join(process.cwd(), 'tailwind.config.js');
      const config = require(tailwindPath);
      expect(config.theme.extend.colors).toBeDefined();
    });

    it('tailwind config has spacing tokens', () => {
      const tailwindPath = path.join(process.cwd(), 'tailwind.config.js');
      const config = require(tailwindPath);
      expect(config.theme.extend.spacing).toBeDefined();
    });

    it('tailwind config has typography tokens', () => {
      const tailwindPath = path.join(process.cwd(), 'tailwind.config.js');
      const config = require(tailwindPath);
      expect(config.theme.extend.fontSize).toBeDefined();
    });
  });

  describe('ESLint Configuration', () => {
    it('eslint.config.js exists', () => {
      const eslintPath = path.join(process.cwd(), 'eslint.config.js');
      expect(fs.existsSync(eslintPath)).toBe(true);
    });

    it('ESLint blocks @typescript-eslint/no-explicit-any', () => {
      const eslintPath = path.join(process.cwd(), 'eslint.config.js');
      const content = fs.readFileSync(eslintPath, 'utf-8');
      expect(content).toContain('@typescript-eslint/no-explicit-any');
      expect(content).toContain('error');
    });
  });
});
