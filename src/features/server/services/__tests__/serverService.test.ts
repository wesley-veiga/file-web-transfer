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

      try {
        await serverService.start('wifi');
        throw new Error('Expected start() to throw');
      } catch (error) {
        expect(error).toBeInstanceOf(ServerServiceError);
        if (error instanceof ServerServiceError) {
          expect(error.code).toBe('NO_NETWORK');
          expect(error.message).toBe('Nenhuma rede disponível');
        }
      }
    });

    it('deve lançar NO_NETWORK quando getIpAddressAsync retorna null', async () => {
      (Network.getIpAddressAsync as jest.Mock).mockResolvedValue(null);

      try {
        await serverService.start('wifi');
        throw new Error('Expected start() to throw');
      } catch (error) {
        expect(error).toBeInstanceOf(ServerServiceError);
        if (error instanceof ServerServiceError) {
          expect(error.code).toBe('NO_NETWORK');
          expect(error.message).toBe('Nenhuma rede disponível');
        }
      }
    });

    it('deve lançar PORT_UNAVAILABLE quando httpModule.start falha com erro de porta', async () => {
      mockHttpModule.start.mockRejectedValue(new Error('Port 8080 already in use'));

      try {
        await serverService.start('wifi');
        throw new Error('Expected start() to throw');
      } catch (error) {
        expect(error).toBeInstanceOf(ServerServiceError);
        if (error instanceof ServerServiceError) {
          expect(error.code).toBe('PORT_UNAVAILABLE');
          expect(error.message).toBe('Nenhuma porta livre disponível');
        }
      }
    });

    it('deve lançar UNKNOWN para erro genérico não mapeado', async () => {
      mockHttpModule.start.mockRejectedValue(new Error('Generic error'));

      try {
        await serverService.start('wifi');
        throw new Error('Expected start() to throw');
      } catch (error) {
        expect(error).toBeInstanceOf(ServerServiceError);
        if (error instanceof ServerServiceError) {
          expect(error.code).toBe('UNKNOWN');
          expect(error.message).toBe('Erro desconhecido ao iniciar servidor');
        }
      }
    });

    it('deve relançar ServerServiceError se for já um ServerServiceError', async () => {
      const serverError = new ServerServiceError('NO_NETWORK', 'Test error');
      mockHttpModule.start.mockRejectedValue(serverError);

      await expect(serverService.start('wifi')).rejects.toThrow(serverError);
    });

    it('deve mapear error com "port" na mensagem para PORT_UNAVAILABLE', async () => {
      mockHttpModule.start.mockRejectedValue(new Error('Cannot bind to port'));

      try {
        await serverService.start('wifi');
        throw new Error('Expected start() to throw');
      } catch (error) {
        expect(error).toBeInstanceOf(ServerServiceError);
        if (error instanceof ServerServiceError) {
          expect(error.code).toBe('PORT_UNAVAILABLE');
        }
      }
    });

    it('deve mapear error com "already in use" na mensagem para PORT_UNAVAILABLE', async () => {
      mockHttpModule.start.mockRejectedValue(new Error('Address already in use'));

      try {
        await serverService.start('wifi');
        throw new Error('Expected start() to throw');
      } catch (error) {
        expect(error).toBeInstanceOf(ServerServiceError);
        if (error instanceof ServerServiceError) {
          expect(error.code).toBe('PORT_UNAVAILABLE');
        }
      }
    });

    it('deve mapear error com "network" na mensagem para NO_NETWORK', async () => {
      mockHttpModule.start.mockRejectedValue(new Error('Network error'));

      try {
        await serverService.start('wifi');
        throw new Error('Expected start() to throw');
      } catch (error) {
        expect(error).toBeInstanceOf(ServerServiceError);
        if (error instanceof ServerServiceError) {
          expect(error.code).toBe('NO_NETWORK');
        }
      }
    });

    it('deve mapear error com "offline" na mensagem para NO_NETWORK', async () => {
      mockHttpModule.start.mockRejectedValue(new Error('Device is offline'));

      try {
        await serverService.start('wifi');
        throw new Error('Expected start() to throw');
      } catch (error) {
        expect(error).toBeInstanceOf(ServerServiceError);
        if (error instanceof ServerServiceError) {
          expect(error.code).toBe('NO_NETWORK');
        }
      }
    });

    it('deve retornar URL construída corretamente com IP e porta', async () => {
      (Network.getIpAddressAsync as jest.Mock).mockResolvedValue('10.0.0.5');

      const result = await serverService.start('wifi');

      expect(result.url).toBe('http://10.0.0.5:8080');
      expect(result.ip).toBe('10.0.0.5');
      expect(result.port).toBe(8080);
    });

    it('deve chamar httpModule.start com a porta 8080', async () => {
      await serverService.start('wifi');

      expect(mockHttpModule.start).toHaveBeenCalledWith(8080);
      expect(mockHttpModule.start).toHaveBeenCalledTimes(1);
    });

    it('deve gerar sessionId determinístico (mockado)', async () => {
      const result = await serverService.start('wifi');

      expect(result.sessionId).toBe('test-session-123');
    });

    it('deve passar networkMode corretamente no resultado', async () => {
      const resultWifi = await serverService.start('wifi');
      expect(resultWifi.networkMode).toBe('wifi');

      mockHttpModule.start.mockClear();

      const resultHotspot = await serverService.start('hotspot');
      expect(resultHotspot.networkMode).toBe('hotspot');
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

  describe('error handling in getLocalIp', () => {
    it('deve lançar NO_NETWORK quando getNetworkStateAsync lança erro', async () => {
      (Network.getNetworkStateAsync as jest.Mock).mockRejectedValue(new Error('Network error'));

      try {
        await serverService.start('wifi');
        throw new Error('Expected start() to throw');
      } catch (error) {
        expect(error).toBeInstanceOf(ServerServiceError);
        if (error instanceof ServerServiceError) {
          expect(error.code).toBe('NO_NETWORK');
        }
      }
    });

    it('deve lançar NO_NETWORK quando getIpAddressAsync lança erro', async () => {
      (Network.getIpAddressAsync as jest.Mock).mockRejectedValue(new Error('IP error'));

      try {
        await serverService.start('wifi');
        throw new Error('Expected start() to throw');
      } catch (error) {
        expect(error).toBeInstanceOf(ServerServiceError);
        if (error instanceof ServerServiceError) {
          expect(error.code).toBe('NO_NETWORK');
        }
      }
    });

    it('deve ignorar error de getIpAddressAsync quando network não está conectado', async () => {
      (Network.getNetworkStateAsync as jest.Mock).mockResolvedValue({
        isConnected: false,
      });
      (Network.getIpAddressAsync as jest.Mock).mockRejectedValue(new Error('IP error'));

      try {
        await serverService.start('wifi');
        throw new Error('Expected start() to throw');
      } catch (error) {
        expect(error).toBeInstanceOf(ServerServiceError);
        if (error instanceof ServerServiceError) {
          expect(error.code).toBe('NO_NETWORK');
        }
      }
    });
  });

  describe('non-object errors', () => {
    it('deve lançar UNKNOWN quando error não é uma instância de Error', async () => {
      mockHttpModule.start.mockRejectedValue('string error');

      try {
        await serverService.start('wifi');
        throw new Error('Expected start() to throw');
      } catch (error) {
        expect(error).toBeInstanceOf(ServerServiceError);
        if (error instanceof ServerServiceError) {
          expect(error.code).toBe('UNKNOWN');
        }
      }
    });
  });
});
