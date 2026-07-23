import { Platform } from 'react-native';
import * as Network from 'expo-network';
import { HotspotServiceImpl, HotspotServiceError } from '../hotspotService';
import type { NativeHotspotModule } from '../nativeHotspot';

// Mock React Native Platform
jest.mock('react-native', () => ({
  Platform: {
    OS: 'android',
  },
}));

// Mock expo-network
jest.mock('expo-network');

describe('HotspotService', () => {
  let hotspotService: HotspotServiceImpl;
  let mockNativeModule: jest.Mocked<NativeHotspotModule>;

  beforeEach(() => {
    jest.clearAllMocks();

    // Criar mock do NativeHotspot
    mockNativeModule = {
      startLocalOnlyHotspot: jest.fn(),
      stopLocalOnlyHotspot: jest.fn(),
      getHotspotConfig: jest.fn(),
    };

    hotspotService = new HotspotServiceImpl(mockNativeModule);
  });

  describe('createHotspot - Android', () => {
    beforeEach(() => {
      (Platform.OS as unknown) = 'android';
    });

    it('deve criar hotspot com sucesso no Android', async () => {
      mockNativeModule.startLocalOnlyHotspot.mockResolvedValue({
        ssid: 'TransferFiles_ABC123',
        password: 'abc123xyz789',
        ip: '192.168.43.1',
        gateway: '192.168.43.1',
      });

      const result = await hotspotService.createHotspot();

      expect(mockNativeModule.startLocalOnlyHotspot).toHaveBeenCalled();
      expect(result.hotspotInfo).toEqual({
        ssid: 'TransferFiles_ABC123',
        password: 'abc123xyz789',
        wifiQrPayload: 'WIFI:S:TransferFiles_ABC123;T:WPA;P:abc123xyz789;;',
      });
    });

    it('deve gerar wifiQrPayload no formato ZXing correto', async () => {
      mockNativeModule.startLocalOnlyHotspot.mockResolvedValue({
        ssid: 'Rede Teste',
        password: 'senha@123',
        ip: '192.168.43.1',
      });

      const result = await hotspotService.createHotspot();

      expect(result.hotspotInfo.wifiQrPayload).toBe('WIFI:S:Rede Teste;T:WPA;P:senha@123;;');
    });

    it('deve lançar HOTSPOT_UNSUPPORTED quando módulo nativo retorna UNSUPPORTED', async () => {
      mockNativeModule.startLocalOnlyHotspot.mockRejectedValue('UNSUPPORTED');

      try {
        await hotspotService.createHotspot();
        throw new Error('Expected createHotspot() to throw');
      } catch (error) {
        expect(error).toBeInstanceOf(HotspotServiceError);
        if (error instanceof HotspotServiceError) {
          expect(error.code).toBe('HOTSPOT_UNSUPPORTED');
        }
      }
    });

    it('deve lançar PERMISSION_DENIED quando módulo nativo retorna PERMISSION_DENIED', async () => {
      mockNativeModule.startLocalOnlyHotspot.mockRejectedValue('PERMISSION_DENIED');

      try {
        await hotspotService.createHotspot();
        throw new Error('Expected createHotspot() to throw');
      } catch (error) {
        expect(error).toBeInstanceOf(HotspotServiceError);
        if (error instanceof HotspotServiceError) {
          expect(error.code).toBe('PERMISSION_DENIED');
        }
      }
    });

    it('deve lançar HOTSPOT_FAILED quando módulo nativo retorna FAILED', async () => {
      mockNativeModule.startLocalOnlyHotspot.mockRejectedValue('FAILED');

      try {
        await hotspotService.createHotspot();
        throw new Error('Expected createHotspot() to throw');
      } catch (error) {
        expect(error).toBeInstanceOf(HotspotServiceError);
        if (error instanceof HotspotServiceError) {
          expect(error.code).toBe('HOTSPOT_FAILED');
        }
      }
    });

    it('deve lançar HOTSPOT_FAILED quando módulo nativo retorna TIMEOUT', async () => {
      mockNativeModule.startLocalOnlyHotspot.mockRejectedValue('TIMEOUT');

      try {
        await hotspotService.createHotspot();
        throw new Error('Expected createHotspot() to throw');
      } catch (error) {
        expect(error).toBeInstanceOf(HotspotServiceError);
        if (error instanceof HotspotServiceError) {
          expect(error.code).toBe('HOTSPOT_FAILED');
        }
      }
    });
  });

  describe('stopHotspot - Android', () => {
    beforeEach(() => {
      (Platform.OS as unknown) = 'android';
    });

    it('deve desligar hotspot com sucesso no Android', async () => {
      mockNativeModule.stopLocalOnlyHotspot.mockResolvedValue(undefined);

      await hotspotService.stopHotspot();

      expect(mockNativeModule.stopLocalOnlyHotspot).toHaveBeenCalled();
    });

    it('deve lançar erro quando stopLocalOnlyHotspot falha', async () => {
      mockNativeModule.stopLocalOnlyHotspot.mockRejectedValue('NOT_RUNNING');

      try {
        await hotspotService.stopHotspot();
        throw new Error('Expected stopHotspot() to throw');
      } catch (error) {
        expect(error).toBeInstanceOf(HotspotServiceError);
        if (error instanceof HotspotServiceError) {
          expect(error.code).toBe('HOTSPOT_FAILED');
        }
      }
    });
  });

  describe('stopHotspot - iOS', () => {
    beforeEach(() => {
      (Platform.OS as unknown) = 'ios';
    });

    it('deve não fazer nada no iOS (hotspot manual)', async () => {
      await hotspotService.stopHotspot();

      expect(mockNativeModule.stopLocalOnlyHotspot).not.toHaveBeenCalled();
    });
  });

  describe('isHotspotActive - Android', () => {
    beforeEach(() => {
      (Platform.OS as unknown) = 'android';
    });

    it('deve retornar hotspotInfo se hotspot está ativo no Android', async () => {
      mockNativeModule.getHotspotConfig.mockResolvedValue({
        ssid: 'TransferFiles_ABC123',
        password: 'abc123xyz789',
        ip: '192.168.43.1',
      });

      const result = await hotspotService.isHotspotActive();

      expect(mockNativeModule.getHotspotConfig).toHaveBeenCalled();
      expect(result).toEqual({
        ssid: 'TransferFiles_ABC123',
        password: 'abc123xyz789',
        wifiQrPayload: 'WIFI:S:TransferFiles_ABC123;T:WPA;P:abc123xyz789;;',
      });
    });

    it('deve retornar null se hotspot não está ativo no Android', async () => {
      mockNativeModule.getHotspotConfig.mockResolvedValue(null);

      const result = await hotspotService.isHotspotActive();

      expect(result).toBeNull();
    });

    it('deve retornar null se getHotspotConfig lança erro', async () => {
      mockNativeModule.getHotspotConfig.mockRejectedValue(new Error('Native error'));

      const result = await hotspotService.isHotspotActive();

      expect(result).toBeNull();
    });
  });

  describe('createHotspot - iOS', () => {
    beforeEach(() => {
      (Platform.OS as unknown) = 'ios';

      (Network.getNetworkStateAsync as jest.Mock).mockResolvedValue({
        isConnected: true,
      });
      (Network.getIpAddressAsync as jest.Mock).mockResolvedValue('172.20.10.2');
    });

    it('deve detectar Hotspot Pessoal ativo no iOS quando conectado', async () => {
      const result = await hotspotService.createHotspot();

      expect(result.hotspotInfo.ssid).toBe('Hotspot Pessoal');
      expect(result.hotspotInfo.password).toBe('');
      expect(result.hotspotInfo.wifiQrPayload).toBe('');
    });

    it('deve lançar HOTSPOT_UNSUPPORTED no iOS quando não conectado', async () => {
      (Network.getNetworkStateAsync as jest.Mock).mockResolvedValue({
        isConnected: false,
      });

      try {
        await hotspotService.createHotspot();
        throw new Error('Expected createHotspot() to throw');
      } catch (error) {
        expect(error).toBeInstanceOf(HotspotServiceError);
        if (error instanceof HotspotServiceError) {
          expect(error.code).toBe('HOTSPOT_UNSUPPORTED');
        }
      }
    });
  });

  describe('isHotspotActive - iOS', () => {
    beforeEach(() => {
      (Platform.OS as unknown) = 'ios';

      (Network.getNetworkStateAsync as jest.Mock).mockResolvedValue({
        isConnected: true,
      });
      (Network.getIpAddressAsync as jest.Mock).mockResolvedValue('172.20.10.2');
    });

    it('deve retornar hotspotInfo se Hotspot Pessoal está ativo no iOS', async () => {
      const result = await hotspotService.isHotspotActive();

      expect(result).toEqual({
        ssid: 'Hotspot Pessoal',
        password: '',
        wifiQrPayload: '',
      });
    });

    it('deve retornar null se não conectado no iOS', async () => {
      (Network.getNetworkStateAsync as jest.Mock).mockResolvedValue({
        isConnected: false,
      });

      const result = await hotspotService.isHotspotActive();

      expect(result).toBeNull();
    });
  });

  describe('Validação de HotspotServiceError', () => {
    it('deve criar erro com código e mensagem corretos', () => {
      const error = new HotspotServiceError('HOTSPOT_UNSUPPORTED', 'Teste error');

      expect(error.code).toBe('HOTSPOT_UNSUPPORTED');
      expect(error.message).toBe('Teste error');
      expect(error.name).toBe('HotspotServiceError');
    });
  });

  describe('createHotspot - Plataforma desconhecida', () => {
    it('deve lançar HOTSPOT_UNSUPPORTED para plataforma desconhecida', async () => {
      (Platform.OS as unknown) = 'windows';

      try {
        await hotspotService.createHotspot();
        throw new Error('Expected createHotspot() to throw');
      } catch (error) {
        expect(error).toBeInstanceOf(HotspotServiceError);
        if (error instanceof HotspotServiceError) {
          expect(error.code).toBe('HOTSPOT_UNSUPPORTED');
        }
      }
    });
  });

  describe('createHotspot - Erros genéricos', () => {
    beforeEach(() => {
      (Platform.OS as unknown) = 'android';
    });

    it('deve mapear erro genérico (não-string) para HOTSPOT_FAILED no Android', async () => {
      mockNativeModule.startLocalOnlyHotspot.mockRejectedValue(
        new Error('Erro genérico do módulo nativo'),
      );

      try {
        await hotspotService.createHotspot();
        throw new Error('Expected createHotspot() to throw');
      } catch (error) {
        expect(error).toBeInstanceOf(HotspotServiceError);
        if (error instanceof HotspotServiceError) {
          expect(error.code).toBe('HOTSPOT_FAILED');
          expect(error.message).toBe('Falha ao criar rede própria');
        }
      }
    });

    it('deve mapear erro não-Error, não-string para HOTSPOT_FAILED', async () => {
      mockNativeModule.startLocalOnlyHotspot.mockRejectedValue({ status: 500 });

      try {
        await hotspotService.createHotspot();
        throw new Error('Expected createHotspot() to throw');
      } catch (error) {
        expect(error).toBeInstanceOf(HotspotServiceError);
        if (error instanceof HotspotServiceError) {
          expect(error.code).toBe('HOTSPOT_FAILED');
        }
      }
    });
  });

  describe('stopHotspot - Erros genéricos', () => {
    beforeEach(() => {
      (Platform.OS as unknown) = 'android';
    });

    it('deve mapear erro genérico (não-string) para HOTSPOT_FAILED no Android', async () => {
      mockNativeModule.stopLocalOnlyHotspot.mockRejectedValue(
        new Error('Erro ao desligar hotspot'),
      );

      try {
        await hotspotService.stopHotspot();
        throw new Error('Expected stopHotspot() to throw');
      } catch (error) {
        expect(error).toBeInstanceOf(HotspotServiceError);
        if (error instanceof HotspotServiceError) {
          expect(error.code).toBe('HOTSPOT_FAILED');
          expect(error.message).toBe('Falha ao desligar rede própria');
        }
      }
    });

    it('deve mapear erro de tipo desconhecido para HOTSPOT_FAILED', async () => {
      mockNativeModule.stopLocalOnlyHotspot.mockRejectedValue(123);

      try {
        await hotspotService.stopHotspot();
        throw new Error('Expected stopHotspot() to throw');
      } catch (error) {
        expect(error).toBeInstanceOf(HotspotServiceError);
        if (error instanceof HotspotServiceError) {
          expect(error.code).toBe('HOTSPOT_FAILED');
        }
      }
    });
  });

  describe('createHotspot - iOS com variações de IP', () => {
    beforeEach(() => {
      (Platform.OS as unknown) = 'ios';

      (Network.getNetworkStateAsync as jest.Mock).mockResolvedValue({
        isConnected: true,
      });
    });

    it('deve detectar Hotspot Pessoal com IP 172.20.10.1 (gateway oficial)', async () => {
      (Network.getIpAddressAsync as jest.Mock).mockResolvedValue('172.20.10.1');

      const result = await hotspotService.createHotspot();

      expect(result.hotspotInfo.ssid).toBe('Hotspot Pessoal');
    });

    it('deve detectar Hotspot Pessoal com IP 172.20.254.254 (range válido)', async () => {
      (Network.getIpAddressAsync as jest.Mock).mockResolvedValue('172.20.254.254');

      const result = await hotspotService.createHotspot();

      expect(result.hotspotInfo.ssid).toBe('Hotspot Pessoal');
    });

    it('deve detectar Hotspot Pessoal com IP 172.20.0.1 (limite inferior)', async () => {
      (Network.getIpAddressAsync as jest.Mock).mockResolvedValue('172.20.0.1');

      const result = await hotspotService.createHotspot();

      expect(result.hotspotInfo.ssid).toBe('Hotspot Pessoal');
    });

    it('deve rejeitar IP fora do range 172.20.x.x', async () => {
      (Network.getIpAddressAsync as jest.Mock).mockResolvedValue('192.168.1.100');

      try {
        await hotspotService.createHotspot();
        throw new Error('Expected createHotspot() to throw');
      } catch (error) {
        expect(error).toBeInstanceOf(HotspotServiceError);
        if (error instanceof HotspotServiceError) {
          expect(error.code).toBe('HOTSPOT_UNSUPPORTED');
        }
      }
    });

    it('deve rejeitar quando getIpAddressAsync retorna null', async () => {
      (Network.getIpAddressAsync as jest.Mock).mockResolvedValue(null);

      try {
        await hotspotService.createHotspot();
        throw new Error('Expected createHotspot() to throw');
      } catch (error) {
        expect(error).toBeInstanceOf(HotspotServiceError);
        if (error instanceof HotspotServiceError) {
          expect(error.code).toBe('HOTSPOT_FAILED');
          expect(error.message).toBe('Falha ao obter IP do hotspot');
        }
      }
    });

    it('deve rejeitar quando getIpAddressAsync lança erro', async () => {
      (Network.getIpAddressAsync as jest.Mock).mockRejectedValue(new Error('Erro ao obter IP'));

      try {
        await hotspotService.createHotspot();
        throw new Error('Expected createHotspot() to throw');
      } catch (error) {
        expect(error).toBeInstanceOf(HotspotServiceError);
        if (error instanceof HotspotServiceError) {
          expect(error.code).toBe('HOTSPOT_UNSUPPORTED');
        }
      }
    });

    it('deve rejeitar quando getNetworkStateAsync lança erro', async () => {
      (Network.getNetworkStateAsync as jest.Mock).mockRejectedValue(new Error('Erro de rede'));

      try {
        await hotspotService.createHotspot();
        throw new Error('Expected createHotspot() to throw');
      } catch (error) {
        expect(error).toBeInstanceOf(HotspotServiceError);
        if (error instanceof HotspotServiceError) {
          expect(error.code).toBe('HOTSPOT_UNSUPPORTED');
        }
      }
    });
  });

  describe('isHotspotActive - Plataforma desconhecida', () => {
    it('deve retornar null para plataforma desconhecida', async () => {
      (Platform.OS as unknown) = 'windows';

      const result = await hotspotService.isHotspotActive();

      expect(result).toBeNull();
    });
  });

  describe('stopHotspot - Plataforma desconhecida', () => {
    it('deve não fazer nada para plataforma desconhecida', async () => {
      (Platform.OS as unknown) = 'windows';

      await hotspotService.stopHotspot();

      expect(mockNativeModule.stopLocalOnlyHotspot).not.toHaveBeenCalled();
    });
  });

  describe('wifiQrPayload - Caracteres especiais', () => {
    beforeEach(() => {
      (Platform.OS as unknown) = 'android';
    });

    it('deve gerar payload correto com SSID contendo espaços', async () => {
      mockNativeModule.startLocalOnlyHotspot.mockResolvedValue({
        ssid: 'Rede Com Espaços',
        password: 'senha@123',
        ip: '192.168.43.1',
      });

      const result = await hotspotService.createHotspot();

      expect(result.hotspotInfo.wifiQrPayload).toBe('WIFI:S:Rede Com Espaços;T:WPA;P:senha@123;;');
    });

    it('deve gerar payload com password contendo caracteres especiais', async () => {
      mockNativeModule.startLocalOnlyHotspot.mockResolvedValue({
        ssid: 'TestSSID',
        password: 'P@$$w0rd!#%&',
        ip: '192.168.43.1',
      });

      const result = await hotspotService.createHotspot();

      expect(result.hotspotInfo.wifiQrPayload).toBe('WIFI:S:TestSSID;T:WPA;P:P@$$w0rd!#%&;;');
    });

    it('deve gerar payload com SSID contendo acentos', async () => {
      mockNativeModule.startLocalOnlyHotspot.mockResolvedValue({
        ssid: 'RedeÇão',
        password: 'senha123',
        ip: '192.168.43.1',
      });

      const result = await hotspotService.createHotspot();

      expect(result.hotspotInfo.wifiQrPayload).toBe('WIFI:S:RedeÇão;T:WPA;P:senha123;;');
    });

    it('deve gerar payload com password vazio', async () => {
      mockNativeModule.startLocalOnlyHotspot.mockResolvedValue({
        ssid: 'TestSSID',
        password: '',
        ip: '192.168.43.1',
      });

      const result = await hotspotService.createHotspot();

      expect(result.hotspotInfo.wifiQrPayload).toBe('WIFI:S:TestSSID;T:WPA;P:;;');
    });
  });

  describe('Cobertura de mappings de erro', () => {
    beforeEach(() => {
      (Platform.OS as unknown) = 'android';
    });

    it('deve mapear TIMEOUT corretamente', async () => {
      mockNativeModule.startLocalOnlyHotspot.mockRejectedValue('TIMEOUT');

      try {
        await hotspotService.createHotspot();
        throw new Error('Expected to throw');
      } catch (error) {
        expect(error).toBeInstanceOf(HotspotServiceError);
        if (error instanceof HotspotServiceError) {
          expect(error.code).toBe('HOTSPOT_FAILED');
          expect(error.message).toBe('Tempo esgotado ao criar rede própria');
        }
      }
    });

    it('deve mapear NOT_RUNNING corretamente no stop', async () => {
      mockNativeModule.stopLocalOnlyHotspot.mockRejectedValue('NOT_RUNNING');

      try {
        await hotspotService.stopHotspot();
        throw new Error('Expected to throw');
      } catch (error) {
        expect(error).toBeInstanceOf(HotspotServiceError);
        if (error instanceof HotspotServiceError) {
          expect(error.code).toBe('HOTSPOT_FAILED');
          expect(error.message).toBe('Rede própria não está ativa');
        }
      }
    });
  });
});
