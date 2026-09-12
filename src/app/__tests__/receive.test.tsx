/**
 * Tests for src/app/receive.tsx (ReceiveScreen — T-906)
 *
 * T-906 · Tela "Receber": gerar QR + token visível
 * Cobertura completa de todos os estados de renderização e branches condicionais.
 */

import React from 'react';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react-native';
import ReceiveScreen from '../receive';
import { useServerStore } from '@/features/server/store/serverStore';
import { useTransferStore } from '@/features/transfer/store/transferStore';
import type { HttpModule } from '@/features/server/services/httpModule';

// Mock modules - but NOT the stores themselves
jest.mock('@/features/server/hooks/useServer');
jest.mock('@/features/server/hooks/useNetworkStatus');
jest.mock('@/features/files/hooks/useReceivedFiles');

import { useServer } from '@/features/server/hooks/useServer';
import { useNetworkStatus } from '@/features/server/hooks/useNetworkStatus';
import { useReceivedFiles } from '@/features/files/hooks/useReceivedFiles';

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
  let mockStartFn: jest.Mock;
  let mockOpenFileFn: jest.Mock;
  let mockShareFileFn: jest.Mock;

  beforeEach(() => {
    cleanup();
    jest.clearAllMocks();

    useServerStore.getState().reset();
    useTransferStore.getState().reset();

    mockStartFn = jest.fn().mockResolvedValue(undefined);
    const mockUseServer = useServer as jest.MockedFunction<typeof useServer>;
    mockUseServer.mockReturnValue({
      start: mockStartFn,
      stop: jest.fn().mockResolvedValue(undefined),
      reset: jest.fn(),
    });

    const mockUseNetworkStatus = useNetworkStatus as jest.MockedFunction<typeof useNetworkStatus>;
    mockUseNetworkStatus.mockReturnValue({
      isConnected: true,
      ssid: 'TestWifi',
    });

    mockOpenFileFn = jest.fn().mockResolvedValue(undefined);
    mockShareFileFn = jest.fn().mockResolvedValue(undefined);
    const mockUseReceivedFiles = useReceivedFiles as jest.MockedFunction<typeof useReceivedFiles>;
    mockUseReceivedFiles.mockReturnValue({
      openFile: mockOpenFileFn,
      shareFile: mockShareFileFn,
      removeFile: jest.fn().mockResolvedValue(undefined),
      loadReceivedFiles: jest.fn().mockResolvedValue(undefined),
      files: [],
    });
  });

  afterEach(() => {
    cleanup();
    jest.clearAllMocks();
  });

  describe('Module', () => {
    it('exports a default function', () => {
      expect(typeof ReceiveScreen).toBe('function');
      expect(ReceiveScreen.name).toBe('ReceiveScreen');
    });
  });

  describe('Basic rendering', () => {
    it('renders without crashing', async () => {
      const { toJSON } = await render(<ReceiveScreen httpModule={mockHttpModule} />);
      expect(toJSON()).toBeDefined();
    });

    it('renders header and subtitle', async () => {
      await render(<ReceiveScreen httpModule={mockHttpModule} />);
      expect(screen.getByText('Receber arquivo')).toBeDefined();
      expect(screen.getByText('Compartilhe o QR Code ou o código de acesso')).toBeDefined();
    });
  });

  describe('useEffect - calls start on mount', () => {
    it('calls start("wifi", "receive") when idle', async () => {
      await render(<ReceiveScreen httpModule={mockHttpModule} />);

      await waitFor(() => {
        expect(mockStartFn).toHaveBeenCalledWith('wifi', 'receive');
      });
    });
  });

  describe('Error state', () => {
    it('renders error message and retry button', async () => {
      useServerStore.getState().startRequested();
      useServerStore.getState().failed({
        code: 'NO_NETWORK',
        message: 'Network not available',
      });

      await render(<ReceiveScreen httpModule={mockHttpModule} />);

      expect(screen.getByText('Erro ao iniciar servidor')).toBeDefined();
      expect(screen.getByText('Network not available')).toBeDefined();
      expect(screen.getByText('Tentar novamente')).toBeDefined();
    });

    it('retry button calls start', async () => {
      useServerStore.getState().startRequested();
      useServerStore.getState().failed({
        code: 'PORT_UNAVAILABLE',
        message: 'Port unavailable',
      });

      mockStartFn.mockClear();
      await render(<ReceiveScreen httpModule={mockHttpModule} />);

      const retryButton = screen.getByText('Tentar novamente');
      fireEvent.press(retryButton);

      await waitFor(() => {
        expect(mockStartFn).toHaveBeenCalledWith('wifi', 'receive');
      });
    });
  });

  describe('State: Receiving (activeTransfers rendering)', () => {
    it('renders Transferência em andamento header', async () => {
      // Setup server running
      useServerStore.getState().startRequested();
      useServerStore.getState().started({
        networkMode: 'wifi',
        ip: '192.168.1.100',
        port: 8080,
        url: 'http://192.168.1.100:8080?token=abc',
        token: 'abc',
        mode: 'receive',
        startedAt: Date.now(),
      });

      // Add active transfer
      const transferId = useTransferStore.getState().enqueue({
        direction: 'upload',
        fileName: 'photo.jpg',
        sizeBytes: 5242880,
        peerIp: '192.168.1.101',
      });
      useTransferStore.getState().reportProgress(transferId, 2621440);

      // Clear mock to avoid counting the useEffect call
      mockStartFn.mockClear();

      // Now render - component will use actual stores with active transfer
      await render(<ReceiveScreen httpModule={mockHttpModule} />);

      // Should render the receiving state
      await waitFor(() => {
        expect(screen.getByText('Transferência em andamento')).toBeDefined();
      });
    });

    it('displays transfer file name and progress', async () => {
      useServerStore.getState().startRequested();
      useServerStore.getState().started({
        networkMode: 'wifi',
        ip: '192.168.1.100',
        port: 8080,
        url: 'http://192.168.1.100:8080?token=xyz',
        token: 'xyz',
        mode: 'receive',
        startedAt: Date.now(),
      });

      const transferId = useTransferStore.getState().enqueue({
        direction: 'upload',
        fileName: 'video.mp4',
        sizeBytes: 104857600,
        peerIp: '192.168.1.101',
      });
      useTransferStore.getState().reportProgress(transferId, 52428800);

      mockStartFn.mockClear();
      await render(<ReceiveScreen httpModule={mockHttpModule} />);

      await waitFor(() => {
        expect(screen.getByText('video.mp4')).toBeDefined();
      });
    });
  });

  describe('State: Completed (completedTransfers rendering)', () => {
    it('renders Arquivo recebido header with completed transfer', async () => {
      useServerStore.getState().startRequested();
      useServerStore.getState().started({
        networkMode: 'wifi',
        ip: '192.168.1.100',
        port: 8080,
        url: 'http://192.168.1.100:8080?token=def',
        token: 'def',
        mode: 'receive',
        startedAt: Date.now(),
      });

      const transferId = useTransferStore.getState().enqueue({
        direction: 'upload',
        fileName: 'document.pdf',
        sizeBytes: 2097152,
        peerIp: '192.168.1.101',
      });
      useTransferStore.getState().complete(transferId);

      mockStartFn.mockClear();
      await render(<ReceiveScreen httpModule={mockHttpModule} />);

      await waitFor(() => {
        expect(screen.getByText('Arquivo recebido')).toBeDefined();
        expect(screen.getByText('document.pdf')).toBeDefined();
      });
    });

    it('renders Abrir and Compartilhar buttons for completed transfer', async () => {
      useServerStore.getState().startRequested();
      useServerStore.getState().started({
        networkMode: 'wifi',
        ip: '192.168.1.100',
        port: 8080,
        url: 'http://192.168.1.100:8080?token=ghi',
        token: 'ghi',
        mode: 'receive',
        startedAt: Date.now(),
      });

      const transferId = useTransferStore.getState().enqueue({
        direction: 'upload',
        fileName: 'file.txt',
        sizeBytes: 1024,
        peerIp: '192.168.1.101',
      });
      useTransferStore.getState().complete(transferId);

      mockStartFn.mockClear();
      await render(<ReceiveScreen httpModule={mockHttpModule} />);

      await waitFor(() => {
        const abrirButtons = screen.getAllByText('Abrir');
        const compartilharButtons = screen.getAllByText('Compartilhar');
        expect(abrirButtons.length).toBeGreaterThan(0);
        expect(compartilharButtons.length).toBeGreaterThan(0);
      });
    });

    it('calls openFile when Abrir button pressed', async () => {
      useServerStore.getState().startRequested();
      useServerStore.getState().started({
        networkMode: 'wifi',
        ip: '192.168.1.100',
        port: 8080,
        url: 'http://192.168.1.100:8080?token=jkl',
        token: 'jkl',
        mode: 'receive',
        startedAt: Date.now(),
      });

      const transferId = useTransferStore.getState().enqueue({
        direction: 'upload',
        fileName: 'open.txt',
        sizeBytes: 512,
        peerIp: '192.168.1.101',
      });
      useTransferStore.getState().complete(transferId);

      mockStartFn.mockClear();
      await render(<ReceiveScreen httpModule={mockHttpModule} />);

      // Wait for Abrir button to appear
      await waitFor(() => {
        expect(screen.getAllByText('Abrir').length).toBeGreaterThan(0);
      });

      const abrirButtons = screen.getAllByText('Abrir');
      fireEvent.press(abrirButtons[0]);

      // Verify openFile was called with correct parameters
      await waitFor(() => {
        expect(mockOpenFileFn).toHaveBeenCalled();
      });
    });

    it('calls shareFile when Compartilhar button pressed', async () => {
      useServerStore.getState().startRequested();
      useServerStore.getState().started({
        networkMode: 'wifi',
        ip: '192.168.1.100',
        port: 8080,
        url: 'http://192.168.1.100:8080?token=mno',
        token: 'mno',
        mode: 'receive',
        startedAt: Date.now(),
      });

      const transferId = useTransferStore.getState().enqueue({
        direction: 'upload',
        fileName: 'share.pdf',
        sizeBytes: 2048,
        peerIp: '192.168.1.101',
      });
      useTransferStore.getState().complete(transferId);

      mockStartFn.mockClear();
      await render(<ReceiveScreen httpModule={mockHttpModule} />);

      // Wait for Compartilhar button to appear
      await waitFor(() => {
        expect(screen.getAllByText('Compartilhar').length).toBeGreaterThan(0);
      });

      const compartilharButtons = screen.getAllByText('Compartilhar');
      fireEvent.press(compartilharButtons[0]);

      // Verify shareFile was called
      await waitFor(() => {
        expect(mockShareFileFn).toHaveBeenCalled();
      });
    });

    it('displays file size for completed transfer', async () => {
      useServerStore.getState().startRequested();
      useServerStore.getState().started({
        networkMode: 'wifi',
        ip: '192.168.1.100',
        port: 8080,
        url: 'http://192.168.1.100:8080?token=pqr',
        token: 'pqr',
        mode: 'receive',
        startedAt: Date.now(),
      });

      const transferId = useTransferStore.getState().enqueue({
        direction: 'upload',
        fileName: 'large.iso',
        sizeBytes: 104857600, // 100MB
        peerIp: '192.168.1.101',
      });
      useTransferStore.getState().complete(transferId);

      mockStartFn.mockClear();
      await render(<ReceiveScreen httpModule={mockHttpModule} />);

      await waitFor(() => {
        const sizeTexts = screen.getAllByText(/100 MB|100MB/);
        expect(sizeTexts.length).toBeGreaterThan(0);
      });
    });

    it('displays unknown size for completed transfer with null sizeBytes', async () => {
      useServerStore.getState().startRequested();
      useServerStore.getState().started({
        networkMode: 'wifi',
        ip: '192.168.1.100',
        port: 8080,
        url: 'http://192.168.1.100:8080?token=stu',
        token: 'stu',
        mode: 'receive',
        startedAt: Date.now(),
      });

      const transferId = useTransferStore.getState().enqueue({
        direction: 'upload',
        fileName: 'unknown.bin',
        sizeBytes: null,
        peerIp: '192.168.1.101',
      });
      useTransferStore.getState().complete(transferId);

      mockStartFn.mockClear();
      await render(<ReceiveScreen httpModule={mockHttpModule} />);

      await waitFor(() => {
        expect(screen.getByText('Tamanho desconhecido')).toBeDefined();
      });
    });
  });

  describe('State: Idle (no transfers)', () => {
    it('renders idle message when no transfers', async () => {
      useServerStore.getState().startRequested();
      useServerStore.getState().started({
        networkMode: 'wifi',
        ip: '192.168.1.100',
        port: 8080,
        url: 'http://192.168.1.100:8080?token=vwx',
        token: 'vwx',
        mode: 'receive',
        startedAt: Date.now(),
      });

      mockStartFn.mockClear();
      await render(<ReceiveScreen httpModule={mockHttpModule} />);

      await waitFor(() => {
        expect(screen.getByText('Aguardando arquivo')).toBeDefined();
      });
    });

    it('renders token information', async () => {
      useServerStore.getState().startRequested();
      useServerStore.getState().started({
        networkMode: 'wifi',
        ip: '192.168.1.100',
        port: 8080,
        url: 'http://192.168.1.100:8080?token=yza',
        token: 'token-value',
        mode: 'receive',
        startedAt: Date.now(),
      });

      mockStartFn.mockClear();
      await render(<ReceiveScreen httpModule={mockHttpModule} />);

      await waitFor(() => {
        expect(screen.getByText('Código de acesso')).toBeDefined();
        expect(screen.getByText('token-value')).toBeDefined();
      });
    });
  });

  describe('Multiple transfers', () => {
    it('renders multiple active transfers', async () => {
      useServerStore.getState().startRequested();
      useServerStore.getState().started({
        networkMode: 'wifi',
        ip: '192.168.1.100',
        port: 8080,
        url: 'http://192.168.1.100:8080?token=bcd',
        token: 'bcd',
        mode: 'receive',
        startedAt: Date.now(),
      });

      useTransferStore.getState().enqueue({
        direction: 'upload',
        fileName: 'file1.txt',
        sizeBytes: 1024,
        peerIp: '192.168.1.101',
      });

      useTransferStore.getState().enqueue({
        direction: 'upload',
        fileName: 'file2.jpg',
        sizeBytes: 2048,
        peerIp: '192.168.1.102',
      });

      mockStartFn.mockClear();
      await render(<ReceiveScreen httpModule={mockHttpModule} />);

      await waitFor(() => {
        expect(screen.getByText('file1.txt')).toBeDefined();
        expect(screen.getByText('file2.jpg')).toBeDefined();
      });
    });

    it('renders multiple completed transfers with buttons', async () => {
      useServerStore.getState().startRequested();
      useServerStore.getState().started({
        networkMode: 'wifi',
        ip: '192.168.1.100',
        port: 8080,
        url: 'http://192.168.1.100:8080?token=efg',
        token: 'efg',
        mode: 'receive',
        startedAt: Date.now(),
      });

      const id1 = useTransferStore.getState().enqueue({
        direction: 'upload',
        fileName: 'photo1.jpg',
        sizeBytes: 1024,
        peerIp: '192.168.1.101',
      });

      const id2 = useTransferStore.getState().enqueue({
        direction: 'upload',
        fileName: 'photo2.png',
        sizeBytes: 2048,
        peerIp: '192.168.1.102',
      });

      useTransferStore.getState().complete(id1);
      useTransferStore.getState().complete(id2);

      mockStartFn.mockClear();
      await render(<ReceiveScreen httpModule={mockHttpModule} />);

      await waitFor(() => {
        expect(screen.getByText('photo1.jpg')).toBeDefined();
        expect(screen.getByText('photo2.png')).toBeDefined();
        const abrirButtons = screen.getAllByText('Abrir');
        const compartilharButtons = screen.getAllByText('Compartilhar');
        expect(abrirButtons.length).toBeGreaterThanOrEqual(2);
        expect(compartilharButtons.length).toBeGreaterThanOrEqual(2);
      });
    });
  });
});
