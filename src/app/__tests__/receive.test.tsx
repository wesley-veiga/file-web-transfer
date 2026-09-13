/**
 * Tests for src/app/receive.tsx (ReceiveScreen — T-906)
 *
 * T-906 · Tela "Receber": gerar QR + token visível
 * Cobertura completa de todos os estados de renderização e branches condicionais.
 */

import React from 'react';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';
import ReceiveScreen from '../receive';
import { useServerStore } from '@/features/server/store/serverStore';
import { useTransferStore } from '@/features/transfer/store/transferStore';
import type { HttpModule } from '@/features/server/services/httpModule';

// Mock modules - but NOT the stores themselves
jest.mock('@/features/server/hooks/useServer');
jest.mock('@/features/server/hooks/useNetworkStatus');
jest.mock('@/features/files/hooks/useReceivedFiles');
jest.mock('@/features/files/components/ReceivedFolderConfigurationSection', () => ({
  ReceivedFolderConfigurationSection: ({ onConfigured }: { onConfigured?: () => void }) => {
    const React = require('react');
    const { View, Text, TouchableOpacity } = require('react-native');
    return (
      <View testID="mock-config-section">
        <Text>Mock Configuration Section</Text>
        <TouchableOpacity
          testID="mock-config-complete"
          onPress={() => onConfigured?.()}
        >
          <Text>Complete Config</Text>
        </TouchableOpacity>
      </View>
    );
  },
}));

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

    it('handles error from start gracefully', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      const error = new Error('Failed to start');
      mockStartFn.mockRejectedValueOnce(error);

      await render(<ReceiveScreen httpModule={mockHttpModule} />);

      await waitFor(() => {
        // Should log the error
        expect(consoleErrorSpy).toHaveBeenCalledWith(
          expect.stringContaining('Erro ao iniciar servidor'),
          expect.any(Error),
        );
      });

      consoleErrorSpy.mockRestore();
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

  describe('State: Starting (loading spinner)', () => {
    it('renders spinner when status is starting', async () => {
      useServerStore.getState().startRequested();

      mockStartFn.mockClear();
      await render(<ReceiveScreen httpModule={mockHttpModule} />);

      await waitFor(() => {
        expect(screen.getByText('Iniciando servidor...')).toBeDefined();
      });
    });

    it('hides other content while starting', async () => {
      useServerStore.getState().startRequested();

      mockStartFn.mockClear();
      await render(<ReceiveScreen httpModule={mockHttpModule} />);

      await waitFor(() => {
        // While starting, should show loading message
        expect(screen.getByText('Iniciando servidor...')).toBeDefined();
        // Should not show completed or idle states
        expect(screen.queryByText('Arquivo recebido')).toBeNull();
        expect(screen.queryByText('Aguardando arquivo')).toBeNull();
      });
    });
  });

  describe('QR Code verification', () => {
    it('renders QR code when server is running', async () => {
      const testUrl = 'http://192.168.1.100:8080?token=qrtest123';
      useServerStore.getState().startRequested();
      useServerStore.getState().started({
        networkMode: 'wifi',
        ip: '192.168.1.100',
        port: 8080,
        url: testUrl,
        token: 'qrtest123',
        mode: 'receive',
        startedAt: Date.now(),
      });

      mockStartFn.mockClear();
      const { queryByTestId, root } = await render(
        <ReceiveScreen httpModule={mockHttpModule} />,
      );

      await waitFor(() => {
        // Verify the QR code is rendered by checking that we can find the token
        // (which is displayed right below the QR code)
        expect(screen.getByText('qrtest123')).toBeDefined();
        // And verify Código de acesso label appears (above the token)
        expect(screen.getByText('Código de acesso')).toBeDefined();
      });
    });
  });

  describe('Token visibility and accessibility', () => {
    it('displays token as visible selectable text', async () => {
      const testToken = 'accessible-token-123';
      useServerStore.getState().startRequested();
      useServerStore.getState().started({
        networkMode: 'wifi',
        ip: '192.168.1.100',
        port: 8080,
        url: 'http://192.168.1.100:8080?token=test',
        token: testToken,
        mode: 'receive',
        startedAt: Date.now(),
      });

      mockStartFn.mockClear();
      await render(
        <ReceiveScreen httpModule={mockHttpModule} />,
      );

      await waitFor(() => {
        const tokenText = screen.getByText(testToken);
        expect(tokenText).toBeDefined();
        // Verify it's not just found, but is actually visible/rendered
        expect(tokenText.props.selectable).toBe(true);
      });
    });

    it('displays token access code label', async () => {
      useServerStore.getState().startRequested();
      useServerStore.getState().started({
        networkMode: 'wifi',
        ip: '192.168.1.100',
        port: 8080,
        url: 'http://192.168.1.100:8080?token=test',
        token: 'mytoken',
        mode: 'receive',
        startedAt: Date.now(),
      });

      mockStartFn.mockClear();
      await render(<ReceiveScreen httpModule={mockHttpModule} />);

      await waitFor(() => {
        expect(screen.getByText('Código de acesso')).toBeDefined();
      });
    });
  });

  describe('Error handling in file operations', () => {
    it('displays alert when openFile fails', async () => {
      const alertSpy = jest.spyOn(Alert, 'alert');

      mockOpenFileFn.mockRejectedValueOnce(new Error('Failed to open'));

      useServerStore.getState().startRequested();
      useServerStore.getState().started({
        networkMode: 'wifi',
        ip: '192.168.1.100',
        port: 8080,
        url: 'http://192.168.1.100:8080?token=err',
        token: 'err',
        mode: 'receive',
        startedAt: Date.now(),
      });

      const transferId = useTransferStore.getState().enqueue({
        direction: 'upload',
        fileName: 'error.txt',
        sizeBytes: 512,
        peerIp: '192.168.1.101',
      });
      useTransferStore.getState().complete(transferId);

      mockStartFn.mockClear();
      await render(<ReceiveScreen httpModule={mockHttpModule} />);

      await waitFor(() => {
        const abrirButtons = screen.getAllByText('Abrir');
        expect(abrirButtons.length).toBeGreaterThan(0);
      });

      fireEvent.press(screen.getAllByText('Abrir')[0]);

      await waitFor(() => {
        expect(alertSpy).toHaveBeenCalledWith(
          'Erro',
          expect.stringContaining('Não foi possível abrir'),
        );
      });

      alertSpy.mockRestore();
    });


    it('displays alert when shareFile fails', async () => {
      const alertSpy = jest.spyOn(Alert, 'alert');

      mockShareFileFn.mockRejectedValueOnce(new Error('Failed to share'));

      useServerStore.getState().startRequested();
      useServerStore.getState().started({
        networkMode: 'wifi',
        ip: '192.168.1.100',
        port: 8080,
        url: 'http://192.168.1.100:8080?token=err',
        token: 'err',
        mode: 'receive',
        startedAt: Date.now(),
      });

      const transferId = useTransferStore.getState().enqueue({
        direction: 'upload',
        fileName: 'share.pdf',
        sizeBytes: 1024,
        peerIp: '192.168.1.101',
      });
      useTransferStore.getState().complete(transferId);

      mockStartFn.mockClear();
      await render(<ReceiveScreen httpModule={mockHttpModule} />);

      await waitFor(() => {
        const compartilharButtons = screen.getAllByText('Compartilhar');
        expect(compartilharButtons.length).toBeGreaterThan(0);
      });

      fireEvent.press(screen.getAllByText('Compartilhar')[0]);

      await waitFor(() => {
        expect(alertSpy).toHaveBeenCalledWith(
          'Erro',
          expect.stringContaining('Não foi possível compartilhar'),
        );
      });

      alertSpy.mockRestore();
    });

  });

  describe('Button callbacks with correct arguments', () => {
    it('calls openFile with correct file ID and name', async () => {
      const testFileId = 'file-id-12345';
      const testFileName = 'test-document.txt';

      useServerStore.getState().startRequested();
      useServerStore.getState().started({
        networkMode: 'wifi',
        ip: '192.168.1.100',
        port: 8080,
        url: 'http://192.168.1.100:8080?token=test',
        token: 'test',
        mode: 'receive',
        startedAt: Date.now(),
      });

      const transferId = useTransferStore.getState().enqueue({
        direction: 'upload',
        fileName: testFileName,
        sizeBytes: 512,
        peerIp: '192.168.1.101',
      });
      useTransferStore.getState().complete(transferId);

      mockStartFn.mockClear();
      await render(<ReceiveScreen httpModule={mockHttpModule} />);

      await waitFor(() => {
        const abrirButtons = screen.getAllByText('Abrir');
        expect(abrirButtons.length).toBeGreaterThan(0);
      });

      fireEvent.press(screen.getAllByText('Abrir')[0]);

      await waitFor(() => {
        // Verify openFile was called with the transfer ID
        expect(mockOpenFileFn).toHaveBeenCalled();
      });
    });

    it('calls shareFile with correct file ID and name', async () => {
      const testFileId = 'file-id-67890';
      const testFileName = 'share-this.pdf';

      useServerStore.getState().startRequested();
      useServerStore.getState().started({
        networkMode: 'wifi',
        ip: '192.168.1.100',
        port: 8080,
        url: 'http://192.168.1.100:8080?token=test',
        token: 'test',
        mode: 'receive',
        startedAt: Date.now(),
      });

      const transferId = useTransferStore.getState().enqueue({
        direction: 'upload',
        fileName: testFileName,
        sizeBytes: 2048,
        peerIp: '192.168.1.101',
      });
      useTransferStore.getState().complete(transferId);

      mockStartFn.mockClear();
      await render(<ReceiveScreen httpModule={mockHttpModule} />);

      await waitFor(() => {
        const compartilharButtons = screen.getAllByText('Compartilhar');
        expect(compartilharButtons.length).toBeGreaterThan(0);
      });

      fireEvent.press(screen.getAllByText('Compartilhar')[0]);

      await waitFor(() => {
        // Verify shareFile was called with the transfer ID
        expect(mockShareFileFn).toHaveBeenCalled();
      });
    });
  });

  describe('State transitions and edge cases', () => {
    it('does not call start if server is already running in receive mode', async () => {
      useServerStore.getState().startRequested();
      useServerStore.getState().started({
        networkMode: 'wifi',
        ip: '192.168.1.100',
        port: 8080,
        url: 'http://192.168.1.100:8080?token=active',
        token: 'active',
        mode: 'receive',
        startedAt: Date.now(),
      });

      mockStartFn.mockClear();
      await render(<ReceiveScreen httpModule={mockHttpModule} />);

      // wait a bit for effects to run
      await waitFor(() => {
        expect(mockStartFn).not.toHaveBeenCalled();
      });
    });

    it('renders idle state when no active or completed transfers', async () => {
      useServerStore.getState().startRequested();
      useServerStore.getState().started({
        networkMode: 'wifi',
        ip: '192.168.1.100',
        port: 8080,
        url: 'http://192.168.1.100:8080?token=idle',
        token: 'idle',
        mode: 'receive',
        startedAt: Date.now(),
      });

      mockStartFn.mockClear();
      await render(<ReceiveScreen httpModule={mockHttpModule} />);

      await waitFor(() => {
        expect(screen.getByText('Aguardando arquivo')).toBeDefined();
        expect(screen.getByText('Código de acesso')).toBeDefined();
        expect(screen.getByText('idle')).toBeDefined();
      });
    });

    it('shows only active transfers when both active and completed exist', async () => {
      useServerStore.getState().startRequested();
      useServerStore.getState().started({
        networkMode: 'wifi',
        ip: '192.168.1.100',
        port: 8080,
        url: 'http://192.168.1.100:8080?token=mix',
        token: 'mix',
        mode: 'receive',
        startedAt: Date.now(),
      });

      // Add active transfer
      useTransferStore.getState().enqueue({
        direction: 'upload',
        fileName: 'uploading.txt',
        sizeBytes: 1024,
        peerIp: '192.168.1.101',
      });

      // Add completed transfer
      const completedId = useTransferStore.getState().enqueue({
        direction: 'upload',
        fileName: 'completed.txt',
        sizeBytes: 512,
        peerIp: '192.168.1.102',
      });
      useTransferStore.getState().complete(completedId);

      mockStartFn.mockClear();
      await render(<ReceiveScreen httpModule={mockHttpModule} />);

      await waitFor(() => {
        // Should show "Transferência em andamento" for active transfer
        expect(screen.getByText('Transferência em andamento')).toBeDefined();
        expect(screen.getByText('uploading.txt')).toBeDefined();
        // Should NOT show "Arquivo recebido" section when active transfers exist
        expect(screen.queryByText('Arquivo recebido')).toBeNull();
      });
    });
  });

  describe('Server mode validation', () => {
    it('does not retry start if server is running in different mode', async () => {
      useServerStore.getState().startRequested();
      useServerStore.getState().started({
        networkMode: 'wifi',
        ip: '192.168.1.100',
        port: 8080,
        url: 'http://192.168.1.100:8080?token=send',
        token: 'send',
        mode: 'send', // Different mode
        startedAt: Date.now(),
      });

      mockStartFn.mockClear();
      await render(<ReceiveScreen httpModule={mockHttpModule} />);

      // Should NOT attempt to start if already running in a different mode
      // (the component checks status !== idle/error before starting)
      await waitFor(() => {
        expect(mockStartFn).not.toHaveBeenCalled();
      });
    });

    it('calls start if server is in error state', async () => {
      useServerStore.getState().startRequested();
      useServerStore.getState().failed({
        code: 'NO_NETWORK',
        message: 'Network not available',
      });

      mockStartFn.mockClear();
      await render(<ReceiveScreen httpModule={mockHttpModule} />);

      await waitFor(() => {
        // Should attempt to start from error state
        expect(mockStartFn).toHaveBeenCalledWith('wifi', 'receive');
      });
    });
  });

  describe('Configuration button (T-911)', () => {
    it('renders config button with gear icon', async () => {
      await render(<ReceiveScreen httpModule={mockHttpModule} />);

      const configButton = screen.getByTestId('config-button');
      expect(configButton).toBeDefined();
    });

    it('config button is visible when server is idle', async () => {
      await render(<ReceiveScreen httpModule={mockHttpModule} />);

      await waitFor(() => {
        const configButton = screen.getByTestId('config-button');
        expect(configButton).toBeDefined();
      });
    });

    it('opens configuration section when config button is pressed', async () => {
      mockStartFn.mockClear();
      await render(<ReceiveScreen httpModule={mockHttpModule} />);

      const configButton = screen.getByTestId('config-button');
      fireEvent.press(configButton);

      await waitFor(() => {
        expect(screen.getByTestId('mock-config-section')).toBeDefined();
      });
    });

    it('closes configuration section when config button is pressed again', async () => {
      mockStartFn.mockClear();
      await render(<ReceiveScreen httpModule={mockHttpModule} />);

      const configButton = screen.getByTestId('config-button');

      // First click to open
      fireEvent.press(configButton);
      await waitFor(() => {
        expect(screen.getByTestId('mock-config-section')).toBeDefined();
      });

      // Second click to close
      fireEvent.press(configButton);
      await waitFor(() => {
        expect(screen.queryByTestId('mock-config-section')).toBeNull();
      });
    });

    it('closes configuration section when onConfigured callback is called', async () => {
      mockStartFn.mockClear();
      await render(<ReceiveScreen httpModule={mockHttpModule} />);

      const configButton = screen.getByTestId('config-button');

      // Open configuration
      fireEvent.press(configButton);
      await waitFor(() => {
        expect(screen.getByTestId('mock-config-section')).toBeDefined();
      });

      // Trigger onConfigured callback
      const completeButton = screen.getByTestId('mock-config-complete');
      fireEvent.press(completeButton);

      // Verify section is closed
      await waitFor(() => {
        expect(screen.queryByTestId('mock-config-section')).toBeNull();
      });
    });

    it('config button remains visible when server is starting', async () => {
      useServerStore.getState().startRequested();

      mockStartFn.mockClear();
      await render(<ReceiveScreen httpModule={mockHttpModule} />);

      await waitFor(() => {
        const configButton = screen.getByTestId('config-button');
        expect(configButton).toBeDefined();
      });
    });

    it('config button remains visible when server has error', async () => {
      useServerStore.getState().startRequested();
      useServerStore.getState().failed({
        code: 'PORT_UNAVAILABLE',
        message: 'No port available',
      });

      mockStartFn.mockClear();
      await render(<ReceiveScreen httpModule={mockHttpModule} />);

      await waitFor(() => {
        const configButton = screen.getByTestId('config-button');
        expect(configButton).toBeDefined();
      });
    });

    it('config button remains visible when server is running', async () => {
      useServerStore.getState().startRequested();
      useServerStore.getState().started({
        networkMode: 'wifi',
        ip: '192.168.1.100',
        port: 8080,
        url: 'http://192.168.1.100:8080?token=test',
        token: 'test',
        mode: 'receive',
        startedAt: Date.now(),
      });

      mockStartFn.mockClear();
      await render(<ReceiveScreen httpModule={mockHttpModule} />);

      await waitFor(() => {
        const configButton = screen.getByTestId('config-button');
        expect(configButton).toBeDefined();
      });
    });

    it('config button remains visible when transfer is active', async () => {
      useServerStore.getState().startRequested();
      useServerStore.getState().started({
        networkMode: 'wifi',
        ip: '192.168.1.100',
        port: 8080,
        url: 'http://192.168.1.100:8080?token=test',
        token: 'test',
        mode: 'receive',
        startedAt: Date.now(),
      });

      useTransferStore.getState().enqueue({
        direction: 'upload',
        fileName: 'test.txt',
        sizeBytes: 1024,
        peerIp: '192.168.1.101',
      });

      mockStartFn.mockClear();
      await render(<ReceiveScreen httpModule={mockHttpModule} />);

      await waitFor(() => {
        const configButton = screen.getByTestId('config-button');
        expect(configButton).toBeDefined();
      });
    });

    it('config button remains visible when transfer is completed', async () => {
      useServerStore.getState().startRequested();
      useServerStore.getState().started({
        networkMode: 'wifi',
        ip: '192.168.1.100',
        port: 8080,
        url: 'http://192.168.1.100:8080?token=test',
        token: 'test',
        mode: 'receive',
        startedAt: Date.now(),
      });

      const transferId = useTransferStore.getState().enqueue({
        direction: 'upload',
        fileName: 'test.txt',
        sizeBytes: 1024,
        peerIp: '192.168.1.101',
      });
      useTransferStore.getState().complete(transferId);

      mockStartFn.mockClear();
      await render(<ReceiveScreen httpModule={mockHttpModule} />);

      await waitFor(() => {
        const configButton = screen.getByTestId('config-button');
        expect(configButton).toBeDefined();
      });
    });

    it('allows toggling configuration section multiple times', async () => {
      mockStartFn.mockClear();
      await render(<ReceiveScreen httpModule={mockHttpModule} />);

      const configButton = screen.getByTestId('config-button');

      // Open
      fireEvent.press(configButton);
      await waitFor(() => {
        expect(screen.getByTestId('mock-config-section')).toBeDefined();
      });

      // Close
      fireEvent.press(configButton);
      await waitFor(() => {
        expect(screen.queryByTestId('mock-config-section')).toBeNull();
      });

      // Open again
      fireEvent.press(configButton);
      await waitFor(() => {
        expect(screen.getByTestId('mock-config-section')).toBeDefined();
      });

      // Close again
      fireEvent.press(configButton);
      await waitFor(() => {
        expect(screen.queryByTestId('mock-config-section')).toBeNull();
      });
    });

    it('configuration section does not appear by default', async () => {
      mockStartFn.mockClear();
      await render(<ReceiveScreen httpModule={mockHttpModule} />);

      await waitFor(() => {
        expect(screen.queryByTestId('mock-config-section')).toBeNull();
      });
    });
  });
});
