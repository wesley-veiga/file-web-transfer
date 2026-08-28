/**
 * Mock manual do módulo `expo-document-picker` (para T-302 · SharedFilesScreen).
 *
 * Jest carrega automaticamente este arquivo sempre que um teste importar
 * `expo-document-picker`.
 *
 * Fornece `getDocumentAsync()` que retorna `{ canceled: true, assets: null }`
 * por padrão (simula usuário cancelando o picker).
 *
 * Em testes específicos, sobrescreva com `mockResolvedValueOnce()` para simular
 * seleção de arquivos.
 */

export const getDocumentAsync = jest.fn(async () => ({
  canceled: true,
  assets: null,
}));

export default {
  getDocumentAsync,
};
