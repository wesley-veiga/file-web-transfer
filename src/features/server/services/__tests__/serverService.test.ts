import * as Network from 'expo-network';
import { ServerServiceImpl, ServerServiceError } from '../serverService';
import { createMockHttpModule } from '../../../../__mocks__/testHelpers';

// Mock expo-network
jest.mock('expo-network');

// Mock generateSessionId para testes determinísticos
jest.mock('../../../../shared/lib', () => ({
  generateSessionId: jest.fn(() => 'test-session-123'),
}));

describe('ServerService', () => {
  let serverService: ServerServiceImpl;
  let mockHttpModule: jest.Mocked<ReturnType<typeof createMockHttpModule>>;

  beforeEach(() => {
    jest.clearAllMocks();

    // Criar mock do HttpModule
    mockHttpModule = createMockHttpModule();

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
      // 8080 falha, 8081 funciona — servidor real fica rodando em 8081 direto
      // (T-701: sem start()+stop()+start() redundante na mesma porta, ver
      // comentário de `findAvailablePort()` em serverService.ts).
      mockHttpModule.start
        .mockRejectedValueOnce(new Error('Port 8080 already in use (EADDRINUSE)'))
        .mockResolvedValueOnce(undefined);

      const result = await serverService.start('wifi');

      expect(mockHttpModule.start).toHaveBeenCalledTimes(2);
      expect(mockHttpModule.start).toHaveBeenNthCalledWith(1, 8080);
      expect(mockHttpModule.start).toHaveBeenNthCalledWith(2, 8081);
      // stop() nunca é chamado durante o start — a porta testada é a porta real.
      expect(mockHttpModule.stop).not.toHaveBeenCalled();

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

    it('deve chamar httpModule.start com a porta 8080 uma única vez, sem stop()/restart (T-701)', async () => {
      await serverService.start('wifi');

      // findAvailablePort() já deixa o servidor rodando na porta 8080 — nenhum
      // start()+stop()+start() redundante (ver comentário em serverService.ts:
      // fechar e reabrir a mesma porta é uma corrida real contra o socket nativo,
      // achado via `adb logcat` num dispositivo real durante T-701).
      expect(mockHttpModule.start).toHaveBeenCalledWith(8080);
      expect(mockHttpModule.start).toHaveBeenCalledTimes(1);
      expect(mockHttpModule.stop).not.toHaveBeenCalled();
    });

    it('deve gerar sessionId determinístico (mockado)', async () => {
      const result = await serverService.start('wifi');

      expect(result.sessionId).toBe('test-session-123');
    });

    it('deve passar networkMode corretamente no resultado', async () => {
      const resultWifi = await serverService.start('wifi');
      expect(resultWifi.networkMode).toBe('wifi');
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

  describe('timeout de chamadas nativas (T-701 — achado em teste manual: httpModule pode nunca resolver)', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('start() rejeita com UNKNOWN em vez de travar para sempre quando httpModule.start() nunca resolve', async () => {
      // Promise que nunca resolve nem rejeita — simula o achado real em T-701.
      mockHttpModule.start.mockReturnValue(new Promise(() => {}));

      const startPromise = serverService.start('wifi');
      // Engole a rejeição não tratada até o `await` abaixo observar — evita
      // "Unhandled promise rejection" no console durante o avanço do timer.
      startPromise.catch(() => {});

      await jest.advanceTimersByTimeAsync(8000);

      await expect(startPromise).rejects.toBeInstanceOf(ServerServiceError);
      await expect(startPromise).rejects.toMatchObject({ code: 'UNKNOWN' });
    });

    it('findAvailablePort() propaga o timeout imediatamente, sem tentar as próximas 9 portas', async () => {
      // httpModule.start nunca resolve na primeira tentativa (porta 8080).
      mockHttpModule.start.mockReturnValue(new Promise(() => {}));

      const startPromise = serverService.start('wifi');
      startPromise.catch(() => {});

      await jest.advanceTimersByTimeAsync(8000);
      await expect(startPromise).rejects.toBeInstanceOf(ServerServiceError);

      // Só uma tentativa: o timeout não é "porta em uso" (o texto contém "porta",
      // que colidiria com a heurística de retry se não fosse pelo TIMEOUT_ERROR_NAME
      // dedicado) — não deve iterar as 9 portas restantes do intervalo.
      expect(mockHttpModule.start).toHaveBeenCalledTimes(1);
    });

    it('stop() rejeita em vez de travar para sempre quando httpModule.stop() nunca resolve', async () => {
      mockHttpModule.stop.mockReturnValue(new Promise(() => {}));

      const stopPromise = serverService.stop();
      stopPromise.catch(() => {});

      await jest.advanceTimersByTimeAsync(8000);

      await expect(stopPromise).rejects.toThrow('Tempo esgotado ao parar o servidor HTTP');
    });

    it('não rejeita por timeout quando httpModule.start()/stop() resolvem antes dos 8s', async () => {
      mockHttpModule.stop.mockResolvedValue(undefined);

      const result = await serverService.start('wifi');

      expect(result.port).toBe(8080);
      // Nenhum timer de 8s deveria continuar pendente após a resolução bem-sucedida
      // (clearTimeout chamado) — confirmamos que avançar o tempo não causa efeito.
      await jest.advanceTimersByTimeAsync(8000);
    });
  });
});
