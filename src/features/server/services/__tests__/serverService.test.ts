import * as Network from 'expo-network';
import { ServerServiceImpl, ServerServiceError } from '../serverService';
import type { HttpModule } from '../httpModule';

// Mock expo-network
jest.mock('expo-network');

// Mock generateSessionId para testes determinísticos
jest.mock('../../../../shared/lib', () => ({
  generateSessionId: jest.fn(() => 'test-session-123'),
}));

describe('ServerService', () => {
  let serverService: ServerServiceImpl;
  let mockHttpModule: jest.Mocked<HttpModule>;

  beforeEach(() => {
    jest.clearAllMocks();

    // Criar mock do HttpModule
    mockHttpModule = {
      start: jest.fn(),
      stop: jest.fn(),
      addListener: jest.fn(),
      removeListener: jest.fn(),
      isRunning: jest.fn(() => false),
    };

    serverService = new ServerServiceImpl(mockHttpModule);

    // Setup padrão: rede disponível, IP 192.168.1.42
    (Network.getNetworkStateAsync as jest.Mock).mockResolvedValue({
      isConnected: true,
    });
    (Network.getIpAddressAsync as jest.Mock).mockResolvedValue('192.168.1.42');
  });

  describe('start', () => {
    it('deve iniciar servidor em modo wifi com sucesso', async () => {
      const result = await serverService.start('wifi');

      expect(mockHttpModule.start).toHaveBeenCalledWith(8080);
      expect(result).toEqual({
        ip: '192.168.1.42',
        port: 8080,
        url: 'http://192.168.1.42:8080',
        sessionId: 'test-session-123',
        networkMode: 'wifi',
      });
    });

    it('deve iniciar servidor em modo hotspot com sucesso', async () => {
      const result = await serverService.start('hotspot');

      expect(mockHttpModule.start).toHaveBeenCalledWith(8080);
      expect(result).toEqual({
        ip: '192.168.1.42',
        port: 8080,
        url: 'http://192.168.1.42:8080',
        sessionId: 'test-session-123',
        networkMode: 'hotspot',
      });
    });

    it('deve lançar NO_NETWORK quando não há rede disponível', async () => {
      (Network.getNetworkStateAsync as jest.Mock).mockResolvedValue({
        isConnected: false,
      });

      await expect(serverService.start('wifi')).rejects.toThrow(ServerServiceError);
      try {
        await serverService.start('wifi');
      } catch (error) {
        if (error instanceof ServerServiceError) {
          expect(error.code).toBe('NO_NETWORK');
        }
      }
    });

    it('deve lançar NO_NETWORK quando getIpAddressAsync retorna null', async () => {
      (Network.getIpAddressAsync as jest.Mock).mockResolvedValue(null);

      try {
        await serverService.start('wifi');
      } catch (error) {
        if (error instanceof ServerServiceError) {
          expect(error.code).toBe('NO_NETWORK');
        }
      }
    });

    it('deve lançar PORT_UNAVAILABLE quando httpModule.start falha com erro de porta', async () => {
      mockHttpModule.start.mockRejectedValue(new Error('Port 8080 already in use'));

      try {
        await serverService.start('wifi');
      } catch (error) {
        if (error instanceof ServerServiceError) {
          expect(error.code).toBe('PORT_UNAVAILABLE');
        }
      }
    });

    it('deve lançar UNKNOWN para erro genérico não mapeado', async () => {
      mockHttpModule.start.mockRejectedValue(new Error('Generic error'));

      try {
        await serverService.start('wifi');
      } catch (error) {
        if (error instanceof ServerServiceError) {
          expect(error.code).toBe('UNKNOWN');
        }
      }
    });

    it('deve relançar ServerServiceError se for já um ServerServiceError', async () => {
      const serverError = new ServerServiceError('NO_NETWORK', 'Test error');
      mockHttpModule.start.mockRejectedValue(serverError);

      await expect(serverService.start('wifi')).rejects.toThrow(serverError);
    });
  });

  describe('stop', () => {
    it('deve chamar httpModule.stop', async () => {
      await serverService.stop();

      expect(mockHttpModule.stop).toHaveBeenCalledTimes(1);
    });
  });

  describe('isRunning', () => {
    it('deve retornar isRunning do httpModule', () => {
      mockHttpModule.isRunning.mockReturnValue(false);
      expect(serverService.isRunning()).toBe(false);

      mockHttpModule.isRunning.mockReturnValue(true);
      expect(serverService.isRunning()).toBe(true);
    });
  });

  describe('getLocalIp (private)', () => {
    it('deve retornar null quando getNetworkStateAsync lança erro', async () => {
      (Network.getNetworkStateAsync as jest.Mock).mockRejectedValue(new Error('Network error'));

      await expect(serverService.start('wifi')).rejects.toThrow(ServerServiceError);
    });

    it('deve retornar null quando getIpAddressAsync lança erro', async () => {
      (Network.getIpAddressAsync as jest.Mock).mockRejectedValue(new Error('IP error'));

      await expect(serverService.start('wifi')).rejects.toThrow(ServerServiceError);
    });
  });
});
