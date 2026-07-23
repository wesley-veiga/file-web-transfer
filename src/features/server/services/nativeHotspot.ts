/**
 * Contrato do módulo nativo de Hotspot para Android.
 *
 * Este módulo define a interface que será implementada como módulo Kotlin
 * via Expo Config Plugin. Para testes, essa interface é mockada via Jest.
 *
 * Referência: ADR-002 — Rede Própria no Android 14+
 */

/**
 * Resultado retornado por startLocalOnlyHotspot().
 * Contém as credenciais geradas pelo sistema e informações de rede.
 */
export interface NativeHotspotResult {
  ssid: string;
  password: string;
  ip: string;
  gateway?: string; // ex.: "192.168.43.1"; opcional se não obtido
}

/**
 * Códigos de erro retornados pelo módulo nativo.
 * Será mapeado para ServerErrorCode no HotspotService.
 */
export type NativeHotspotErrorCode =
  | 'UNSUPPORTED' // Device/OS não suporta Local Only Hotspot
  | 'PERMISSION_DENIED' // Permissão negada pelo usuário (NEARBY_WIFI_DEVICES)
  | 'FAILED' // Falha ao criar hotspot (motivo desconhecido)
  | 'TIMEOUT' // Callback de criação não respondeu em tempo hábil
  | 'NOT_RUNNING'; // Tentativa de operação sem hotspot ativo

/**
 * Interface do módulo nativo de hotspot.
 * Será exposto via NativeModules (React Native) no código nativo.
 *
 * Todos os métodos rejeitam a Promise com uma string
 * correspondente a um valor de NativeHotspotErrorCode.
 */
export const NativeHotspot = {
  /**
   * Inicia um Local Only Hotspot no Android.
   *
   * @returns Promise resolvida com NativeHotspotResult contendo
   *         SSID, password e IP da interface criada
   * @throws Rejeita com NativeHotspotErrorCode em caso de erro
   */
  startLocalOnlyHotspot: async (): Promise<NativeHotspotResult> => {
    throw new Error(
      'NativeHotspot.startLocalOnlyHotspot not implemented. This method must be bound to the native module.',
    );
  },

  /**
   * Para o Local Only Hotspot no Android.
   * Libera a reserva e desativa a interface.
   *
   * @throws Rejeita com 'NOT_RUNNING' se nenhum hotspot está ativo
   */
  stopLocalOnlyHotspot: async (): Promise<void> => {
    throw new Error(
      'NativeHotspot.stopLocalOnlyHotspot not implemented. This method must be bound to the native module.',
    );
  },

  /**
   * Obtém a configuração atual do hotspot se estiver ativo.
   *
   * @returns Promise resolvida com NativeHotspotResult se hotspot está ativo,
   *         null se nenhum hotspot está ativo
   * @throws Rejeita com erro técnico em caso de falha
   */
  getHotspotConfig: async (): Promise<NativeHotspotResult | null> => {
    throw new Error(
      'NativeHotspot.getHotspotConfig not implemented. This method must be bound to the native module.',
    );
  },
};

/**
 * Tipo inferencido da interface do módulo nativo.
 * Usado para typing correto em injeção de dependência.
 */
export type NativeHotspotModule = typeof NativeHotspot;
