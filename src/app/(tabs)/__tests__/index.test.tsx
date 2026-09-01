/**
 * Tests for src/app/(tabs)/index.tsx (Home Screen)
 *
 * T-001 · Bootstrap do projeto Expo
 * Testa componente HomeScreen com verificação de código e estrutura
 */

import React from 'react';
import { useColorScheme } from 'react-native';
import { render, fireEvent, cleanup } from '@testing-library/react-native';
import * as SplashScreen from 'expo-splash-screen';
import HomeScreen from '../index';
import { useServerStore } from '../../../features/server/store/serverStore';
import { useNetworkStatus } from '../../../features/server/hooks/useNetworkStatus';
import { useServer } from '../../../features/server/hooks/useServer';
import { useTransferStore } from '../../../features/transfer/store/transferStore';
import type { Transfer } from '../../../features/transfer/types';

// Type-safe mock functions
const mockedUseColorScheme = useColorScheme as jest.MockedFunction<typeof useColorScheme>;
const mockedHideAsync = SplashScreen.hideAsync as jest.MockedFunction<
  typeof SplashScreen.hideAsync
>;

jest.mock('../../../features/server/hooks/useNetworkStatus');
const mockUseNetworkStatus = useNetworkStatus as jest.MockedFunction<typeof useNetworkStatus>;

jest.mock('../../../features/server/hooks/useServer', () => ({
  useServer: jest.fn(),
}));
const mockUseServer = useServer as jest.MockedFunction<typeof useServer>;

/** Epoch fixo — nunca usamos `Date.now()` real em dados de teste. */
const FIXED_TIME = 1_700_000_000_000;

function makeTransfer(overrides: Partial<Transfer> = {}): Transfer {
  return {
    id: 't-1',
    direction: 'upload',
    fileName: 'arquivo.bin',
    sizeBytes: 1000,
    transferredBytes: 0,
    status: 'queued',
    peerIp: '192.168.0.10',
    startedAt: FIXED_TIME,
    finishedAt: null,
    speedBps: null,
    errorMessage: null,
    ...overrides,
  };
}

describe('HomeScreen (src/app/index.tsx)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedUseColorScheme.mockReturnValue('light');
    mockedHideAsync.mockResolvedValue(undefined);

    mockUseServer.mockReturnValue({
      start: jest.fn().mockResolvedValue(undefined),
      stop: jest.fn().mockResolvedValue(undefined),
      reset: jest.fn(),
    });
    mockUseNetworkStatus.mockReturnValue({ isConnected: true, ssid: 'TestNetwork' });
    useServerStore.setState({
      serverInfo: {
        status: 'idle',
        networkMode: null,
        ip: null,
        port: null,
        url: null,
        sessionId: null,
        startedAt: null,
        error: null,
      },
    });
    useTransferStore.getState().reset();
  });

  afterEach(() => {
    cleanup();
  });

  describe('Popup de Transferências (T-701)', () => {
    it('mostra o botão flutuante, mas o modal começa fechado', async () => {
      const { getByTestId, queryByTestId } = await render(<HomeScreen />);

      expect(getByTestId('transfers-fab')).toBeTruthy();
      expect(queryByTestId('transfers-modal-close')).toBeNull();
    });

    it('abre o modal com a lista de transferências ao tocar no botão flutuante', async () => {
      useTransferStore.setState({ transfers: [makeTransfer({ fileName: 'foto.jpg' })] });

      const { getByTestId, getByText } = await render(<HomeScreen />);

      await fireEvent.press(getByTestId('transfers-fab'));

      expect(getByText('foto.jpg')).toBeTruthy();
    });

    it('fecha o modal ao tocar em "Fechar"', async () => {
      const { getByTestId, queryByTestId } = await render(<HomeScreen />);

      await fireEvent.press(getByTestId('transfers-fab'));
      expect(getByTestId('transfers-modal-close')).toBeTruthy();

      await fireEvent.press(getByTestId('transfers-modal-close'));

      expect(queryByTestId('transfers-modal-close')).toBeNull();
    });

    it('não mostra badge quando não há transferências ativas', async () => {
      useTransferStore.setState({ transfers: [makeTransfer({ status: 'completed' })] });

      const { queryByTestId } = await render(<HomeScreen />);

      expect(queryByTestId('transfers-fab-badge')).toBeNull();
    });

    it('mostra badge com a contagem de transferências ativas/na fila', async () => {
      useTransferStore.setState({
        transfers: [
          makeTransfer({ id: 't-1', status: 'active' }),
          makeTransfer({ id: 't-2', status: 'queued' }),
          makeTransfer({ id: 't-3', status: 'completed' }),
        ],
      });

      const { getByTestId, getByText } = await render(<HomeScreen />);

      expect(getByTestId('transfers-fab-badge')).toBeTruthy();
      expect(getByText('2')).toBeTruthy();
    });
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

    it('component uses ServerHomeScreen from features/server (T-204)', () => {
      const fileContent = require('fs').readFileSync(
        require('path').join(__dirname, '../index.tsx'),
        'utf-8',
      );
      expect(fileContent).toContain('ServerHomeScreen');
      expect(fileContent).toContain('features/server');
    });

    it('ServerHomeScreen uses Screen component from shared/components', () => {
      const fileContent = require('fs').readFileSync(
        require('path').join(__dirname, '../../../features/server/components/ServerHomeScreen.tsx'),
        'utf-8',
      );
      expect(fileContent).toContain('Screen');
      expect(fileContent).toContain('shared/components');
    });

    it('ServerHomeScreen uses View and Text from react-native', () => {
      const fileContent = require('fs').readFileSync(
        require('path').join(__dirname, '../../../features/server/components/ServerHomeScreen.tsx'),
        'utf-8',
      );
      expect(fileContent).toContain('View');
      expect(fileContent).toContain('Text');
    });
  });

  describe('Content Verification', () => {
    it('ServerHomeScreen is the main UI component (delegated from HomeScreen)', () => {
      const fileContent = require('fs').readFileSync(
        require('path').join(__dirname, '../index.tsx'),
        'utf-8',
      );
      expect(fileContent).toContain('<ServerHomeScreen');
    });

    it('ServerHomeScreen handles server state rendering', () => {
      const fileContent = require('fs').readFileSync(
        require('path').join(__dirname, '../../../features/server/components/ServerHomeScreen.tsx'),
        'utf-8',
      );
      expect(fileContent).toContain('serverInfo.status');
      expect(fileContent).toContain('idle');
      expect(fileContent).toContain('running');
    });
  });

  describe('Theme Support Verification', () => {
    it('delegates theme handling through ServerHomeScreen', () => {
      const fileContent = require('fs').readFileSync(
        require('path').join(__dirname, '../../../features/server/components/ServerHomeScreen.tsx'),
        'utf-8',
      );
      expect(fileContent).toContain('dark:');
      expect(fileContent).toContain('className');
    });

    it('uses useEffect hook for splash screen lifecycle', () => {
      const fileContent = require('fs').readFileSync(
        require('path').join(__dirname, '../index.tsx'),
        'utf-8',
      );
      expect(fileContent).toContain('useEffect');
      expect(fileContent).toContain('expo-splash-screen');
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
    it('ServerHomeScreen uses NativeWind className for styling', () => {
      const fileContent = require('fs').readFileSync(
        require('path').join(__dirname, '../../../features/server/components/ServerHomeScreen.tsx'),
        'utf-8',
      );
      expect(fileContent).toContain('className');
    });

    it('ServerHomeScreen uses flex-1 class for full height', () => {
      const fileContent = require('fs').readFileSync(
        require('path').join(__dirname, '../../../features/server/components/ServerHomeScreen.tsx'),
        'utf-8',
      );
      expect(fileContent).toContain('flex-1');
    });

    it('ServerHomeScreen uses styling classes for layout', () => {
      const fileContent = require('fs').readFileSync(
        require('path').join(__dirname, '../../../features/server/components/ServerHomeScreen.tsx'),
        'utf-8',
      );
      expect(fileContent).toContain('px-');
      expect(fileContent).toContain('py-');
    });

    it('ServerHomeScreen uses responsive text sizing', () => {
      const fileContent = require('fs').readFileSync(
        require('path').join(__dirname, '../../../features/server/components/ServerHomeScreen.tsx'),
        'utf-8',
      );
      expect(fileContent).toContain('text-');
      expect(fileContent).toContain('font-');
    });

    it('ServerHomeScreen does not use StyleSheet.create', () => {
      const fileContent = require('fs').readFileSync(
        require('path').join(__dirname, '../../../features/server/components/ServerHomeScreen.tsx'),
        'utf-8',
      );
      expect(fileContent).not.toContain('StyleSheet.create');
    });
  });

  describe('Dependencies and Imports', () => {
    it('imports useEffect from react', () => {
      const fileContent = require('fs').readFileSync(
        require('path').join(__dirname, '../index.tsx'),
        'utf-8',
      );
      expect(fileContent).toContain("from 'react'");
      expect(fileContent).toContain('useEffect');
    });

    it('imports SplashScreen', () => {
      const fileContent = require('fs').readFileSync(
        require('path').join(__dirname, '../index.tsx'),
        'utf-8',
      );
      expect(fileContent).toContain('expo-splash-screen');
      expect(fileContent).toContain('SplashScreen');
    });

    it('imports ServerHomeScreen from features/server', () => {
      const fileContent = require('fs').readFileSync(
        require('path').join(__dirname, '../index.tsx'),
        'utf-8',
      );
      expect(fileContent).toContain('ServerHomeScreen');
      expect(fileContent).toContain('features/server');
    });

    it('ServerHomeScreen imports React Native components', () => {
      const fileContent = require('fs').readFileSync(
        require('path').join(__dirname, '../../../features/server/components/ServerHomeScreen.tsx'),
        'utf-8',
      );
      expect(fileContent).toContain('import');
      expect(fileContent).toContain('View');
      expect(fileContent).toContain('Text');
      expect(fileContent).toContain('react-native');
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

      // Verify key elements
      expect(fileContent).toContain('ServerHomeScreen');
      expect(fileContent).toContain('useEffect');
      expect(fileContent).toContain('SplashScreen');
      expect(fileContent).toContain('export default');
    });

    it('ServerHomeScreen has complete structure', () => {
      const fileContent = require('fs').readFileSync(
        require('path').join(__dirname, '../../../features/server/components/ServerHomeScreen.tsx'),
        'utf-8',
      );

      // Verify all key components are present
      expect(fileContent).toContain('Screen');
      expect(fileContent).toContain('View');
      expect(fileContent).toContain('Text');
      expect(fileContent).toContain('Button');
      expect(fileContent).toContain('Card');
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

  describe('Modal com SafeAreaView (T-803 — ajustes visuais diversos)', () => {
    it('imports SafeAreaView from react-native-safe-area-context', () => {
      const fileContent = require('fs').readFileSync(
        require('path').join(__dirname, '../index.tsx'),
        'utf-8',
      );
      expect(fileContent).toContain('SafeAreaView');
      expect(fileContent).toContain('react-native-safe-area-context');
    });

    it('Modal component is present in the file', () => {
      const fileContent = require('fs').readFileSync(
        require('path').join(__dirname, '../index.tsx'),
        'utf-8',
      );
      expect(fileContent).toContain('<Modal');
      expect(fileContent).toContain('</Modal>');
    });

    it('Modal é envolvido em SafeAreaView para respeitar safe area no topo (T-803)', () => {
      const fileContent = require('fs').readFileSync(
        require('path').join(__dirname, '../index.tsx'),
        'utf-8',
      );

      // Procura pelo padrão: <Modal...><SafeAreaView... ou <SafeAreaView dentro de Modal
      const modalMatch = fileContent.match(/<Modal[\s\S]*?<SafeAreaView/);
      expect(modalMatch).toBeTruthy();
    });

    it('SafeAreaView dentro do Modal tem className para estilos de tema', () => {
      const fileContent = require('fs').readFileSync(
        require('path').join(__dirname, '../index.tsx'),
        'utf-8',
      );

      // Verifica se SafeAreaView dentro de Modal tem className com dark:
      const safeAreaInModal = fileContent.match(
        /<Modal[\s\S]*?<SafeAreaView\s+className="[^"]*(?:dark:|flex-1)[^"]*"/,
      );
      expect(safeAreaInModal).toBeTruthy();
    });

    it('Modal renderiza corretamente com SafeAreaView no teste', async () => {
      const { getByTestId, queryByTestId } = await render(<HomeScreen />);

      // Modal começa fechado
      expect(queryByTestId('transfers-modal-close')).toBeNull();

      // Abre o modal
      await fireEvent.press(getByTestId('transfers-fab'));

      // Agora o botão "Fechar" está visível (que está dentro de SafeAreaView)
      expect(getByTestId('transfers-modal-close')).toBeTruthy();

      // Fecha o modal
      await fireEvent.press(getByTestId('transfers-modal-close'));

      // Modal está fechado novamente
      expect(queryByTestId('transfers-modal-close')).toBeNull();
    });
  });
});
