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
});
