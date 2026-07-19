import * as Network from 'expo-network';
import { createServerService, setHttpModule } from '../serverServiceFactory';
import type { HttpModule } from '../httpModule';

// Mock expo-network
jest.mock('expo-network');

// Mock generateSessionId para testes determinísticos
jest.mock('../../../../shared/lib', () => ({
  generateSessionId: jest.fn(() => 'test-session-123'),
}));

describe('serverServiceFactory', () => {
  let mockHttpModule: jest.Mocked<HttpModule>;

  beforeEach(() => {
    jest.clearAllMocks();

    mockHttpModule = {
      start: jest.fn(),
      stop: jest.fn(),
      addListener: jest.fn(),
      removeListener: jest.fn(),
      isRunning: jest.fn(() => false),
    };

    // Mock expo-network
    jest.mocked(Network).getNetworkStateAsync = jest.fn().mockResolvedValue({
      isConnected: true,
    });
    jest.mocked(Network).getIpAddressAsync = jest.fn().mockResolvedValue('192.168.1.42');

    // Always set a default module for these tests
    setHttpModule(mockHttpModule);
  });

  describe('setHttpModule', () => {
    it('deve definir o módulo HTTP real para uso em produção', () => {
      const module = { ...mockHttpModule };

      // setHttpModule não retorna nada, apenas define o estado global
      setHttpModule(module);

      // Verificar que a próxima criação usa o módulo definido
      const service = createServerService();
      expect(service).toBeDefined();
      expect(service).toHaveProperty('start');
      expect(service).toHaveProperty('stop');
      expect(service).toHaveProperty('isRunning');
    });

    it('deve aceitar e armazenar um HttpModule', () => {
      const module = { ...mockHttpModule };

      // Chamar setHttpModule
      expect(() => {
        setHttpModule(module);
      }).not.toThrow();

      // Verificar que o módulo foi armazenado criando um serviço sem parâmetro
      const service = createServerService();
      expect(service).toBeDefined();
    });
  });

  describe('createServerService', () => {
    it('deve criar ServerService com httpModule injetado', () => {
      const service = createServerService(mockHttpModule);

      expect(service).toBeDefined();
      expect(service).toHaveProperty('start');
      expect(service).toHaveProperty('stop');
      expect(service).toHaveProperty('isRunning');
      expect(typeof service.start).toBe('function');
      expect(typeof service.stop).toBe('function');
      expect(typeof service.isRunning).toBe('function');
    });

    it('deve usar httpModule fornecido no parâmetro', async () => {
      const customModule = { ...mockHttpModule };
      const service = createServerService(customModule);

      await service.start('wifi');

      expect(customModule.start).toHaveBeenCalled();
    });

    it('deve usar módulo HTTP padrão se foi setHttpModule chamado', async () => {
      const defaultModule = { ...mockHttpModule };
      setHttpModule(defaultModule);

      const service = createServerService();

      await service.start('wifi');

      expect(defaultModule.start).toHaveBeenCalled();
    });

    it('deve preferir httpModule do parâmetro sobre o padrão', async () => {
      const defaultModule = { ...mockHttpModule };
      const customModule = { ...mockHttpModule };

      setHttpModule(defaultModule);

      const service = createServerService(customModule);

      await service.start('wifi');

      // customModule deve ter sido chamado, pois é o parâmetro
      expect(customModule.start).toHaveBeenCalled();
    });
  });

  describe('integration', () => {
    it('deve criar instâncias independentes com módulos diferentes', async () => {
      const module1 = { ...mockHttpModule };
      const module2 = { ...mockHttpModule };

      const service1 = createServerService(module1);
      const service2 = createServerService(module2);

      await service1.start('wifi');
      await service2.start('hotspot');

      expect(module1.start).toHaveBeenCalled();
      expect(module2.start).toHaveBeenCalled();
    });
  });

  describe('usage patterns', () => {
    it('deve retornar serviço com todas as funções quando módulo é fornecido', () => {
      const customModule = { ...mockHttpModule };

      const service = createServerService(customModule);

      expect(service).toBeDefined();
      expect(service).toHaveProperty('start');
      expect(service).toHaveProperty('stop');
      expect(service).toHaveProperty('isRunning');
      expect(typeof service.start).toBe('function');
      expect(typeof service.stop).toBe('function');
      expect(typeof service.isRunning).toBe('function');
    });

    it('deve usar módulo global quando definido via setHttpModule', () => {
      const service = createServerService();

      expect(service).toBeDefined();
      expect(service).toHaveProperty('start');
      expect(service).toHaveProperty('stop');
      expect(service).toHaveProperty('isRunning');
    });
  });

  describe('error cases - branch coverage', () => {
    it('deve lançar erro se createServerService é chamado sem módulo e sem setHttpModule prévio', () => {
      // Usar jest.isolateModules para ter um estado "fresco" do módulo
      // onde realHttpModule não foi setado e nenhum parâmetro é fornecido
      jest.isolateModules(() => {
        // Dentro de isolateModules, importar uma cópia do módulo que não foi inicializado
        const {
          createServerService: isolatedCreateServerService,
        } = require('../serverServiceFactory');

        // Deve lançar erro porque realHttpModule é null e não há parâmetro
        expect(() => {
          isolatedCreateServerService();
        }).toThrow(/HttpModule não foi inicializado/);
      });
    });
  });
});

describe('services/index.ts - barrel exports', () => {
  it('deve exportar ServerService e tipos relacionados', () => {
    const barrel = require('../index');

    // Verificar que os exports principais estão definidos
    expect(barrel.ServerServiceImpl).toBeDefined();
    expect(barrel.ServerServiceError).toBeDefined();
    expect(barrel.createServerService).toBeDefined();
    expect(barrel.setHttpModule).toBeDefined();
  });
});
