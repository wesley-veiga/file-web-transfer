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
  // Retorna um UUID determinístico e único para cada chamada
  // Formato válido conforme validação Zod de UUID (RFC 4122):
  // xxxxxxxx-xxxx-[1-8]xxx-[89ab]xxx-xxxxxxxxxxxx (36 chars total)
  uuidCounter += 1;
  const counter = String(uuidCounter).padStart(24, '0'); // 24 dígitos para 3 + 3 + 12

  // Position 14 (version): use 1-8 (we use cyclic 1-8 to vary)
  const version = String((uuidCounter % 8) + 1);
  // Position 19 (variant): use 8, 9, a, or b (we use cyclic)
  const variants = ['8', '9', 'a', 'b'];
  const variant = variants[uuidCounter % 4];

  return `00000000-0000-${version}${counter.substring(0, 3)}-${variant}${counter.substring(3, 6)}-${counter.substring(6, 18)}`;
}

// Reset do counter para testes
export function __resetMockUUIDCounter(): void {
  uuidCounter = 0;
}
