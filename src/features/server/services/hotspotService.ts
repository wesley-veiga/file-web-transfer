import { Platform } from 'react-native';
import * as Network from 'expo-network';
import type { HotspotInfo, ServerErrorCode } from '../types';
import type {
  NativeHotspotModule,
  NativeHotspotResult,
  NativeHotspotErrorCode,
} from './nativeHotspot';

/**
 * Resultado de `HotspotService.createHotspot()`: informações da rede própria criada.
 */
export interface HotspotCreateResult {
  hotspotInfo: HotspotInfo;
}

/**
 * Serviço injetável de rede própria (Local Only Hotspot no Android, Hotspot Pessoal no iOS).
 *
 * Responsabilidades:
 * - Criar hotspot no Android via módulo nativo
 * - Desligar hotspot criado
 * - Detectar Hotspot Pessoal ativo no iOS (via gateway 172.20.10.1)
 * - Transformar NativeHotspotResult em HotspotInfo (com wifiQrPayload)
 * - Mapear erros nativos para ServerErrorCode
 *
 * Implementa a parte técnica da HU-08 (Modo Rede Própria).
 */
export interface HotspotService {
  /**
   * Cria um hotspot (Android) ou detecta se Hotspot Pessoal está ativo (iOS).
   *
   * No Android: chama startLocalOnlyHotspot() do módulo nativo.
   * No iOS: verifica se o gateway é 172.20.10.1 (indicador de Hotspot Pessoal ativo).
   *
   * @returns Informações do hotspot criado/ativo
   * @throws HotspotServiceError com code específico (HOTSPOT_UNSUPPORTED, HOTSPOT_FAILED, PERMISSION_DENIED)
   */
  createHotspot: () => Promise<HotspotCreateResult>;

  /**
   * Desliga o hotspot criado.
   *
   * No Android: chama stopLocalOnlyHotspot() do módulo nativo.
   * No iOS: nenhuma ação (hotspot manual, usuário desativa nas Configurações).
   *
   * @throws HotspotServiceError em caso de falha ao desligar
   */
  stopHotspot: () => Promise<void>;

  /**
   * Verifica se um hotspot está ativo.
   *
   * No Android: chama getHotspotConfig() do módulo nativo.
   * No iOS: verifica se o gateway é 172.20.10.1.
   *
   * @returns Informações do hotspot se ativo, null caso contrário
   */
  isHotspotActive: () => Promise<HotspotInfo | null>;
}

/**
 * Classe concreta que implementa HotspotService.
 */
export class HotspotServiceImpl implements HotspotService {
  private readonly nativeModule: NativeHotspotModule;

  constructor(nativeModule: NativeHotspotModule) {
    this.nativeModule = nativeModule;
  }

  async createHotspot(): Promise<HotspotCreateResult> {
    try {
      if (Platform.OS === 'android') {
        return await this.createHotspotAndroid();
      } else if (Platform.OS === 'ios') {
        return await this.detectHotspotIos();
      } else {
        throw this.createHotspotError('HOTSPOT_UNSUPPORTED', 'Plataforma não suporta rede própria');
      }
    } catch (error) {
      // Se já é HotspotServiceError, relançar
      if (error instanceof HotspotServiceError) {
        throw error;
      }

      // Se é erro desconhecido, converter para HOTSPOT_FAILED
      throw this.createHotspotError('HOTSPOT_FAILED', 'Falha ao criar rede própria');
    }
  }

  async stopHotspot(): Promise<void> {
    try {
      if (Platform.OS === 'android') {
        await this.nativeModule.stopLocalOnlyHotspot();
      } else if (Platform.OS === 'ios') {
        // iOS: hotspot manual, nenhuma ação necessária
        return;
      }
    } catch (error) {
      // Mapear erro nativo para HotspotServiceError
      if (typeof error === 'string') {
        const nativeCode = error as unknown as NativeHotspotErrorCode;
        throw this.mapNativeErrorToHotspotError(nativeCode);
      }

      throw this.createHotspotError('HOTSPOT_FAILED', 'Falha ao desligar rede própria');
    }
  }

  async isHotspotActive(): Promise<HotspotInfo | null> {
    try {
      if (Platform.OS === 'android') {
        const config = await this.nativeModule.getHotspotConfig();
        if (!config) {
          return null;
        }
        return this.transformToHotspotInfo(config);
      } else if (Platform.OS === 'ios') {
        // iOS: detectar se Hotspot Pessoal está ativo
        const result = await this.detectHotspotIos();
        return result.hotspotInfo;
      }
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Cria hotspot no Android via módulo nativo.
   * Transforma NativeHotspotResult em HotspotInfo.
   */
  private async createHotspotAndroid(): Promise<HotspotCreateResult> {
    try {
      const nativeResult = await this.nativeModule.startLocalOnlyHotspot();
      const hotspotInfo = this.transformToHotspotInfo(nativeResult);
      return { hotspotInfo };
    } catch (error) {
      // Se a Promise rejeita, a rejeição vem como string (erro do módulo nativo)
      if (typeof error === 'string') {
        const nativeCode = error as unknown as NativeHotspotErrorCode;
        throw this.mapNativeErrorToHotspotError(nativeCode);
      }

      // Erro desconhecido
      throw this.createHotspotError('HOTSPOT_FAILED', 'Falha ao criar rede própria');
    }
  }

  /**
   * Detecta se Hotspot Pessoal está ativo no iOS.
   * Usa expo-network para obter o IP local.
   * IP no range 172.20.x.x indica que Hotspot Pessoal está ativo.
   */
  private async detectHotspotIos(): Promise<HotspotCreateResult> {
    try {
      const state = await Network.getNetworkStateAsync();

      if (!state.isConnected) {
        throw this.createHotspotError(
          'HOTSPOT_UNSUPPORTED',
          'Ative o Hotspot Pessoal nas Configurações',
        );
      }

      // Tentar obter IP da interface atual
      const ip = await Network.getIpAddressAsync();

      if (!ip) {
        throw this.createHotspotError('HOTSPOT_FAILED', 'Falha ao obter IP do hotspot');
      }

      // Se IP está no range 172.20.x.x, Hotspot Pessoal está ativo
      if (ip.startsWith('172.20.')) {
        // Criar HotspotInfo com valores padrão para iOS
        // (SSID e password não são facilmente obtidos, usar placeholders)
        const hotspotInfo: HotspotInfo = {
          ssid: 'Hotspot Pessoal',
          password: '',
          wifiQrPayload: '',
        };

        return { hotspotInfo };
      }

      throw this.createHotspotError(
        'HOTSPOT_UNSUPPORTED',
        'Ative o Hotspot Pessoal nas Configurações',
      );
    } catch (error) {
      if (error instanceof HotspotServiceError) {
        throw error;
      }

      throw this.createHotspotError(
        'HOTSPOT_UNSUPPORTED',
        'Ative o Hotspot Pessoal nas Configurações',
      );
    }
  }

  /**
   * Transforma NativeHotspotResult em HotspotInfo.
   * Gera o wifiQrPayload no formato ZXing.
   */
  private transformToHotspotInfo(nativeResult: NativeHotspotResult): HotspotInfo {
    const { ssid, password } = nativeResult;

    // Gerar wifiQrPayload no formato ZXing
    // Formato: WIFI:S:<ssid>;T:WPA;P:<password>;;
    const wifiQrPayload = `WIFI:S:${ssid};T:WPA;P:${password};;`;

    return {
      ssid,
      password,
      wifiQrPayload,
    };
  }

  /**
   * Mapeia erro nativo (NativeHotspotErrorCode) para ServerErrorCode.
   */
  private mapNativeErrorToHotspotError(nativeCode: NativeHotspotErrorCode): HotspotServiceError {
    const errorMap: Record<NativeHotspotErrorCode, ServerErrorCode> = {
      UNSUPPORTED: 'HOTSPOT_UNSUPPORTED',
      PERMISSION_DENIED: 'PERMISSION_DENIED',
      FAILED: 'HOTSPOT_FAILED',
      TIMEOUT: 'HOTSPOT_FAILED',
      NOT_RUNNING: 'HOTSPOT_FAILED',
    };

    const code = errorMap[nativeCode] || 'HOTSPOT_FAILED';

    const messages: Record<NativeHotspotErrorCode, string> = {
      UNSUPPORTED: 'Seu dispositivo não suporta criar uma rede própria',
      PERMISSION_DENIED: 'Permissão de rede negada',
      FAILED: 'Falha ao criar rede própria',
      TIMEOUT: 'Tempo esgotado ao criar rede própria',
      NOT_RUNNING: 'Rede própria não está ativa',
    };

    return new HotspotServiceError(code, messages[nativeCode]);
  }

  /**
   * Cria um HotspotServiceError tipado.
   */
  private createHotspotError(code: ServerErrorCode, message: string): HotspotServiceError {
    return new HotspotServiceError(code, message);
  }
}

/**
 * Erro tipado do HotspotService.
 * Permite o `serverStore` capturar e converter em `ServerInfo.error`.
 */
export class HotspotServiceError extends Error {
  readonly code: ServerErrorCode;
  readonly message: string;

  constructor(code: ServerErrorCode, message: string) {
    super(message);
    this.name = 'HotspotServiceError';
    this.code = code;
    this.message = message;
  }
}
