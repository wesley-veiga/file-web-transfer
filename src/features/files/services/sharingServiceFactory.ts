/**
 * Factory para criar instâncias de SharingService com injeção de dependência.
 *
 * Uso:
 * - Produção: `createSharingService()` sem argumentos (usa expo-sharing e Linking reais)
 * - Testes: `createSharingService(mockModule)` com mock
 *
 * Padrão: setter + factory, similar a fileRepositoryFactory.ts
 */

import type { SharingModule } from './sharingService';
import { SharingServiceImpl } from './sharingService';

// Placeholder para o módulo SharingModule real (será setado durante inicialização)
let realSharingModule: SharingModule | null = null;

/**
 * Define o módulo Sharing real a ser usado em produção.
 * Será chamado uma vez durante a inicialização do app.
 */
export function setSharingModule(module: SharingModule): void {
  realSharingModule = module;
}

/**
 * Cria instância do SharingService.
 *
 * @param sharingModule Módulo Sharing a usar (padrão: módulo real em produção)
 * @returns Nova instância de SharingService (que é um SharingModule)
 */
export function createSharingService(sharingModule?: SharingModule): SharingModule {
  const module = sharingModule ?? realSharingModule ?? new SharingServiceImpl();

  return module;
}
