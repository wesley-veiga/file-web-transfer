import * as Network from 'expo-network';
import { generateSessionId } from '../../../shared/lib';
import type { ServerErrorCode, NetworkMode } from '../types';
import type { HttpModule } from './httpModule';

/**
 * Tempo máximo de espera por uma chamada ao `HttpModule` nativo (`start`/`stop`).
 *
 * Achado em T-701 (teste manual em dispositivo real, Android): a Promise nativa do
 * `HttpModule` pode nunca resolver nem rejeitar em determinadas condições de
 * hardware, deixando `ServerServiceImpl.start()` — e a UI, presa em `starting` —
 * travados indefinidamente ("loading infinito"). `withTimeout` garante que toda
 * chamada ao módulo nativo sempre termine (com sucesso ou erro mapeável), nunca
 * trava para sempre.
 */
const NATIVE_CALL_TIMEOUT_MS = 8000;

/**
 * Nome usado para marcar o erro lançado por `withTimeout` — permite que quem
 * captura o erro distinga "a chamada nativa nunca respondeu" de outros erros sem
 * depender do texto da mensagem (que poderia colidir com heurísticas de texto como
 * a de `findAvailablePort()`, que procura por "porta em uso" na mensagem).
 */
const TIMEOUT_ERROR_NAME = 'NativeCallTimeoutError';

/**
 * Rejeita com `timeoutMessage` (erro nomeado `TIMEOUT_ERROR_NAME`) se `promise` não
 * resolver/rejeitar dentro de `ms`. Não cancela a `promise` original (não há como,
 * para uma Promise nativa) — apenas garante que quem está aguardando nunca fique
 * travado esperando por ela.
 */
function withTimeout<T>(promise: Promise<T>, ms: number, timeoutMessage: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      const timeoutError = new Error(timeoutMessage);
      timeoutError.name = TIMEOUT_ERROR_NAME;
      reject(timeoutError);
    }, ms);

    // `Promise.resolve(promise)` (em vez de `promise.then(...)` direto) protege
    // contra uma implementação de `HttpModule` que não retorne uma Promise de
    // verdade (ex.: mock de teste sem valor configurado, ou módulo nativo que
    // devolva `undefined`) — sem isso, `.then` de `undefined` lançaria antes
    // mesmo do timeout ter chance de proteger a chamada.
    Promise.resolve(promise).then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

/**
 * Resultado de `ServerService.start()`: informações necessárias para popular `ServerInfo`.
 */
export interface ServerStartResult {
  ip: string;
  port: number;
  url: string;
  sessionId: string;
  networkMode: NetworkMode;
}

/**
 * Serviço injetável de servidor HTTP.
 *
 * Responsabilidades:
 * - Obter IP local (Wi-Fi)
 * - Tentar portas livre começando de 8080 (fallback incremental)
 * - Iniciar/parar o servidor HTTP
 * - Gerar sessionId
 * - Mapear erros de inicialização para `ServerErrorCode`
 *
 * Implementa a HU-01 e HU-02 de `transferir.md`.
 */
export interface ServerService {
  /**
   * Inicia o servidor HTTP.
   *
   * @param networkMode Interface de rede a usar (único valor suportado: 'wifi')
   * @returns Informações do servidor iniciado
   * @throws ServerError com code específico (NO_NETWORK, PORT_UNAVAILABLE, etc.)
   */
  start: (networkMode: NetworkMode) => Promise<ServerStartResult>;

  /**
   * Para o servidor HTTP.
   */
  stop: () => Promise<void>;

  /**
   * Verifica se o servidor está rodando.
   */
  isRunning: () => boolean;
}

/**
 * Classe concreta que implementa `ServerService`.
 */
export class ServerServiceImpl implements ServerService {
  private readonly httpModule: HttpModule;
  private readonly minPort: number = 8080;
  private readonly maxPort: number = 8089;

  constructor(httpModule: HttpModule) {
    this.httpModule = httpModule;
  }

  async start(networkMode: NetworkMode): Promise<ServerStartResult> {
    try {
      // Obter IP local conforme o modo de rede
      const ip = await this.getLocalIp(networkMode);
      if (!ip) {
        throw this.createServerError('NO_NETWORK', 'Nenhuma rede disponível');
      }

      // Tentar portas com fallback
      const port = await this.findAvailablePort();
      if (!port) {
        throw this.createServerError('PORT_UNAVAILABLE', 'Nenhuma porta livre disponível');
      }

      // Iniciar servidor HTTP na porta encontrada
      await withTimeout(
        this.httpModule.start(port),
        NATIVE_CALL_TIMEOUT_MS,
        'Tempo esgotado ao iniciar o servidor HTTP',
      );

      // Gerar sessionId
      const sessionId = generateSessionId();

      // Construir URL completa
      const url = `http://${ip}:${port}`;

      return {
        ip,
        port,
        url,
        sessionId,
        networkMode,
      };
    } catch (error) {
      // Se já é ServerServiceError, relançar
      if (error instanceof ServerServiceError) {
        throw error;
      }

      // Tentar inferir o erro
      if (error instanceof Error) {
        const message = error.message.toLowerCase();
        if (message.includes('network') || message.includes('offline')) {
          throw this.createServerError('NO_NETWORK', 'Nenhuma rede disponível');
        }
      }

      // Erro desconhecido
      throw this.createServerError('UNKNOWN', 'Erro desconhecido ao iniciar servidor');
    }
  }

  async stop(): Promise<void> {
    await withTimeout(
      this.httpModule.stop(),
      NATIVE_CALL_TIMEOUT_MS,
      'Tempo esgotado ao parar o servidor HTTP',
    );
  }

  isRunning(): boolean {
    return this.httpModule.isRunning();
  }

  /**
   * Obtém o IP da rede Wi-Fi atual.
   */
  private async getLocalIp(networkMode: NetworkMode): Promise<string | null> {
    try {
      const state = await Network.getNetworkStateAsync();

      // Se não há nenhuma conectividade, retornar null
      if (!state.isConnected) {
        return null;
      }

      // Tentar obter IP via expo-network
      const ip = await Network.getIpAddressAsync();
      return ip;
    } catch {
      // Se expo-network falhar (improvável mas possível), retornar null
      return null;
    }
  }

  /**
   * Tenta encontrar uma porta livre começando de `minPort` até `maxPort`.
   *
   * Estratégia:
   * - Tenta cada porta sequencialmente chamando httpModule.start(port)
   * - Se start() lançar erro de "port already in use" ou similar, tenta a próxima
   * - Retorna a primeira porta que conseguir iniciar o servidor
   * - Retorna null se nenhuma porta no intervalo estiver disponível
   *
   * Nota: `findAvailablePort()` inicia e para o servidor para cada tentativa,
   * pois não há forma de verificar disponibilidade sem tentar bind. O servidor
   * é parado imediatamente após verificação bem-sucedida (antes de retornar).
   */
  private async findAvailablePort(): Promise<number | null> {
    for (let port = this.minPort; port <= this.maxPort; port++) {
      try {
        // Tentar iniciar na porta
        await withTimeout(
          this.httpModule.start(port),
          NATIVE_CALL_TIMEOUT_MS,
          'Tempo esgotado ao testar disponibilidade de porta',
        );

        // Se chegou aqui, porta está disponível
        // Parar servidor imediatamente (será reiniciado em start() com dados finais)
        await withTimeout(
          this.httpModule.stop(),
          NATIVE_CALL_TIMEOUT_MS,
          'Tempo esgotado ao liberar porta de teste',
        );

        return port;
      } catch (error) {
        // Timeout: a chamada nativa nunca respondeu — não é "porta em uso", não
        // adianta tentar a próxima (o módulo nativo provavelmente está travado
        // para qualquer porta). Propaga imediatamente em vez de repetir o timeout
        // até 10x (achado em T-701 — ver comentário de `NATIVE_CALL_TIMEOUT_MS`).
        if (error instanceof Error && error.name === TIMEOUT_ERROR_NAME) {
          throw error;
        }

        // Se erro é "porta em uso", tenta a próxima
        if (error instanceof Error) {
          const message = error.message.toLowerCase();
          if (
            message.includes('port') ||
            message.includes('already in use') ||
            message.includes('eaddrinuse')
          ) {
            // Porta ocupada, tenta a próxima
            continue;
          }
        }

        // Se não é erro de porta, relança (pode ser outro problema)
        throw error;
      }
    }

    // Nenhuma porta disponível no intervalo
    return null;
  }

  /**
   * Cria um ServerServiceError tipado.
   */
  private createServerError(code: ServerErrorCode, message: string): ServerServiceError {
    return new ServerServiceError(code, message);
  }
}

/**
 * Erro tipado do ServerService.
 * Permite o `serverStore` capturar e converter em `ServerInfo.error`.
 */
export class ServerServiceError extends Error {
  readonly code: ServerErrorCode;
  readonly message: string;

  constructor(code: ServerErrorCode, message: string) {
    super(message);
    this.name = 'ServerServiceError';
    this.code = code;
    this.message = message;
  }
}
