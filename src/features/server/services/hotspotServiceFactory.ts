/**
 * Factory para criar instâncias do `HotspotService` com injeção de dependência.
 *
 * Uso:
 * - Produção: `createHotspotService()` sem argumentos (usa módulo nativo real)
 * - Testes: `createHotspotService(mockNativeModule)` com mock
 */

import { NativeHotspot } from './nativeHotspot';
import { HotspotServiceImpl } from './hotspotService';
import type { HotspotService } from './hotspotService';
import type { NativeHotspotModule } from './nativeHotspot';

/**
 * Cria instância do HotspotService.
 *
 * @param nativeModule Módulo nativo a usar (padrão: NativeHotspot)
 * @returns Nova instância de HotspotService
 */
export function createHotspotService(nativeModule?: NativeHotspotModule): HotspotService {
  const module = nativeModule ?? NativeHotspot;
  return new HotspotServiceImpl(module);
}
