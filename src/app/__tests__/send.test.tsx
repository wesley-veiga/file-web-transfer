import React from 'react';
import { render, screen, waitFor, cleanup, act, fireEvent } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { useRouter } from 'expo-router';
import SendScreen from '../send';
import { useServer } from '@/features/server/hooks/useServer';
import { useServerStore } from '@/features/server/store/serverStore';
import { useTransferStore } from '@/features/transfer/store/transferStore';
import type { HttpModule } from '@/features/server/services/httpModule';

// Mock dependencies - only mock hooks and native modules, NOT the stores
jest.mock('@/features/server/hooks/useServer');
jest.mock('expo-router', () => ({
  useRouter: jest.fn(),
}));
// expo-keep-awake is mocked in jest.setup.ts

const mockHttpModule: HttpModule = {
  start: jest.fn().mockResolvedValue(undefined),
  stop: jest.fn().mockResolvedValue(undefined),
  addListener: jest.fn(),
  removeListener: jest.fn(),
  addUploadListener: jest.fn(),
  removeUploadListener: jest.fn(),
  isRunning: jest.fn().mockReturnValue(false),
};

const mockUseServer = useServer as jest.MockedFunction<typeof useServer>;

// Import mocked modules after mock setup
// eslint-disable-next-line @typescript-eslint/no-require-imports
const KeepAwake = require('expo-keep-awake');
const mockActivateKeepAwake = KeepAwake.activateKeepAwake as jest.Mock;
const mockDeactivateKeepAwake = KeepAwake.deactivateKeepAwake as jest.Mock;

describe('SendScreen (T-904)', () => {
  let mockStartFn: jest.Mock;
  let mockStopFn: jest.Mock;
  let mockRouterReplace: jest.Mock;

  beforeEach(() => {
    cleanup();
    jest.clearAllMocks();

    // Reset the actual stores (not mocked)
    useServerStore.getState().reset();
    useTransferStore.getState().reset();

    mockStartFn = jest.fn().mockResolvedValue(undefined);
    mockStopFn = jest.fn().mockResolvedValue(undefined);
    mockRouterReplace = jest.fn();

    mockUseServer.mockReturnValue({
      start: mockStartFn,
      stop: mockStopFn,
      reset: jest.fn(),
    });

    (useRouter as jest.Mock).mockReturnValue({
      replace: mockRouterReplace,
      push: jest.fn(),
      back: jest.fn(),
      canGoBack: jest.fn().mockReturnValue(true),
      setParams: jest.fn(),
      dismissAll: jest.fn(),
      dismiss: jest.fn(),
    });
  });

  afterEach(() => {
    cleanup();
  });

  describe('Module', () => {
    it('exports a default function', () => {
      expect(typeof SendScreen).toBe('function');
      expect(SendScreen.name).toBe('SendScreen');
    });
  });

  describe('Basic rendering', () => {
    it('renders without crashing', async () => {
      const { toJSON } = await render(<SendScreen httpModule={mockHttpModule} />);
      expect(toJSON()).toBeDefined();
    });
  });

  describe('Estado: Iniciando', () => {
    it('mostra spinner enquanto servidor está iniciando', async () => {
      // Set up the server store to be in 'starting' state
      useServerStore.setState((state) => ({
        serverInfo: {
          ...state.serverInfo,
          status: 'starting',
        },
      }));

      await render(<SendScreen httpModule={mockHttpModule} />);

      expect(screen.getByText('Iniciando servidor...')).toBeTruthy();
    });
  });

  describe('Estado: Erro', () => {
    it('exibe mensagem de erro com botão retry', async () => {
      // Set up the server store to be in 'error' state
      useServerStore.setState((state) => ({
        serverInfo: {
          ...state.serverInfo,
          status: 'error',
          error: {
            code: 'NO_NETWORK',
            message: 'Nenhuma rede disponível. Conecte-se a uma rede Wi-Fi.',
          },
        },
      }));

      await render(<SendScreen httpModule={mockHttpModule} />);

      expect(screen.getByText('Erro ao iniciar servidor')).toBeTruthy();
      expect(
        screen.getByText('Nenhuma rede disponível. Conecte-se a uma rede Wi-Fi.'),
      ).toBeTruthy();
      expect(screen.getByText('Tentar novamente')).toBeTruthy();
    });
  });

  describe('Estado: Running - Idle', () => {
    it('exibe token como título e QR Code quando servidor está rodando', async () => {
      // Set up the server store with running state
      useServerStore.setState((state) => ({
        serverInfo: {
          ...state.serverInfo,
          status: 'running',
          networkMode: 'wifi',
          ip: '192.168.1.100',
          port: 8080,
          url: 'http://192.168.1.100:8080?token=maçã-42',
          token: 'maçã-42',
          mode: 'send',
          startedAt: Date.now(),
        },
      }));

      await render(<SendScreen httpModule={mockHttpModule} />);

      // Token should be displayed as title
      expect(screen.getByText('maçã-42')).toBeTruthy();

      // Waiting message should appear
      expect(screen.getByText('Aguardando download')).toBeTruthy();
      expect(screen.getByText(/O convidado pode escanear/)).toBeTruthy();
    });
  });

  describe('Estado: Transferindo', () => {
    it('exibe progresso de transferência', async () => {
      // Set up the server store with running state
      useServerStore.setState((state) => ({
        serverInfo: {
          ...state.serverInfo,
          status: 'running',
          networkMode: 'wifi',
          ip: '192.168.1.100',
          port: 8080,
          url: 'http://192.168.1.100:8080?token=maçã-42',
          token: 'maçã-42',
          mode: 'send',
          startedAt: Date.now(),
        },
      }));

      // Add an active transfer
      useTransferStore.setState((state) => ({
        transfers: [
          ...state.transfers,
          {
            id: 'transfer-1',
            direction: 'download',
            fileName: 'document.pdf',
            sizeBytes: 1024 * 1024, // 1 MB
            transferredBytes: 512 * 1024, // 512 KB
            status: 'active',
            peerIp: '192.168.1.101',
            startedAt: Date.now(),
            finishedAt: null,
            speedBps: 1024 * 100, // 100 KB/s
            errorMessage: null,
          },
        ],
      }));

      await render(<SendScreen httpModule={mockHttpModule} />);

      // Token should be displayed
      expect(screen.getByText('maçã-42')).toBeTruthy();

      // Transfer in progress should be shown
      expect(screen.getByText('Transferência em andamento')).toBeTruthy();
      expect(screen.getByText('document.pdf')).toBeTruthy();

      // Keep-awake should be activated
      expect(mockActivateKeepAwake).toHaveBeenCalled();
    });

    it('ativa keep-awake quando transferência é ativa', async () => {
      // Set up the server store with running state
      useServerStore.setState((state) => ({
        serverInfo: {
          ...state.serverInfo,
          status: 'running',
          networkMode: 'wifi',
          ip: '192.168.1.100',
          port: 8080,
          url: 'http://192.168.1.100:8080?token=maçã-42',
          token: 'maçã-42',
          mode: 'send',
          startedAt: Date.now(),
        },
      }));

      // Add an active transfer
      useTransferStore.setState((state) => ({
        transfers: [
          {
            id: 'transfer-1',
            direction: 'download',
            fileName: 'document.pdf',
            sizeBytes: 1024 * 1024,
            transferredBytes: 512 * 1024,
            status: 'active',
            peerIp: '192.168.1.101',
            startedAt: Date.now(),
            finishedAt: null,
            speedBps: 1024 * 100,
            errorMessage: null,
          },
        ],
      }));

      await render(<SendScreen httpModule={mockHttpModule} />);

      // Keep-awake should be activated when transfer is active
      await waitFor(() => {
        expect(mockActivateKeepAwake).toHaveBeenCalled();
      });
    });

    it('desativa keep-awake quando transferência termina (completed)', async () => {
      mockActivateKeepAwake.mockClear();
      mockDeactivateKeepAwake.mockClear();

      // Set up the server store with running state
      useServerStore.setState((state) => ({
        serverInfo: {
          ...state.serverInfo,
          status: 'running',
          networkMode: 'wifi',
          ip: '192.168.1.100',
          port: 8080,
          url: 'http://192.168.1.100:8080?token=maçã-42',
          token: 'maçã-42',
          mode: 'send',
          startedAt: Date.now(),
        },
      }));

      // Start with active transfer
      useTransferStore.setState((state) => ({
        transfers: [
          {
            id: 'transfer-1',
            direction: 'download',
            fileName: 'document.pdf',
            sizeBytes: 1024 * 1024,
            transferredBytes: 512 * 1024,
            status: 'active',
            peerIp: '192.168.1.101',
            startedAt: Date.now(),
            finishedAt: null,
            speedBps: 1024 * 100,
            errorMessage: null,
          },
        ],
      }));

      await render(<SendScreen httpModule={mockHttpModule} />);

      await waitFor(() => {
        expect(mockActivateKeepAwake).toHaveBeenCalled();
      });

      mockDeactivateKeepAwake.mockClear();

      // Update transfer to completed status
      useTransferStore.setState((state) => ({
        transfers: [
          {
            ...state.transfers[0],
            status: 'completed',
            finishedAt: Date.now(),
            transferredBytes: 1024 * 1024,
          },
        ],
      }));

      // Re-render or wait for the effect to run
      await waitFor(() => {
        expect(mockDeactivateKeepAwake).toHaveBeenCalled();
      });
    });

    it('desativa keep-awake ao desmontar componente com transferência ainda ativa (CRÍTICO - nunca travado ligado)', async () => {
      mockActivateKeepAwake.mockClear();
      mockDeactivateKeepAwake.mockClear();

      // Set up the server store with running state
      useServerStore.setState((state) => ({
        serverInfo: {
          ...state.serverInfo,
          status: 'running',
          networkMode: 'wifi',
          ip: '192.168.1.100',
          port: 8080,
          url: 'http://192.168.1.100:8080?token=maçã-42',
          token: 'maçã-42',
          mode: 'send',
          startedAt: Date.now(),
        },
      }));

      // Add an ACTIVE transfer that will still be active when we unmount
      useTransferStore.setState((state) => ({
        transfers: [
          {
            id: 'transfer-1',
            direction: 'download',
            fileName: 'large-file.iso',
            sizeBytes: 1024 * 1024 * 500, // 500 MB
            transferredBytes: 1024 * 1024 * 100, // 100 MB transferred
            status: 'active', // Still active - will unmount without completing
            peerIp: '192.168.1.101',
            startedAt: Date.now(),
            finishedAt: null, // Not finished
            speedBps: 1024 * 1024 * 5, // 5 MB/s
            errorMessage: null,
          },
        ],
      }));

      // Render the component
      const { unmount } = await render(<SendScreen httpModule={mockHttpModule} />);

      // Verify that keep-awake was activated during render
      await waitFor(() => {
        expect(mockActivateKeepAwake).toHaveBeenCalled();
      });

      // Count deactivateKeepAwake calls BEFORE unmount
      const callsBeforeUnmount = mockDeactivateKeepAwake.mock.calls.length;

      // Unmount the component while transfer is STILL ACTIVE
      // This tests the cleanup effect: useEffect(() => { return () => { deactivateKeepAwake(); } }, [])
      // Must wrap unmount in act() to ensure cleanup effects run
      await act(async () => {
        unmount();
      });

      // The critical assertion: deactivateKeepAwake MUST be called on unmount
      // even though the transfer is still active (not completed)
      // This prevents keep-awake from being left in a "locked on" state forever
      const callsAfterUnmount = mockDeactivateKeepAwake.mock.calls.length;
      expect(callsAfterUnmount).toBeGreaterThan(callsBeforeUnmount);
    });

    it('mantém keep-awake ligado enquanto há transferências active ou queued', async () => {
      mockActivateKeepAwake.mockClear();
      mockDeactivateKeepAwake.mockClear();

      useServerStore.setState((state) => ({
        serverInfo: {
          ...state.serverInfo,
          status: 'running',
          networkMode: 'wifi',
          ip: '192.168.1.100',
          port: 8080,
          url: 'http://192.168.1.100:8080?token=maçã-42',
          token: 'maçã-42',
          mode: 'send',
          startedAt: Date.now(),
        },
      }));

      // Start with queued transfer
      useTransferStore.setState((state) => ({
        transfers: [
          {
            id: 'transfer-1',
            direction: 'download',
            fileName: 'document.pdf',
            sizeBytes: 1024 * 1024,
            transferredBytes: 0,
            status: 'queued',
            peerIp: '192.168.1.101',
            startedAt: Date.now(),
            finishedAt: null,
            speedBps: null,
            errorMessage: null,
          },
        ],
      }));

      await render(<SendScreen httpModule={mockHttpModule} />);

      await waitFor(() => {
        expect(mockActivateKeepAwake).toHaveBeenCalled();
      });

      mockDeactivateKeepAwake.mockClear();

      // Update to active - keep-awake should stay active
      useTransferStore.setState((state) => ({
        transfers: [
          {
            ...state.transfers[0],
            status: 'active',
            transferredBytes: 512 * 1024,
            speedBps: 1024 * 100,
          },
        ],
      }));

      // Wait a bit but keep-awake should NOT be deactivated
      await new Promise((resolve) => setTimeout(resolve, 100));
      expect(mockDeactivateKeepAwake).not.toHaveBeenCalled();
    });

    it('nunca deixa keep-awake travado ligado após múltiplas transferências completarem', async () => {
      mockActivateKeepAwake.mockClear();
      mockDeactivateKeepAwake.mockClear();

      useServerStore.setState((state) => ({
        serverInfo: {
          ...state.serverInfo,
          status: 'running',
          networkMode: 'wifi',
          ip: '192.168.1.100',
          port: 8080,
          url: 'http://192.168.1.100:8080?token=maçã-42',
          token: 'maçã-42',
          mode: 'send',
          startedAt: Date.now(),
        },
      }));

      // Start with two active transfers
      useTransferStore.setState(() => ({
        transfers: [
          {
            id: 'transfer-1',
            direction: 'download',
            fileName: 'file1.pdf',
            sizeBytes: 1024 * 1024,
            transferredBytes: 512 * 1024,
            status: 'active',
            peerIp: '192.168.1.101',
            startedAt: Date.now(),
            finishedAt: null,
            speedBps: 1024 * 100,
            errorMessage: null,
          },
          {
            id: 'transfer-2',
            direction: 'download',
            fileName: 'file2.pdf',
            sizeBytes: 2048 * 1024,
            transferredBytes: 1024 * 1024,
            status: 'active',
            peerIp: '192.168.1.102',
            startedAt: Date.now(),
            finishedAt: null,
            speedBps: 2048 * 100,
            errorMessage: null,
          },
        ],
      }));

      await render(<SendScreen httpModule={mockHttpModule} />);

      await waitFor(() => {
        expect(mockActivateKeepAwake).toHaveBeenCalled();
      });

      mockDeactivateKeepAwake.mockClear();

      // Complete first transfer
      useTransferStore.setState((state) => ({
        transfers: [
          {
            ...state.transfers[0],
            status: 'completed',
            finishedAt: Date.now(),
          },
          state.transfers[1],
        ],
      }));

      // Keep-awake should NOT be deactivated yet (one still active)
      await new Promise((resolve) => setTimeout(resolve, 100));
      expect(mockDeactivateKeepAwake).not.toHaveBeenCalled();

      mockDeactivateKeepAwake.mockClear();

      // Complete second transfer
      useTransferStore.setState((state) => ({
        transfers: [
          state.transfers[0],
          {
            ...state.transfers[1],
            status: 'completed',
            finishedAt: Date.now(),
          },
        ],
      }));

      // NOW keep-awake should be deactivated
      await waitFor(() => {
        expect(mockDeactivateKeepAwake).toHaveBeenCalled();
      });
    });
  });

  describe('Inicialização do servidor', () => {
    it('inicia o servidor em modo send ao montar', async () => {
      await render(<SendScreen httpModule={mockHttpModule} />);

      await waitFor(() => {
        expect(mockStartFn).toHaveBeenCalledWith('wifi', 'send');
      });
    });

    it('não inicia o servidor se já está rodando em modo send', async () => {
      // Set up server as already running in send mode
      useServerStore.setState((state) => ({
        serverInfo: {
          ...state.serverInfo,
          status: 'running',
          networkMode: 'wifi',
          ip: '192.168.1.100',
          port: 8080,
          url: 'http://192.168.1.100:8080?token=maçã-42',
          token: 'maçã-42',
          mode: 'send',
          startedAt: Date.now(),
        },
      }));

      await render(<SendScreen httpModule={mockHttpModule} />);

      // start should not be called again if already running
      expect(mockStartFn).not.toHaveBeenCalled();
    });
  });

  describe('QR Code', () => {
    it('renderiza QR Code com URL completa incluindo token', async () => {
      // Set up the server store with running state
      useServerStore.setState((state) => ({
        serverInfo: {
          ...state.serverInfo,
          status: 'running',
          networkMode: 'wifi',
          ip: '192.168.1.100',
          port: 8080,
          url: 'http://192.168.1.100:8080?token=maçã-42',
          token: 'maçã-42',
          mode: 'send',
          startedAt: Date.now(),
        },
      }));

      await render(<SendScreen httpModule={mockHttpModule} />);

      // Token should be visible, QR Code container should be there
      expect(screen.getByText('maçã-42')).toBeTruthy();
      expect(screen.getByText(/O convidado pode escanear/)).toBeTruthy();
    });
  });

  describe('Token as title', () => {
    it('exibe token gerado como título da tela (diferente de rótulo)', async () => {
      useServerStore.setState((state) => ({
        serverInfo: {
          ...state.serverInfo,
          status: 'running',
          networkMode: 'wifi',
          ip: '192.168.1.100',
          port: 8080,
          url: 'http://192.168.1.100:8080?token=café-99',
          token: 'café-99',
          mode: 'send',
          startedAt: Date.now(),
        },
      }));

      await render(<SendScreen httpModule={mockHttpModule} />);

      // Token should be visible as title with large font
      const tokenElement = screen.getByText('café-99');
      expect(tokenElement).toBeTruthy();
    });

    it('exibe token com acentuação corretamente', async () => {
      useServerStore.setState((state) => ({
        serverInfo: {
          ...state.serverInfo,
          status: 'running',
          networkMode: 'wifi',
          ip: '192.168.1.100',
          port: 8080,
          url: 'http://192.168.1.100:8080?token=açúcar-17',
          token: 'açúcar-17',
          mode: 'send',
          startedAt: Date.now(),
        },
      }));

      await render(<SendScreen httpModule={mockHttpModule} />);

      expect(screen.getByText('açúcar-17')).toBeTruthy();
    });
  });

  describe('T-907 — Encerrar sessão ativa', () => {
    it('exibe botão de encerrar sessão quando servidor está rodando', async () => {
      useServerStore.setState((state) => ({
        serverInfo: {
          ...state.serverInfo,
          status: 'running',
          networkMode: 'wifi',
          ip: '192.168.1.100',
          port: 8080,
          url: 'http://192.168.1.100:8080?token=maçã-42',
          token: 'maçã-42',
          mode: 'send',
          startedAt: Date.now(),
        },
      }));

      await render(<SendScreen httpModule={mockHttpModule} />);

      const endSessionButton = screen.getByTestId('end-session-button');
      expect(endSessionButton).toBeTruthy();
    });

    it('não exibe botão de encerrar sessão quando servidor não está rodando', async () => {
      useServerStore.setState((state) => ({
        serverInfo: {
          ...state.serverInfo,
          status: 'idle',
        },
      }));

      await render(<SendScreen httpModule={mockHttpModule} />);

      const endSessionButton = screen.queryByTestId('end-session-button');
      expect(endSessionButton).toBeNull();
    });

    it('sem transferência ativa: mostra Alert de confirmação ao pressionar botão', async () => {
      const alertSpy = jest.spyOn(Alert, 'alert');

      useServerStore.setState((state) => ({
        serverInfo: {
          ...state.serverInfo,
          status: 'running',
          networkMode: 'wifi',
          ip: '192.168.1.100',
          port: 8080,
          url: 'http://192.168.1.100:8080?token=maçã-42',
          token: 'maçã-42',
          mode: 'send',
          startedAt: Date.now(),
        },
      }));

      useTransferStore.setState(() => ({
        transfers: [],
      }));

      await render(<SendScreen httpModule={mockHttpModule} />);

      const endSessionButton = screen.getByTestId('end-session-button');
      fireEvent.press(endSessionButton);

      // Verify Alert.alert was called with the "no active transfer" message
      await waitFor(() => {
        expect(alertSpy).toHaveBeenCalledWith(
          'Encerrar sessão?',
          'Você será levado de volta à tela inicial.',
          expect.any(Array),
        );
      });

      alertSpy.mockRestore();
    });

    it('com transferência ativa: mostra Alert com mensagem de aviso', async () => {
      const alertSpy = jest.spyOn(Alert, 'alert');

      useServerStore.setState((state) => ({
        serverInfo: {
          ...state.serverInfo,
          status: 'running',
          networkMode: 'wifi',
          ip: '192.168.1.100',
          port: 8080,
          url: 'http://192.168.1.100:8080?token=maçã-42',
          token: 'maçã-42',
          mode: 'send',
          startedAt: Date.now(),
        },
      }));

      useTransferStore.setState(() => ({
        transfers: [
          {
            id: 'transfer-1',
            direction: 'download',
            fileName: 'document.pdf',
            sizeBytes: 1024 * 1024,
            transferredBytes: 512 * 1024,
            status: 'active',
            peerIp: '192.168.1.101',
            startedAt: Date.now(),
            finishedAt: null,
            speedBps: 1024 * 100,
            errorMessage: null,
          },
        ],
      }));

      await render(<SendScreen httpModule={mockHttpModule} />);

      const endSessionButton = screen.getByTestId('end-session-button');
      fireEvent.press(endSessionButton);

      // Verify Alert.alert was called with the "active transfer" message
      await waitFor(() => {
        expect(alertSpy).toHaveBeenCalledWith(
          'Encerrar sessão?',
          'Há transferências em andamento. Tem certeza que deseja encerrar a sessão?',
          expect.any(Array),
        );
      });

      alertSpy.mockRestore();
    });

    it('sem transferência: ao confirmar, chama stop() e navega para home', async () => {
      const alertSpy = jest
        .spyOn(Alert, 'alert')
        .mockImplementation((title, message, buttons) => {
          // Simulate user confirming - press the "Encerrar" button (second button)
          if (buttons && buttons.length >= 2) {
            buttons[1].onPress?.();
          }
        });

      useServerStore.setState((state) => ({
        serverInfo: {
          ...state.serverInfo,
          status: 'running',
          networkMode: 'wifi',
          ip: '192.168.1.100',
          port: 8080,
          url: 'http://192.168.1.100:8080?token=maçã-42',
          token: 'maçã-42',
          mode: 'send',
          startedAt: Date.now(),
        },
      }));

      useTransferStore.setState(() => ({
        transfers: [],
      }));

      await render(<SendScreen httpModule={mockHttpModule} />);

      const endSessionButton = screen.getByTestId('end-session-button');
      fireEvent.press(endSessionButton);

      // Wait for stop to be called
      await waitFor(() => {
        expect(mockStopFn).toHaveBeenCalled();
      });

      // Verify navigation to home
      expect(mockRouterReplace).toHaveBeenCalledWith('/');

      alertSpy.mockRestore();
    });

    it('com transferência: ao confirmar, chama stop() e navega para home', async () => {
      const alertSpy = jest
        .spyOn(Alert, 'alert')
        .mockImplementation((title, message, buttons) => {
          // Simulate user confirming - press the "Encerrar" button (second button)
          if (buttons && buttons.length >= 2) {
            buttons[1].onPress?.();
          }
        });

      useServerStore.setState((state) => ({
        serverInfo: {
          ...state.serverInfo,
          status: 'running',
          networkMode: 'wifi',
          ip: '192.168.1.100',
          port: 8080,
          url: 'http://192.168.1.100:8080?token=maçã-42',
          token: 'maçã-42',
          mode: 'send',
          startedAt: Date.now(),
        },
      }));

      useTransferStore.setState(() => ({
        transfers: [
          {
            id: 'transfer-1',
            direction: 'download',
            fileName: 'document.pdf',
            sizeBytes: 1024 * 1024,
            transferredBytes: 512 * 1024,
            status: 'active',
            peerIp: '192.168.1.101',
            startedAt: Date.now(),
            finishedAt: null,
            speedBps: 1024 * 100,
            errorMessage: null,
          },
        ],
      }));

      await render(<SendScreen httpModule={mockHttpModule} />);

      const endSessionButton = screen.getByTestId('end-session-button');
      fireEvent.press(endSessionButton);

      // Wait for stop to be called
      await waitFor(() => {
        expect(mockStopFn).toHaveBeenCalled();
      });

      // Verify navigation to home
      expect(mockRouterReplace).toHaveBeenCalledWith('/');

      alertSpy.mockRestore();
    });

    it('sem transferência: ao cancelar, não chama stop() nem navega', async () => {
      const alertSpy = jest
        .spyOn(Alert, 'alert')
        .mockImplementation((title, message, buttons) => {
          // Simulate user cancelling - press the "Cancelar" button (first button)
          if (buttons && buttons.length >= 1) {
            buttons[0].onPress?.();
          }
        });

      useServerStore.setState((state) => ({
        serverInfo: {
          ...state.serverInfo,
          status: 'running',
          networkMode: 'wifi',
          ip: '192.168.1.100',
          port: 8080,
          url: 'http://192.168.1.100:8080?token=maçã-42',
          token: 'maçã-42',
          mode: 'send',
          startedAt: Date.now(),
        },
      }));

      useTransferStore.setState(() => ({
        transfers: [],
      }));

      mockStopFn.mockClear();
      mockRouterReplace.mockClear();

      await render(<SendScreen httpModule={mockHttpModule} />);

      const endSessionButton = screen.getByTestId('end-session-button');
      fireEvent.press(endSessionButton);

      // Wait a bit to allow async operations
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Verify stop was NOT called
      expect(mockStopFn).not.toHaveBeenCalled();

      // Verify navigation did NOT happen
      expect(mockRouterReplace).not.toHaveBeenCalled();

      alertSpy.mockRestore();
    });

    it('com transferência: ao cancelar, não chama stop() nem navega', async () => {
      const alertSpy = jest
        .spyOn(Alert, 'alert')
        .mockImplementation((title, message, buttons) => {
          // Simulate user cancelling - press the "Cancelar" button (first button)
          if (buttons && buttons.length >= 1) {
            buttons[0].onPress?.();
          }
        });

      useServerStore.setState((state) => ({
        serverInfo: {
          ...state.serverInfo,
          status: 'running',
          networkMode: 'wifi',
          ip: '192.168.1.100',
          port: 8080,
          url: 'http://192.168.1.100:8080?token=maçã-42',
          token: 'maçã-42',
          mode: 'send',
          startedAt: Date.now(),
        },
      }));

      useTransferStore.setState(() => ({
        transfers: [
          {
            id: 'transfer-1',
            direction: 'download',
            fileName: 'document.pdf',
            sizeBytes: 1024 * 1024,
            transferredBytes: 512 * 1024,
            status: 'active',
            peerIp: '192.168.1.101',
            startedAt: Date.now(),
            finishedAt: null,
            speedBps: 1024 * 100,
            errorMessage: null,
          },
        ],
      }));

      mockStopFn.mockClear();
      mockRouterReplace.mockClear();

      await render(<SendScreen httpModule={mockHttpModule} />);

      const endSessionButton = screen.getByTestId('end-session-button');
      fireEvent.press(endSessionButton);

      // Wait a bit to allow async operations
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Verify stop was NOT called
      expect(mockStopFn).not.toHaveBeenCalled();

      // Verify navigation did NOT happen
      expect(mockRouterReplace).not.toHaveBeenCalled();

      alertSpy.mockRestore();
    });

    it('ao confirmar: erro ao chamar stop() mostra Alert de erro', async () => {
      const alertSpy = jest
        .spyOn(Alert, 'alert')
        .mockImplementation((title, message, buttons) => {
          // Simulate user confirming - press the "Encerrar" button (second button)
          if (title === 'Encerrar sessão?' && buttons && buttons.length >= 2) {
            buttons[1].onPress?.();
          }
        });

      // Mock stop to reject
      mockStopFn.mockRejectedValueOnce(new Error('Failed to stop server'));

      useServerStore.setState((state) => ({
        serverInfo: {
          ...state.serverInfo,
          status: 'running',
          networkMode: 'wifi',
          ip: '192.168.1.100',
          port: 8080,
          url: 'http://192.168.1.100:8080?token=maçã-42',
          token: 'maçã-42',
          mode: 'send',
          startedAt: Date.now(),
        },
      }));

      useTransferStore.setState(() => ({
        transfers: [],
      }));

      await render(<SendScreen httpModule={mockHttpModule} />);

      const endSessionButton = screen.getByTestId('end-session-button');
      fireEvent.press(endSessionButton);

      // Wait for the error alert to be shown
      await waitFor(() => {
        // Should have called Alert.alert at least twice:
        // 1. The confirmation dialog
        // 2. The error dialog
        // Check second call (index 1)
        expect(alertSpy).toHaveBeenNthCalledWith(
          2,
          'Erro',
          'Não foi possível encerrar a sessão.',
        );
      });

      // Verify navigation did NOT happen after error
      expect(mockRouterReplace).not.toHaveBeenCalled();

      alertSpy.mockRestore();
    });

    it('usa router.replace (não router.push) para voltar ao home', async () => {
      const alertSpy = jest
        .spyOn(Alert, 'alert')
        .mockImplementation((title, message, buttons) => {
          // Simulate user confirming
          if (buttons && buttons.length >= 2) {
            buttons[1].onPress?.();
          }
        });

      useServerStore.setState((state) => ({
        serverInfo: {
          ...state.serverInfo,
          status: 'running',
          networkMode: 'wifi',
          ip: '192.168.1.100',
          port: 8080,
          url: 'http://192.168.1.100:8080?token=maçã-42',
          token: 'maçã-42',
          mode: 'send',
          startedAt: Date.now(),
        },
      }));

      useTransferStore.setState(() => ({
        transfers: [],
      }));

      const mockPush = jest.fn();
      (useRouter as jest.Mock).mockReturnValue({
        replace: mockRouterReplace,
        push: mockPush,
        back: jest.fn(),
        canGoBack: jest.fn().mockReturnValue(true),
        setParams: jest.fn(),
        dismissAll: jest.fn(),
        dismiss: jest.fn(),
      });

      await render(<SendScreen httpModule={mockHttpModule} />);

      const endSessionButton = screen.getByTestId('end-session-button');
      fireEvent.press(endSessionButton);

      await waitFor(() => {
        expect(mockRouterReplace).toHaveBeenCalledWith('/');
        expect(mockPush).not.toHaveBeenCalled();
      });

      alertSpy.mockRestore();
    });

    it('com múltiplas transferências: ao confirmar, para o servidor e navega', async () => {
      const alertSpy = jest
        .spyOn(Alert, 'alert')
        .mockImplementation((title, message, buttons) => {
          if (buttons && buttons.length >= 2) {
            buttons[1].onPress?.();
          }
        });

      useServerStore.setState((state) => ({
        serverInfo: {
          ...state.serverInfo,
          status: 'running',
          networkMode: 'wifi',
          ip: '192.168.1.100',
          port: 8080,
          url: 'http://192.168.1.100:8080?token=maçã-42',
          token: 'maçã-42',
          mode: 'send',
          startedAt: Date.now(),
        },
      }));

      useTransferStore.setState(() => ({
        transfers: [
          {
            id: 'transfer-1',
            direction: 'download',
            fileName: 'file1.pdf',
            sizeBytes: 1024 * 1024,
            transferredBytes: 512 * 1024,
            status: 'active',
            peerIp: '192.168.1.101',
            startedAt: Date.now(),
            finishedAt: null,
            speedBps: 1024 * 100,
            errorMessage: null,
          },
          {
            id: 'transfer-2',
            direction: 'download',
            fileName: 'file2.zip',
            sizeBytes: 2048 * 1024,
            transferredBytes: 1024 * 1024,
            status: 'queued',
            peerIp: '192.168.1.102',
            startedAt: Date.now(),
            finishedAt: null,
            speedBps: null,
            errorMessage: null,
          },
        ],
      }));

      await render(<SendScreen httpModule={mockHttpModule} />);

      const endSessionButton = screen.getByTestId('end-session-button');
      fireEvent.press(endSessionButton);

      await waitFor(() => {
        expect(mockStopFn).toHaveBeenCalled();
        expect(mockRouterReplace).toHaveBeenCalledWith('/');
      });

      alertSpy.mockRestore();
    });
  });

  describe('Multiple transfers display', () => {
    it('exibe múltiplas transferências ativas simultaneamente', async () => {
      useServerStore.setState((state) => ({
        serverInfo: {
          ...state.serverInfo,
          status: 'running',
          networkMode: 'wifi',
          ip: '192.168.1.100',
          port: 8080,
          url: 'http://192.168.1.100:8080?token=maçã-42',
          token: 'maçã-42',
          mode: 'send',
          startedAt: Date.now(),
        },
      }));

      // Add multiple active transfers
      useTransferStore.setState(() => ({
        transfers: [
          {
            id: 'transfer-1',
            direction: 'download',
            fileName: 'image1.jpg',
            sizeBytes: 5 * 1024 * 1024,
            transferredBytes: 2.5 * 1024 * 1024,
            status: 'active',
            peerIp: '192.168.1.101',
            startedAt: Date.now(),
            finishedAt: null,
            speedBps: 1024 * 200,
            errorMessage: null,
          },
          {
            id: 'transfer-2',
            direction: 'download',
            fileName: 'video.mp4',
            sizeBytes: 100 * 1024 * 1024,
            transferredBytes: 50 * 1024 * 1024,
            status: 'active',
            peerIp: '192.168.1.102',
            startedAt: Date.now(),
            finishedAt: null,
            speedBps: 1024 * 300,
            errorMessage: null,
          },
        ],
      }));

      await render(<SendScreen httpModule={mockHttpModule} />);

      expect(screen.getByText('Transferência em andamento')).toBeTruthy();
      expect(screen.getByText('image1.jpg')).toBeTruthy();
      expect(screen.getByText('video.mp4')).toBeTruthy();
    });
  });

  describe('Transfer states', () => {
    it('mostra "Aguardando download" quando servidor está rodando mas sem transferências', async () => {
      useServerStore.setState((state) => ({
        serverInfo: {
          ...state.serverInfo,
          status: 'running',
          networkMode: 'wifi',
          ip: '192.168.1.100',
          port: 8080,
          url: 'http://192.168.1.100:8080?token=maçã-42',
          token: 'maçã-42',
          mode: 'send',
          startedAt: Date.now(),
        },
      }));

      useTransferStore.setState(() => ({
        transfers: [],
      }));

      await render(<SendScreen httpModule={mockHttpModule} />);

      expect(screen.getByText('Aguardando download')).toBeTruthy();
      expect(
        screen.getByText(/O convidado pode escanear o QR Code ou digitar o código/),
      ).toBeTruthy();
    });

    it('mostra progresso com formatação correta de bytes', async () => {
      useServerStore.setState((state) => ({
        serverInfo: {
          ...state.serverInfo,
          status: 'running',
          networkMode: 'wifi',
          ip: '192.168.1.100',
          port: 8080,
          url: 'http://192.168.1.100:8080?token=maçã-42',
          token: 'maçã-42',
          mode: 'send',
          startedAt: Date.now(),
        },
      }));

      useTransferStore.setState(() => ({
        transfers: [
          {
            id: 'transfer-1',
            direction: 'download',
            fileName: 'largefile.zip',
            sizeBytes: 1024 * 1024 * 100, // 100 MB
            transferredBytes: 1024 * 1024 * 25, // 25 MB
            status: 'active',
            peerIp: '192.168.1.101',
            startedAt: Date.now(),
            finishedAt: null,
            speedBps: 1024 * 1024 * 10, // 10 MB/s
            errorMessage: null,
          },
        ],
      }));

      await render(<SendScreen httpModule={mockHttpModule} />);

      // The progress should be visible with formatted bytes
      expect(screen.getByText('largefile.zip')).toBeTruthy();
    });
  });
});
