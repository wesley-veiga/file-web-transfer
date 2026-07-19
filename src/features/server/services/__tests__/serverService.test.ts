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
    beforeEach(() => {
      // Mockar stop para sucesso no fallback (findAvailablePort)
      mockHttpModule.stop.mockResolvedValue(undefined);
    });

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

    it('deve lançar PORT_UNAVAILABLE quando todas as portas (8080-8089) estão ocupadas', async () => {
      mockHttpModule.start.mockRejectedValue(new Error('Port already in use (EADDRINUSE)'));

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

      // Verificar que tentou todas as 10 portas (8080-8089)
      expect(mockHttpModule.start).toHaveBeenCalledTimes(10);
    });

    it('deve fazer fallback para próxima porta se a primeira estiver indisponível', async () => {
      // 8080 falha em findAvailablePort, 8081 funciona em findAvailablePort,
      // depois 8081 é chamado novamente em start()
      mockHttpModule.start
        .mockRejectedValueOnce(new Error('Port 8080 already in use (EADDRINUSE)')) // findAvailablePort tenta 8080
        .mockResolvedValueOnce(undefined) // findAvailablePort tenta 8081 (sucesso)
        .mockResolvedValueOnce(undefined); // start() tenta 8081 novamente
      mockHttpModule.stop.mockResolvedValue(undefined);

      const result = await serverService.start('wifi');

      // Verificar que tentou: 8080 (falha), 8081 (findAvailablePort), 8081 (start)
      expect(mockHttpModule.start).toHaveBeenCalledTimes(3);
      expect(mockHttpModule.start).toHaveBeenNthCalledWith(1, 8080);
      expect(mockHttpModule.start).toHaveBeenNthCalledWith(2, 8081);
      expect(mockHttpModule.start).toHaveBeenNthCalledWith(3, 8081);

      // Verificar que resultado contém porta 8081
      expect(result.port).toBe(8081);
      expect(result.url).toBe('http://192.168.1.42:8081');
    });

    it('deve relançar ServerServiceError se for já um ServerServiceError', async () => {
      const serverError = new ServerServiceError('NO_NETWORK', 'Test error');
      mockHttpModule.start.mockRejectedValue(serverError);

      await expect(serverService.start('wifi')).rejects.toThrow(serverError);
    });

    it('deve tentar próxima porta quando error contém "port" (e depois falhar se todas estiverem ocupadas)', async () => {
      // Todas as portas retornam erro com "port" na mensagem
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

      // Verificar que tentou todas as portas
      expect(mockHttpModule.start).toHaveBeenCalledTimes(10);
    });

    it('deve tentar próxima porta quando error contém "already in use"', async () => {
      // Todas as portas retornam erro "already in use"
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

      // Verificar que tentou todas as portas
      expect(mockHttpModule.start).toHaveBeenCalledTimes(10);
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

    it('deve chamar httpModule.start com a porta 8080 (findAvailablePort) e depois novamente para iniciar de verdade', async () => {
      mockHttpModule.stop.mockResolvedValue(undefined);

      await serverService.start('wifi');

      // findAvailablePort chama start(8080) uma vez e depois stop
      // Depois start() chama start(8080) novamente para iniciar de verdade
      expect(mockHttpModule.start).toHaveBeenCalledWith(8080);
      expect(mockHttpModule.start).toHaveBeenCalledTimes(2); // Uma vez em findAvailablePort, uma em start()
      expect(mockHttpModule.stop).toHaveBeenCalledTimes(1); // stop() é chamado por findAvailablePort após verificação
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
