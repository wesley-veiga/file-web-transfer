/**
 * Handlers test suite for ServerHomeScreen component (T-204)
 *
 * Tests button press handlers that execute real logic:
 * - handleStartPress: starts server with 'wifi'
 * - handleStopPress: shows Alert and stops server
 * - handleRetryPress: retries the server start
 */

import React from 'react';
import { render, fireEvent, cleanup } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { ServerHomeScreen } from '../ServerHomeScreen';
import { useServerStore } from '../../store/serverStore';
import { useNetworkStatus } from '../../hooks/useNetworkStatus';
import type { HttpModule } from '../../services/httpModule';
import { useServer } from '../../hooks/useServer';

// Mock hooks
jest.mock('../../hooks/useNetworkStatus');
const mockUseNetworkStatus = useNetworkStatus as jest.MockedFunction<typeof useNetworkStatus>;

jest.mock('../../hooks/useServer', () => ({
  useServer: jest.fn(),
}));
const mockUseServer = useServer as jest.MockedFunction<
  (httpModule?: HttpModule) => {
    start: (networkMode: 'wifi') => Promise<void>;
    stop: () => Promise<void>;
    reset: () => void;
  }
>;

describe('ServerHomeScreen handlers (T-204)', () => {
  let mockStartFn: jest.Mock;
  let mockStopFn: jest.Mock;

  beforeEach(() => {
    cleanup();
    jest.clearAllMocks();

    // Setup mocks
    mockStartFn = jest.fn().mockResolvedValue(undefined);
    mockStopFn = jest.fn().mockResolvedValue(undefined);

    mockUseServer.mockReturnValue({
      start: mockStartFn,
      stop: mockStopFn,
      reset: jest.fn(),
    });

    mockUseNetworkStatus.mockReturnValue({
      isConnected: true,
      ssid: 'TestNetwork',
    });

    // Reset Zustand store
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
  });

  afterEach(() => {
    cleanup();
  });

  describe('handleStartPress', () => {
    it('chama start("wifi") ao pressionar o botão', async () => {
      const { getByText } = await render(<ServerHomeScreen />);
      fireEvent.press(getByText('Iniciar servidor').parent!);
      expect(mockStartFn).toHaveBeenCalledWith('wifi');
    });

    it('loga erro quando start rejeita', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      mockStartFn.mockRejectedValueOnce(new Error('Start failed'));
      const { getByText } = await render(<ServerHomeScreen />);
      fireEvent.press(getByText('Iniciar servidor').parent!);
      await new Promise((r) => setTimeout(r, 0)); // deixa a promise do handler resolver
      expect(consoleErrorSpy).toHaveBeenCalled();
      consoleErrorSpy.mockRestore();
    });
  });

  describe('handleStopPress', () => {
    beforeEach(() => {
      useServerStore.setState({
        serverInfo: {
          status: 'running',
          networkMode: 'wifi',
          ip: '192.168.1.10',
          port: 8080,
          url: 'http://192.168.1.10:8080',
          sessionId: 'test-123',
          startedAt: Date.now(),
          error: null,
        },
      });
    });

    it('mostra Alert e chama stop() ao confirmar "Parar"', async () => {
      const alertSpy = jest.spyOn(Alert, 'alert');
      const { getByText } = await render(<ServerHomeScreen />);
      fireEvent.press(getByText('Parar servidor').parent!);
      expect(alertSpy).toHaveBeenCalled();
      const buttons = alertSpy.mock.calls[0][2] as {
        text: string;
        onPress?: () => void;
      }[];
      const stopBtn = buttons.find((b) => b.text === 'Parar');
      await stopBtn!.onPress!();
      expect(mockStopFn).toHaveBeenCalled();
    });

    it('loga erro quando stop rejeita', async () => {
      mockStopFn.mockRejectedValueOnce(new Error('Stop failed'));
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      const alertSpy = jest.spyOn(Alert, 'alert');
      const { getByText } = await render(<ServerHomeScreen />);
      fireEvent.press(getByText('Parar servidor').parent!);
      const buttons = alertSpy.mock.calls[0][2] as {
        text: string;
        onPress?: () => void;
      }[];
      const stopBtn = buttons.find((b) => b.text === 'Parar');
      await stopBtn!.onPress!();
      expect(consoleErrorSpy).toHaveBeenCalled();
      consoleErrorSpy.mockRestore();
    });
  });

  describe('handleRetryPress', () => {
    it('chama start("wifi") quando há rede', async () => {
      useServerStore.setState({
        serverInfo: {
          status: 'error',
          networkMode: null,
          ip: null,
          port: null,
          url: null,
          sessionId: null,
          startedAt: null,
          error: { code: 'UNKNOWN', message: 'Algo deu errado' },
        },
      });
      mockUseNetworkStatus.mockReturnValue({ isConnected: true, ssid: 'MyWiFi' });
      const { getByText } = await render(<ServerHomeScreen />);
      fireEvent.press(getByText('Tentar novamente').parent!);
      expect(mockStartFn).toHaveBeenCalledWith('wifi');
    });

    it('chama start("wifi") mesmo sem rede (usuário deve conectar-se antes)', async () => {
      useServerStore.setState({
        serverInfo: {
          status: 'error',
          networkMode: null,
          ip: null,
          port: null,
          url: null,
          sessionId: null,
          startedAt: null,
          error: { code: 'NO_NETWORK', message: 'Sem rede' },
        },
      });
      mockUseNetworkStatus.mockReturnValue({ isConnected: false, ssid: null });
      const { getByText } = await render(<ServerHomeScreen />);
      fireEvent.press(getByText('Tentar novamente').parent!);
      expect(mockStartFn).toHaveBeenCalledWith('wifi');
    });

    it('loga erro quando start rejeita', async () => {
      useServerStore.setState({
        serverInfo: {
          status: 'error',
          networkMode: null,
          ip: null,
          port: null,
          url: null,
          sessionId: null,
          startedAt: null,
          error: { code: 'UNKNOWN', message: 'Algo deu errado' },
        },
      });
      mockStartFn.mockRejectedValueOnce(new Error('Retry failed'));
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      const { getByText } = await render(<ServerHomeScreen />);
      fireEvent.press(getByText('Tentar novamente').parent!);
      await new Promise((r) => setTimeout(r, 0));
      expect(consoleErrorSpy).toHaveBeenCalled();
      consoleErrorSpy.mockRestore();
    });
  });
});
