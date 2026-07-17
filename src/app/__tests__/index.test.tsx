/**
 * Tests for src/app/index.tsx (Home Screen)
 *
 * T-001 · Bootstrap do projeto Expo
 * Valida que a tela inicial existe, exibe o texto correto e usa SafeAreaView
 */

describe('HomeScreen (src/app/index.tsx)', () => {
  it('file exists at src/app/index.tsx', () => {
    const fs = require('fs');
    const path = require('path');
    const indexPath = path.join(__dirname, '../index.tsx');
    expect(fs.existsSync(indexPath)).toBe(true);
  });

  it('displays "Transfer Files - Home" text', () => {
    const fs = require('fs');
    const path = require('path');
    const fileContent = fs.readFileSync(
      path.join(__dirname, '../index.tsx'),
      'utf-8'
    );
    expect(fileContent).toContain('Transfer Files - Home');
  });

  it('uses expo-splash-screen', () => {
    const fs = require('fs');
    const path = require('path');
    const fileContent = fs.readFileSync(
      path.join(__dirname, '../index.tsx'),
      'utf-8'
    );
    expect(fileContent).toContain('expo-splash-screen');
    expect(fileContent).toContain('SplashScreen.hideAsync');
  });

  it('uses SafeAreaView from react-native-safe-area-context', () => {
    const fs = require('fs');
    const path = require('path');
    const fileContent = fs.readFileSync(
      path.join(__dirname, '../index.tsx'),
      'utf-8'
    );
    expect(fileContent).toContain('react-native-safe-area-context');
    expect(fileContent).toContain('SafeAreaView');
  });

  it('imports and uses React.useEffect hook', () => {
    const fs = require('fs');
    const path = require('path');
    const fileContent = fs.readFileSync(
      path.join(__dirname, '../index.tsx'),
      'utf-8'
    );
    expect(fileContent).toContain('useEffect');
    expect(fileContent).toContain('from \'react\'');
  });

  it('is exported as default', () => {
    const fs = require('fs');
    const path = require('path');
    const fileContent = fs.readFileSync(
      path.join(__dirname, '../index.tsx'),
      'utf-8'
    );
    expect(fileContent).toContain('export default function HomeScreen');
  });

  it('uses React.View and React.Text components', () => {
    const fs = require('fs');
    const path = require('path');
    const fileContent = fs.readFileSync(
      path.join(__dirname, '../index.tsx'),
      'utf-8'
    );
    expect(fileContent).toContain('View');
    expect(fileContent).toContain('Text');
  });

  it('imports from react-native', () => {
    const fs = require('fs');
    const path = require('path');
    const fileContent = fs.readFileSync(
      path.join(__dirname, '../index.tsx'),
      'utf-8'
    );
    expect(fileContent).toContain('react-native');
    expect(fileContent).toContain('from \'react-native\'');
  });
});
