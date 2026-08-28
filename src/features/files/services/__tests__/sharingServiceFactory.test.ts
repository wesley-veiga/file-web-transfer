/**
 * Testes unitários para a factory de SharingService.
 *
 * Testa:
 * - createSharingService(mockModule): retorna o módulo injetado
 * - setSharingModule + createSharingService(): retorna o módulo setado
 * - createSharingService() sem nada: retorna instância de SharingServiceImpl
 * - Prioridade: argumento explícito vence sobre módulo setado
 */

import { createSharingService, setSharingModule } from '../sharingServiceFactory';
import type { SharingModule } from '../sharingService';

describe('sharingServiceFactory', () => {
  it('retorna uma instância de SharingServiceImpl quando nada foi injetado nem setado', () => {
    jest.isolateModules(() => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const factory = require('../sharingServiceFactory');
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { SharingServiceImpl } = require('../sharingService');

      const service = factory.createSharingService();

      expect(service).toBeInstanceOf(SharingServiceImpl);
    });
  });

  it('retorna o módulo injetado por createSharingService(mockModule)', () => {
    const mockModule: SharingModule = {
      openAsync: jest.fn(),
      shareAsync: jest.fn(),
    };

    const service = createSharingService(mockModule);

    expect(service).toBe(mockModule);
  });

  it('retorna o módulo setado via setSharingModule seguido de createSharingService()', () => {
    jest.isolateModules(() => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const factory = require('../sharingServiceFactory');
      const mockModule: SharingModule = {
        openAsync: jest.fn(),
        shareAsync: jest.fn(),
      };

      factory.setSharingModule(mockModule);
      const service = factory.createSharingService();

      expect(service).toBe(mockModule);
    });
  });

  it('prioriza o módulo injetado explicitamente sobre o módulo setado', () => {
    const mockModule1: SharingModule = { openAsync: jest.fn(), shareAsync: jest.fn() };
    const mockModule2: SharingModule = { openAsync: jest.fn(), shareAsync: jest.fn() };

    setSharingModule(mockModule1);
    const service = createSharingService(mockModule2);

    expect(service).toBe(mockModule2);
  });
});
