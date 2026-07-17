import * as fs from 'fs';
import * as path from 'path';

interface AppConfig {
  expo: {
    name: string;
    slug: string;
    version: string;
    orientation: string;
    icon: string;
    scheme: string;
    userInterfaceStyle: string;
    ios: Record<string, unknown>;
    android: {
      minSdkVersion: number;
      package: string;
      adaptiveIcon: Record<string, unknown>;
      predictiveBackGestureEnabled: boolean;
    };
    web: Record<string, unknown>;
    plugins: unknown[];
    experiments: Record<string, unknown>;
  };
}

describe('app.json configuration', () => {
  let appConfig: AppConfig;

  beforeAll(() => {
    const appJsonPath = path.join(process.cwd(), 'app.json');
    const appJsonContent = fs.readFileSync(appJsonPath, 'utf-8');
    appConfig = JSON.parse(appJsonContent);
  });

  it('app.json file exists', () => {
    expect(appConfig).toBeDefined();
  });

  it('has expo configuration', () => {
    expect(appConfig.expo).toBeDefined();
  });

  it('has correct minSdkVersion set to 34 (Android 14+)', () => {
    expect(appConfig.expo.android).toBeDefined();
    expect(appConfig.expo.android.minSdkVersion).toBe(34);
  });

  it('Android configuration exists', () => {
    expect(appConfig.expo.android).toBeDefined();
  });

  it('has correct package name', () => {
    expect(appConfig.expo.android.package).toBe('com.anonymous.transferfiles');
  });

  it('has name and slug defined', () => {
    expect(appConfig.expo.name).toBeDefined();
    expect(appConfig.expo.slug).toBeDefined();
    expect(appConfig.expo.name).toBe('transfer-files');
    expect(appConfig.expo.slug).toBe('transfer-files');
  });

  it('has version defined', () => {
    expect(appConfig.expo.version).toBeDefined();
    expect(appConfig.expo.version).toBe('1.0.0');
  });

  it('has proper orientation setting', () => {
    expect(appConfig.expo.orientation).toBe('portrait');
  });

  it('has iOS configuration', () => {
    expect(appConfig.expo.ios).toBeDefined();
  });

  it('has web configuration', () => {
    expect(appConfig.expo.web).toBeDefined();
    expect(appConfig.expo.web.output).toBe('static');
  });

  it('has plugins array configured', () => {
    expect(Array.isArray(appConfig.expo.plugins)).toBe(true);
    expect(appConfig.expo.plugins.length).toBeGreaterThan(0);
  });

  it('has expo-router plugin enabled', () => {
    expect(appConfig.expo.plugins).toContain('expo-router');
  });

  it('has experiments enabled', () => {
    expect(appConfig.expo.experiments).toBeDefined();
    expect(appConfig.expo.experiments.typedRoutes).toBe(true);
    expect(appConfig.expo.experiments.reactCompiler).toBe(true);
  });
});
