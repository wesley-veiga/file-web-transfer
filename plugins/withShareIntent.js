// @ts-check
/**
 * Expo config plugin — Share Intent Android para aceitar compartilhamento do SO (T-901).
 *
 * ## Por que um plugin customizado em vez de uma lib pronta
 * Investigação do ecossistema Expo SDK 57 (até fevereiro de 2025) não encontrou uma lib oficial
 * ou estável que implementasse share intent (ACTION_SEND/ACTION_SEND_MULTIPLE) como um config
 * plugin gerenciado. Alternativas comunitárias identificadas:
 *
 * - `react-native-share-intent` (GitHub: react-native-share-intent/react-native-share-intent):
 *   comunitária, pouco mantida, última release 2023.
 * - `react-native-share` (Rapsssito/react-native-share): focada em ENVIAR para outro app via
 *   share sheet do SO (equivalente a `expo-sharing`), não em RECEBER.
 *
 * Como o intent filter é uma mudança simples no AndroidManifest.xml (sem código nativo
 * adicional necessário), implementar um plugin customizado é mais direto e garante compatibilidade
 * total com o Expo Router e a arquitetura atual do projeto.
 *
 * ## O que este plugin gera em `android/`
 * - Intent filter na activity principal (MainActivity via Expo Router) para:
 *   - android.intent.action.SEND (um arquivo)
 *   - android.intent.action.SEND_MULTIPLE (múltiplos arquivos)
 * - Data type *\/* (aceita qualquer tipo de arquivo)
 * - Categoria android.intent.category.DEFAULT (necessária para que o intent implícito funcione)
 *
 * ## Verificação
 * `npx expo prebuild --platform android` (rodado neste PR) e inspeção do
 * `android/app/src/main/AndroidManifest.xml` gerado — o intent filter deve aparecer dentro
 * da `<activity>` principal, irmão das categorias DEFAULT e LAUNCHER já geradas pelo Expo Router.
 */

const { withAndroidManifest, AndroidConfig } = require('expo/config-plugins');

const SHARE_INTENT_ACTIONS = ['android.intent.action.SEND', 'android.intent.action.SEND_MULTIPLE'];

const SHARE_INTENT_CATEGORIES = ['android.intent.category.DEFAULT'];

/**
 * Adiciona o intent filter para compartilhamento (SEND/SEND_MULTIPLE) à activity principal.
 * @type {import('expo/config-plugins').ConfigPlugin}
 */
function withShareIntentManifest(config) {
  return withAndroidManifest(config, (config) => {
    const mainActivity = AndroidConfig.Manifest.getMainActivityOrThrow(config.modResults);

    // Nota (correção pós-T-901): a chave precisa ser exatamente 'intent-filter' (kebab-case),
    // pois o builder de XML do Expo usa a chave do objeto como nome literal da tag. Usar
    // `intentFilter` (camelCase) gera uma tag `<intentFilter>` inválida, silenciosamente
    // ignorada pelo Android — o app nunca aparecia no menu de compartilhar do SO.
    if (!mainActivity['intent-filter']) {
      mainActivity['intent-filter'] = [];
    }

    // Verifica se o intent filter de SEND já existe para evitar duplicatas
    const shareIntentFilterExists = mainActivity['intent-filter'].some((filter) => {
      const actions = filter.action || [];
      return actions.some((action) => SHARE_INTENT_ACTIONS.includes(action.$['android:name']));
    });

    if (!shareIntentFilterExists) {
      // Cria um novo intent filter para compartilhamento
      const shareIntentFilter = {
        action: SHARE_INTENT_ACTIONS.map((action) => ({
          $: { 'android:name': action },
        })),
        category: SHARE_INTENT_CATEGORIES.map((category) => ({
          $: { 'android:name': category },
        })),
        data: [
          {
            $: { 'android:mimeType': '*/*' },
          },
        ],
      };

      mainActivity['intent-filter'].push(shareIntentFilter);
    }

    return config;
  });
}

/**
 * Plugin completo: adiciona o intent filter para compartilhamento do SO.
 * @type {import('expo/config-plugins').ConfigPlugin}
 */
function withShareIntent(config) {
  config = withShareIntentManifest(config);
  return config;
}

module.exports = withShareIntent;
