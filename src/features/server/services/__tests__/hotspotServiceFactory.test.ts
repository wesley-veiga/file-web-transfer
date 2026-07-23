import { Platform } from 'react-native';
import { createHotspotService } from '../hotspotServiceFactory';
import type { NativeHotspotModule } from '../nativeHotspot';

// Mock React Native Platform
jest.mock('react-native', () => ({
  Platform: {
    OS: 'android',
  },
}));

describe('hotspotServiceFactory', () => {
  let mockNativeModule: jest.Mocked<NativeHotspotModule>;

  beforeEach(() => {
    jest.clearAllMocks();

    mockNativeModule = {
      startLocalOnlyHotspot: jest.fn(),
      stopLocalOnlyHotspot: jest.fn(),
      getHotspotConfig: jest.fn(),
    };

    // Set Platform.OS to android for tests
    (Platform.OS as unknown) = 'android';
  });

  describe('createHotspotService', () => {
    it('deve criar HotspotService com nativeModule injetado', () => {
      const service = createHotspotService(mockNativeModule);

      expect(service).toBeDefined();
      expect(service).toHaveProperty('createHotspot');
      expect(service).toHaveProperty('stopHotspot');
      expect(service).toHaveProperty('isHotspotActive');
      expect(typeof service.createHotspot).toBe('function');
      expect(typeof service.stopHotspot).toBe('function');
      expect(typeof service.isHotspotActive).toBe('function');
    });

    it('deve usar nativeModule fornecido no parâmetro', async () => {
      const customModule = { ...mockNativeModule };
      const service = createHotspotService(customModule);

      customModule.startLocalOnlyHotspot.mockResolvedValue({
        ssid: 'TestSSID',
        password: 'testpass',
        ip: '192.168.43.1',
      });

      await service.createHotspot();

      expect(customModule.startLocalOnlyHotspot).toHaveBeenCalled();
    });

    it('deve usar NativeHotspot padrão se nenhum módulo foi fornecido', () => {
      const service = createHotspotService();

      expect(service).toBeDefined();
      expect(service).toHaveProperty('createHotspot');
      expect(service).toHaveProperty('stopHotspot');
      expect(service).toHaveProperty('isHotspotActive');
    });

    it('deve retornar serviço com todas as funções', () => {
      const customModule = { ...mockNativeModule };
      const service = createHotspotService(customModule);

      expect(service).toBeDefined();
      expect(service).toHaveProperty('createHotspot');
      expect(service).toHaveProperty('stopHotspot');
      expect(service).toHaveProperty('isHotspotActive');
      expect(typeof service.createHotspot).toBe('function');
      expect(typeof service.stopHotspot).toBe('function');
      expect(typeof service.isHotspotActive).toBe('function');
    });

    it('deve criar instâncias independentes com módulos diferentes', async () => {
      const module1: jest.Mocked<NativeHotspotModule> = {
        startLocalOnlyHotspot: jest.fn(),
        stopLocalOnlyHotspot: jest.fn(),
        getHotspotConfig: jest.fn(),
      };
      const module2: jest.Mocked<NativeHotspotModule> = {
        startLocalOnlyHotspot: jest.fn(),
        stopLocalOnlyHotspot: jest.fn(),
        getHotspotConfig: jest.fn(),
      };

      const service1 = createHotspotService(module1);
      const service2 = createHotspotService(module2);

      module1.startLocalOnlyHotspot.mockResolvedValue({
        ssid: 'SSID1',
        password: 'pass1',
        ip: '192.168.43.1',
      });

      module2.startLocalOnlyHotspot.mockResolvedValue({
        ssid: 'SSID2',
        password: 'pass2',
        ip: '192.168.43.1',
      });

      const result1 = await service1.createHotspot();
      const result2 = await service2.createHotspot();

      expect(result1.hotspotInfo.ssid).toBe('SSID1');
      expect(result2.hotspotInfo.ssid).toBe('SSID2');
      expect(module1.startLocalOnlyHotspot).toHaveBeenCalled();
      expect(module2.startLocalOnlyHotspot).toHaveBeenCalled();
    });
  });
});
