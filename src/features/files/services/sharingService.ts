/**
 * Serviço de compartilhamento e abertura de arquivos.
 *
 * Interface e implementação para operações nativas de compartilhamento
 * (share sheet) e abertura de arquivos com app padrão.
 *
 * Injeção de dependência permite mockar em testes.
 */

import { Linking } from 'react-native';
import * as Sharing from 'expo-sharing';

/**
 * Interface do módulo de sharing — wrappers nativos de Linking e expo-sharing.
 * Injetável para testes.
 */
export interface SharingModule {
  /** Abre o arquivo com o app padrão do sistema (ex.: PDF com PDF viewer). */
  openAsync: (uri: string) => Promise<void>;

  /** Abre o share sheet nativo do sistema para compartilhar o arquivo. */
  shareAsync: (uri: string) => Promise<void>;
}

/**
 * Implementação concreta do serviço de sharing.
 */
export class SharingServiceImpl implements SharingModule {
  async openAsync(uri: string): Promise<void> {
    try {
      // No iOS, Linking.openURL() funciona com file:// URIs diretamente.
      // No Android, precisa de content:// URI. Tentamos primeiro com file://,
      // e se falhar, caímos para o compartilhamento como fallback.
      const canOpen = await Linking.canOpenURL(uri);
      if (canOpen) {
        await Linking.openURL(uri);
      } else {
        // Se não conseguir abrir diretamente, tenta compartilhar como fallback
        // (o share sheet permite ao usuário escolher um app para abrir)
        await this.shareAsync(uri);
      }
    } catch (error) {
      console.error('[SharingService] Erro ao abrir arquivo:', uri, error);
      // Fallback: compartilhar como alternativa
      try {
        await this.shareAsync(uri);
      } catch {
        // Se ambas falharem, propagar o erro original
        throw error;
      }
    }
  }

  async shareAsync(uri: string): Promise<void> {
    try {
      const isAvailable = await Sharing.isAvailableAsync();
      if (!isAvailable) {
        throw new Error('Compartilhamento não está disponível neste dispositivo');
      }

      await Sharing.shareAsync(uri);
    } catch (error) {
      console.error('[SharingService] Erro ao compartilhar arquivo:', uri, error);
      throw error;
    }
  }
}
