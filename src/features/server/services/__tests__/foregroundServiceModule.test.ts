/**
 * Testes unitários para foregroundServiceModule (T-807 — ponte JS para o foreground
 * service Android nativo gerado por `plugins/withForegroundService.js`).
 *
 * Testa `createDefaultForegroundServiceModule()`:
 * - Android com o módulo nativo `TransferForegroundService` presente: delega start/stop
 *   para ele, repassando os argumentos corretos (caminho feliz).
 * - iOS: sempre no-op (foreground service é conceito exclusivo Android) — start/stop não
 *   lançam e não tocam em `NativeModules`.
 * - Android sem o módulo nativo disponível (ex.: Expo Go, que não roda o config plugin, ou
 *   um build sem `expo prebuild` atualizado): cai para no-op silenciosamente, sem lançar
 *   erro não tratado — nunca deve impedir o servidor de iniciar.
 */

import { NativeModules, Platform } from 'react-native';
import { createDefaultForegroundServiceModule } from '../foregroundServiceModule';

describe('createDefaultForegroundServiceModule', () => {
  afterEach(() => {
    // `NativeModules` é um objeto mutável compartilhado pelo mock global de
    // `react-native` (jest.setup.ts) — remove qualquer módulo nativo injetado por um
    // teste para não vazar estado entre casos.
    delete (NativeModules as Record<string, unknown>).TransferForegroundService;
  });

  describe('no Android, com o módulo nativo disponível', () => {
    beforeEach(() => {
      (Platform as { OS: string }).OS = 'android';
    });

    it('delega start() para o módulo nativo, repassando title/body', () => {
      const nativeStart = jest.fn();
      const nativeStop = jest.fn();
      (NativeModules as Record<string, unknown>).TransferForegroundService = {
        start: nativeStart,
        stop: nativeStop,
      };

      const module = createDefaultForegroundServiceModule();
      module.start('Servidor ativo', 'Compartilhando arquivos na rede local');

      expect(nativeStart).toHaveBeenCalledWith(
        'Servidor ativo',
        'Compartilhando arquivos na rede local',
      );
      expect(nativeStop).not.toHaveBeenCalled();
    });

    it('delega stop() para o módulo nativo', () => {
      const nativeStart = jest.fn();
      const nativeStop = jest.fn();
      (NativeModules as Record<string, unknown>).TransferForegroundService = {
        start: nativeStart,
        stop: nativeStop,
      };

      const module = createDefaultForegroundServiceModule();
      module.stop();

      expect(nativeStop).toHaveBeenCalledTimes(1);
      expect(nativeStart).not.toHaveBeenCalled();
    });

    it('isAvailable() retorna true quando o módulo nativo está disponível (T-808)', () => {
      (NativeModules as Record<string, unknown>).TransferForegroundService = {
        start: jest.fn(),
        stop: jest.fn(),
      };

      const module = createDefaultForegroundServiceModule();
      expect(module.isAvailable()).toBe(true);
    });
  });

  describe('no Android, sem o módulo nativo disponível (ex.: Expo Go)', () => {
    beforeEach(() => {
      (Platform as { OS: string }).OS = 'android';
      // Garante ausência explícita — reflete `NativeModules.TransferForegroundService`
      // undefined, como acontece quando o config plugin nunca rodou (Expo Go, ou build
      // sem `expo prebuild` atualizado).
      delete (NativeModules as Record<string, unknown>).TransferForegroundService;
    });

    it('cai para no-op: start()/stop() não lançam erro não tratado', () => {
      const module = createDefaultForegroundServiceModule();

      expect(() => module.start('Servidor ativo', 'Compartilhando arquivos')).not.toThrow();
      expect(() => module.stop()).not.toThrow();
    });

    it('isAvailable() retorna false quando o módulo nativo não está disponível (T-808)', () => {
      const module = createDefaultForegroundServiceModule();
      expect(module.isAvailable()).toBe(false);
    });
  });

  describe('no iOS', () => {
    beforeEach(() => {
      (Platform as { OS: string }).OS = 'ios';
    });

    it('é sempre no-op, mesmo com um módulo nativo "TransferForegroundService" presente por engano', () => {
      const nativeStart = jest.fn();
      const nativeStop = jest.fn();
      (NativeModules as Record<string, unknown>).TransferForegroundService = {
        start: nativeStart,
        stop: nativeStop,
      };

      const module = createDefaultForegroundServiceModule();

      expect(() => module.start('Servidor ativo', 'Compartilhando arquivos')).not.toThrow();
      expect(() => module.stop()).not.toThrow();
      // Foreground service é conceito exclusivo Android — o módulo nativo nunca deve ser
      // chamado no iOS, mesmo que por acaso exista em `NativeModules`.
      expect(nativeStart).not.toHaveBeenCalled();
      expect(nativeStop).not.toHaveBeenCalled();
    });

    it('isAvailable() retorna false — iOS não tem foreground service equivalente (T-808)', () => {
      const module = createDefaultForegroundServiceModule();
      expect(module.isAvailable()).toBe(false);
    });
  });

  describe('em outras plataformas (ex.: web)', () => {
    beforeEach(() => {
      (Platform as { OS: string }).OS = 'web';
    });

    it('é sempre no-op e não lança', () => {
      const module = createDefaultForegroundServiceModule();

      expect(() => module.start('Servidor ativo', 'Compartilhando arquivos')).not.toThrow();
      expect(() => module.stop()).not.toThrow();
    });

    it('isAvailable() retorna false — web não tem foreground service (T-808)', () => {
      const module = createDefaultForegroundServiceModule();
      expect(module.isAvailable()).toBe(false);
    });
  });
});
