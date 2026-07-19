/**
 * Factory para criar instâncias do `ServerService` com injeção de dependência.
 *
 * Uso:
 * - Produção: `createServerService()` sem argumentos (usa módulo HTTP real)
 * - Testes: `createServerService(mockHttpModule)` com mock
 *
 * A implementação do módulo HTTP real será adicionada conforme T-202 (spike HTTP)
 * evoluir. Por enquanto, é um placeholder que permite compilação e testes com mock.
 */

import type { HttpModule } from './httpModule';
import { ServerServiceImpl } from './serverService';
import type { ServerService } from './serverService';

// Placeholder para o módulo HTTP real (será implementado em T-203 integrando com a lib escolhida)
let realHttpModule: HttpModule | null = null;

/**
 * Define o módulo HTTP real a ser usado em produção.
 * Será chamado uma vez durante a inicialização do app.
 */
export function setHttpModule(module: HttpModule): void {
  realHttpModule = module;
}

/**
 * Cria instância do ServerService.
 *
 * @param httpModule Módulo HTTP a usar (padrão: módulo real em produção)
 * @returns Nova instância de ServerService
 */
export function createServerService(httpModule?: HttpModule): ServerService {
  const module = httpModule ?? realHttpModule;

  if (!module) {
    throw new Error(
      'HttpModule não foi inicializado. Chame setHttpModule() durante a inicialização do app.',
    );
  }

  return new ServerServiceImpl(module);
}
