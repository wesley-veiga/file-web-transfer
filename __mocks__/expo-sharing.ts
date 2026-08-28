/**
 * Mock de expo-sharing para testes.
 */

export const Sharing = {
  isAvailableAsync: jest.fn(async () => true),
  shareAsync: jest.fn(async () => {}),
};

export const isAvailableAsync = Sharing.isAvailableAsync;
export const shareAsync = Sharing.shareAsync;
