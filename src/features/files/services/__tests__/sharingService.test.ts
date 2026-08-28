/**
 * Testes unitários para SharingServiceImpl.
 *
 * Testa:
 * - openAsync: abre com app padrão via Linking, cai para shareAsync como fallback
 * - shareAsync: abre share sheet via expo-sharing, valida disponibilidade
 */

import { Linking } from 'react-native';
import * as Sharing from 'expo-sharing';

import { SharingModule, SharingServiceImpl } from '../sharingService';

jest.mock('expo-sharing', () => ({
  isAvailableAsync: jest.fn(),
  shareAsync: jest.fn(),
}));

jest.mock('react-native', () => ({
  Linking: {
    canOpenURL: jest.fn(),
    openURL: jest.fn(),
  },
}));

describe('SharingServiceImpl', () => {
  let sharingService: SharingModule;

  beforeEach(() => {
    sharingService = new SharingServiceImpl();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('openAsync', () => {
    it('quando Linking.canOpenURL retorna true, chama Linking.openURL(uri), não chama shareAsync', async () => {
      const uri = 'file:///private/doc.pdf';
      jest.mocked(Linking.canOpenURL).mockResolvedValue(true);
      jest.mocked(Linking.openURL).mockResolvedValue(undefined);

      await sharingService.openAsync(uri);

      expect(jest.mocked(Linking.canOpenURL)).toHaveBeenCalledWith(uri);
      expect(jest.mocked(Linking.openURL)).toHaveBeenCalledWith(uri);
      expect(jest.mocked(Sharing.isAvailableAsync)).not.toHaveBeenCalled();
      expect(jest.mocked(Sharing.shareAsync)).not.toHaveBeenCalled();
    });

    it('quando Linking.canOpenURL retorna false, cai no fallback e chama shareAsync(uri)', async () => {
      const uri = 'file:///private/doc.pdf';
      jest.mocked(Linking.canOpenURL).mockResolvedValue(false);
      jest.mocked(Sharing.isAvailableAsync).mockResolvedValue(true);
      jest.mocked(Sharing.shareAsync).mockResolvedValue();

      await sharingService.openAsync(uri);

      expect(jest.mocked(Linking.canOpenURL)).toHaveBeenCalledWith(uri);
      expect(jest.mocked(Sharing.isAvailableAsync)).toHaveBeenCalled();
      expect(jest.mocked(Sharing.shareAsync)).toHaveBeenCalledWith(uri);
    });

    it('quando Linking.canOpenURL rejeita, cai no catch e tenta shareAsync como fallback; se shareAsync funcionar, não propaga erro', async () => {
      const uri = 'file:///private/doc.pdf';
      jest.mocked(Linking.canOpenURL).mockRejectedValue(new Error('Linking failed'));
      jest.mocked(Sharing.isAvailableAsync).mockResolvedValue(true);
      jest.mocked(Sharing.shareAsync).mockResolvedValue();

      await expect(sharingService.openAsync(uri)).resolves.toBeUndefined();

      expect(jest.mocked(Sharing.shareAsync)).toHaveBeenCalledWith(uri);
    });

    it('quando Linking.canOpenURL rejeita e o fallback shareAsync também falha, propaga o erro ORIGINAL de canOpenURL', async () => {
      const uri = 'file:///private/doc.pdf';
      jest.mocked(Linking.canOpenURL).mockRejectedValue(new Error('Linking failed'));
      jest.mocked(Sharing.isAvailableAsync).mockResolvedValue(true);
      jest.mocked(Sharing.shareAsync).mockRejectedValue(new Error('Fallback error'));

      await expect(sharingService.openAsync(uri)).rejects.toThrow('Linking failed');
    });
  });

  describe('shareAsync', () => {
    it('quando Sharing.isAvailableAsync() retorna true, chama Sharing.shareAsync(uri) com o uri correto', async () => {
      const uri = 'file:///private/doc.pdf';
      jest.mocked(Sharing.isAvailableAsync).mockResolvedValue(true);
      jest.mocked(Sharing.shareAsync).mockResolvedValue();

      await sharingService.shareAsync(uri);

      expect(jest.mocked(Sharing.isAvailableAsync)).toHaveBeenCalled();
      expect(jest.mocked(Sharing.shareAsync)).toHaveBeenCalledWith(uri);
    });

    it('quando Sharing.isAvailableAsync() retorna false, lança erro sem chamar Sharing.shareAsync', async () => {
      const uri = 'file:///private/doc.pdf';
      jest.mocked(Sharing.isAvailableAsync).mockResolvedValue(false);

      await expect(sharingService.shareAsync(uri)).rejects.toThrow(
        'Compartilhamento não está disponível neste dispositivo',
      );
      expect(jest.mocked(Sharing.shareAsync)).not.toHaveBeenCalled();
    });

    it('quando Sharing.shareAsync() rejeita, o erro é propagado', async () => {
      const uri = 'file:///private/doc.pdf';
      jest.mocked(Sharing.isAvailableAsync).mockResolvedValue(true);
      jest.mocked(Sharing.shareAsync).mockRejectedValue(new Error('Share failed'));

      await expect(sharingService.shareAsync(uri)).rejects.toThrow('Share failed');
    });
  });
});
