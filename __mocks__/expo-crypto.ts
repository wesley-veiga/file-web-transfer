/**
 * Mock manual do módulo `expo-crypto` (para T-301 · FileRepository).
 *
 * Jest carrega automaticamente qualquer arquivo em `__mocks__/<pacote>.ts` (adjacente a
 * `node_modules`) sempre que um teste importar esse pacote.
 *
 * Fornece apenas `randomUUID()` que é usado pelo FileRepository para gerar IDs.
 * A implementação padrão retorna um UUID determinístico para testes previsíveis;
 * em um teste específico, sobrescreva o comportamento com
 * `(Crypto.randomUUID as jest.Mock).mockReturnValueOnce('custom-uuid-...')`.
 */

let uuidCounter = 0;

export function randomUUID(): string {
  // Retorna um UUID v4 determinístico e única para cada chamada
  uuidCounter += 1;
  return `00000000-0000-4000-8000-00000000000${String(uuidCounter).padStart(3, '0')}`;
}

// Reset do counter para testes
export function __resetMockUUIDCounter(): void {
  uuidCounter = 0;
}
