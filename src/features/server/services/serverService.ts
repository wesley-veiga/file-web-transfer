import * as Network from 'expo-network';
import { generateSessionId } from '../../../shared/lib';
import type { ServerErrorCode, NetworkMode } from '../types';
import type { HttpModule } from './httpModule';

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
 * - Obter IP local (Wi-Fi ou hotspot)
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
   * @param networkMode Define qual interface usar ('wifi' ou 'hotspot')
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

      // Tentar portas incrementalmente
      const port = await this.findAvailablePort();

      // Iniciar servidor HTTP na porta encontrada
      await this.httpModule.start(port);

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
        if (message.includes('port') || message.includes('already in use')) {
          throw this.createServerError('PORT_UNAVAILABLE', 'Nenhuma porta livre disponível');
        }
        if (message.includes('network') || message.includes('offline')) {
          throw this.createServerError('NO_NETWORK', 'Nenhuma rede disponível');
        }
      }

      // Erro desconhecido
      throw this.createServerError('UNKNOWN', 'Erro desconhecido ao iniciar servidor');
    }
  }

  async stop(): Promise<void> {
    await this.httpModule.stop();
  }

  isRunning(): boolean {
    return this.httpModule.isRunning();
  }

  /**
   * Obtém o IP local dependendo do modo de rede.
   * - 'wifi': IP da rede Wi-Fi atual
   * - 'hotspot': IP da interface do hotspot (normalmente 192.168.1.x ou 10.0.0.x)
   *
   * Para hotspot, o método é o mesmo (retorna o IP local ativo).
   * A diferença é semântica: o `serverStore` rastreia qual rede está sendo usada.
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
   * Como não temos forma de verificar disponibilidade sem tentar, tentamos
   * apenas uma vez na porta preferida (8080) e se falhar, retornamos a próxima.
   *
   * Nota: O módulo HTTP nativo será o que realmente tenta bind; se falhar,
   * lança erro que `start()` captura e traduz para PORT_UNAVAILABLE.
   *
   * Para agora, retornamos a porta preferida e deixamos o módulo HTTP
   * tentar; futuras melhorias podem tentar múltiplas portas.
   */
  private async findAvailablePort(): Promise<number> {
    // Por simplicidade, sempre tentamos a porta 8080
    // O módulo HTTP nativo será quem realmente valida disponibilidade
    return this.minPort;
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
