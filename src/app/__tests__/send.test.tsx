import React from 'react';
import { render, screen, waitFor, cleanup } from '@testing-library/react-native';
import SendScreen from '../send';
import { useServer } from '@/features/server/hooks/useServer';
import { useServerStore } from '@/features/server/store/serverStore';
import { useTransferStore } from '@/features/transfer/store/transferStore';
import type { HttpModule } from '@/features/server/services/httpModule';

// Mock dependencies - only mock hooks and native modules, NOT the stores
jest.mock('@/features/server/hooks/useServer');
jest.mock('expo-keep-awake', () => ({
  activateKeepAwake: jest.fn(),
  deactivateKeepAwake: jest.fn(),
}));

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

// Import mocked module after mock setup
const KeepAwake = require('expo-keep-awake');
const mockActivateKeepAwake = KeepAwake.activateKeepAwake as jest.Mock;
const mockDeactivateKeepAwake = KeepAwake.deactivateKeepAwake as jest.Mock;

describe('SendScreen (T-904)', () => {
  let mockStartFn: jest.Mock;

  beforeEach(() => {
    cleanup();
    jest.clearAllMocks();

    // Reset the actual stores (not mocked)
    useServerStore.getState().reset();
    useTransferStore.getState().reset();

    mockStartFn = jest.fn().mockResolvedValue(undefined);
    mockUseServer.mockReturnValue({
      start: mockStartFn,
      stop: jest.fn().mockResolvedValue(undefined),
      reset: jest.fn(),
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
});
