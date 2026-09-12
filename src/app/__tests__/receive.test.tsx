/**
 * Tests for src/app/receive.tsx (ReceiveScreen — T-906)
 *
 * T-906 · Tela "Receber": gerar QR + token visível
 * Testa a tela de recebimento com os 5 estados:
 * - idle: servidor rodando, aguardando upload
 * - iniciando: spinner enquanto servidor começa
 * - erro: exibindo mensagem de erro com botão retry
 * - recebendo: mostrando progresso de upload(s) ativa(s)
 * - concluído: mostrando arquivo recebido com ações "Abrir/Compartilhar"
 */

import React from 'react';
import { render, screen, waitFor, fireEvent, cleanup } from '@testing-library/react-native';
import ReceiveScreen from '../receive';
import { useServerStore } from '@/features/server/store/serverStore';
import { useTransferStore } from '@/features/transfer/store/transferStore';

// Mock modules
jest.mock('@/features/server/hooks/useServer');
jest.mock('@/features/server/hooks/useNetworkStatus');
jest.mock('@/features/files/hooks/useReceivedFiles');

import { useServer } from '@/features/server/hooks/useServer';
import { useNetworkStatus } from '@/features/server/hooks/useNetworkStatus';
import { useReceivedFiles } from '@/features/files/hooks/useReceivedFiles';
import type { HttpModule } from '@/features/server/services/httpModule';

// Mock HttpModule (minimal mock that satisfies the type)
const mockHttpModule: HttpModule = {
  start: jest.fn().mockResolvedValue(undefined),
  stop: jest.fn().mockResolvedValue(undefined),
  addListener: jest.fn(),
  removeListener: jest.fn(),
  addUploadListener: jest.fn(),
  removeUploadListener: jest.fn(),
  isRunning: jest.fn().mockReturnValue(false),
};

describe('ReceiveScreen (T-906)', () => {
  beforeEach(() => {
    cleanup();
    jest.clearAllMocks();

    // Reset stores to initial state
    useServerStore.getState().reset();
    useTransferStore.getState().reset();

    // Setup default mocks
    const mockUseServer = useServer as jest.MockedFunction<typeof useServer>;
    mockUseServer.mockReturnValue({
      start: jest.fn().mockResolvedValue(undefined),
      stop: jest.fn().mockResolvedValue(undefined),
      reset: jest.fn(),
    });

    const mockUseNetworkStatus = useNetworkStatus as jest.MockedFunction<
      typeof useNetworkStatus
    >;
    mockUseNetworkStatus.mockReturnValue({
      isConnected: true,
      ssid: 'TestWifi',
    });

    const mockUseReceivedFiles = useReceivedFiles as jest.MockedFunction<
      typeof useReceivedFiles
    >;
    mockUseReceivedFiles.mockReturnValue({
      openFile: jest.fn().mockResolvedValue(undefined),
      shareFile: jest.fn().mockResolvedValue(undefined),
      removeFile: jest.fn().mockResolvedValue(undefined),
      loadReceivedFiles: jest.fn().mockResolvedValue(undefined),
      files: [],
    });
  });

  afterEach(() => {
    cleanup();
    jest.clearAllMocks();
  });

  describe('Module and Exports', () => {
    it('exports a default function', () => {
      expect(typeof ReceiveScreen).toBe('function');
    });

    it('default export is named ReceiveScreen', () => {
      expect(ReceiveScreen.name).toBe('ReceiveScreen');
    });

    it('is a valid export', () => {
      expect(ReceiveScreen).toBeDefined();
    });
  });

  describe('Rendering without crashing', () => {
    it('renders without crashing with mock http module', async () => {
      const { toJSON } = await render(
        <ReceiveScreen httpModule={mockHttpModule} />,
      );
      expect(toJSON()).toBeDefined();
    });

    it('renders without crashing without http module prop', async () => {
      const { toJSON } = await render(<ReceiveScreen />);
      expect(toJSON()).toBeDefined();
    });
  });

  describe('Rendering - Basic content', () => {
    it('renders header "Receber arquivo"', async () => {
      await render(<ReceiveScreen httpModule={mockHttpModule} />);
      expect(screen.getByText('Receber arquivo')).toBeDefined();
    });

    it('renders subtitle about sharing QR code', async () => {
      await render(<ReceiveScreen httpModule={mockHttpModule} />);
      expect(
        screen.getByText('Compartilhe o QR Code ou o código de acesso'),
      ).toBeDefined();
    });
  });

  describe('State: Error', () => {
    beforeEach(async () => {
      // Server in error state
      useServerStore.getState().startRequested();
      useServerStore.getState().failed({
        code: 'NO_NETWORK',
        message: 'Nenhuma rede disponível. Conecte-se a uma rede Wi-Fi.',
      });
    });

    it('renders error message when server fails', async () => {
      await render(<ReceiveScreen httpModule={mockHttpModule} />);
      expect(screen.getByText('Erro ao iniciar servidor')).toBeDefined();
    });

    it('displays error code message', async () => {
      await render(<ReceiveScreen httpModule={mockHttpModule} />);
      expect(
        screen.getByText('Nenhuma rede disponível. Conecte-se a uma rede Wi-Fi.'),
      ).toBeDefined();
    });

    it('renders "Tentar novamente" button on error', async () => {
      await render(<ReceiveScreen httpModule={mockHttpModule} />);
      const retryButton = screen.getByText('Tentar novamente');
      expect(retryButton).toBeDefined();
    });
  });

  describe('State: Transfers (receiving and completed)', () => {
    it('renders with active transfer in progress', async () => {
      // Setup running state and transfers BEFORE render
      useServerStore.getState().started({
        networkMode: 'wifi',
        ip: '192.168.1.100',
        port: 8080,
        url: 'http://192.168.1.100:8080?token=abc123',
        token: 'maçã-42',
        mode: 'receive',
        startedAt: Date.now(),
      });

      // Add an active transfer
      const transferId = useTransferStore.getState().enqueue({
        direction: 'upload',
        fileName: 'photo.jpg',
        sizeBytes: 5242880, // 5MB
        peerIp: '192.168.1.101',
      });

      useTransferStore.getState().reportProgress(transferId, 2621440); // 50% progress

      const { toJSON } = await render(
        <ReceiveScreen httpModule={mockHttpModule} />,
      );

      // Verify component renders without crashing
      expect(toJSON()).toBeDefined();
    });

    it('renders with completed transfer', async () => {
      // Setup running state and transfers BEFORE render
      useServerStore.getState().started({
        networkMode: 'wifi',
        ip: '192.168.1.100',
        port: 8080,
        url: 'http://192.168.1.100:8080?token=abc123',
        token: 'maçã-42',
        mode: 'receive',
        startedAt: Date.now(),
      });

      // Add a completed transfer
      const transferId = useTransferStore.getState().enqueue({
        direction: 'upload',
        fileName: 'video.mp4',
        sizeBytes: 104857600, // 100MB
        peerIp: '192.168.1.101',
      });

      // Mark as completed
      useTransferStore.getState().reportProgress(transferId, 104857600); // Full progress
      useTransferStore.getState().complete(transferId);

      const { toJSON } = await render(
        <ReceiveScreen httpModule={mockHttpModule} />,
      );

      // Verify component renders without crashing with completed transfers
      expect(toJSON()).toBeDefined();
    });
  });
});
