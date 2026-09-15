// @ts-check
/**
 * Expo config plugin — Leitura de Share Intent Payload do Android (T-903).
 *
 * ## Por que um plugin customizado em vez de uma lib pronta
 * Expo SDK 57 não oferece uma API oficial para RECEBER intents de compartilhamento
 * (ACTION_SEND/ACTION_SEND_MULTIPLE com EXTRA_STREAM). Há `expo-linking` (deep linking via
 * ACTION_VIEW), há `expo-sharing` (para ENVIAR via share sheet), mas nada para RECEBER.
 *
 * A alternativa seria uma lib comunitária, mas (como em T-901 para registrar o intent filter
 * em si) nenhuma está bem mantida para config plugin Expo gerenciado.
 *
 * Portanto: plugin customizado que gera um módulo Kotlin lendo `getIntent()` da MainActivity
 * e expõe um método nativo JS para consultar o payload (URIs de arquivo(s) compartilhado(s)).
 *
 * ## O que este plugin gera em `android/`
 * - Módulo Kotlin `ShareIntentPayloadModule` com método nativo `getShareIntentPayload()`,
 *   que retorna um array de URIs extraído de `EXTRA_STREAM` — como `Uri` único (ACTION_SEND)
 *   ou como `ArrayList<Uri>` sob a mesma chave `EXTRA_STREAM` (ACTION_SEND_MULTIPLE; o Android
 *   SDK não define uma constante `EXTRA_STREAM_URIS` — não existe) — do Intent inicial da
 *   MainActivity, obtida via `reactApplicationContext.currentActivity` (não há propriedade
 *   `currentActivity` direta em `ReactContextBaseJavaModule`).
 * - Três arquivos Kotlin (`ShareIntentPayloadModule`, `ShareIntentPayloadPackage`, etc.),
 *   escritos no mesmo diretório de `MainApplication.kt` (mesmo pacote).
 * - Registro manual de `ShareIntentPayloadPackage` em `MainApplication.kt`.
 *
 * ## Verificação
 * Inspeção do código Kotlin gerado após `npx expo prebuild --platform android`.
 * Validação empírica (compartilhando de outro app) adiada para T-701 (teste de fogo).
 */

const fs = require('fs');
const path = require('path');
const { withMainApplication, withDangerousMod, AndroidConfig } = require('expo/config-plugins');
const { mergeContents } = require('@expo/config-plugins/build/utils/generateCode');

const MODULE_CLASS_NAME = 'ShareIntentPayloadModule';
const PACKAGE_CLASS_NAME = 'ShareIntentPayloadPackage';

/** @param {string} packageName */
function moduleKotlinSource(packageName) {
  return `package ${packageName}

import android.content.Intent
import android.net.Uri
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

/**
 * Módulo nativo que expõe o payload do share intent (URIs de arquivo(s) compartilhado(s))
 * ao lado JavaScript — T-903.
 *
 * Quando o app é invocado via ACTION_SEND ou ACTION_SEND_MULTIPLE, este módulo consulta
 * o Intent inicial da MainActivity e extrai:
 * - ACTION_SEND: single Uri via EXTRA_STREAM
 * - ACTION_SEND_MULTIPLE: ArrayList<Uri> via a mesma chave EXTRA_STREAM
 *
 * O método é chamado uma única vez quando o app inicia (em /app/index.ts ou rota análoga).
 *
 * GERADO por \`plugins/withShareIntentPayload.js\` — NUNCA editar este arquivo diretamente.
 */
class ${MODULE_CLASS_NAME}(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "ShareIntentPayload"

    /**
     * Retorna um array de URIs extraído do Intent compartilhado.
     *
     * Comportamento:
     * - ACTION_SEND: retorna array com 1 URI (EXTRA_STREAM)
     * - ACTION_SEND_MULTIPLE: retorna array com N URIs (EXTRA_STREAM, como ArrayList<Uri>)
     * - Nenhum compartilhamento ativo: retorna []
     * - Erro ao ler Intent: retorna [], não lança exceção (graceful degradation)
     *
     * @param promise — Promise JS a resolver com o array de URIs ou erro
     */
    @ReactMethod
    fun getShareIntentPayload(promise: Promise) {
        try {
            val mainActivity = reactApplicationContext.currentActivity
            if (mainActivity == null) {
                // Activity não disponível — pode acontecer em headless scenarios raros
                promise.resolve(Arguments.createArray())
                return
            }

            val intent = mainActivity.intent
            val uris = mutableListOf<String>()

            when {
                Intent.ACTION_SEND == intent?.action -> {
                    // ACTION_SEND — um único arquivo
                    val uri = intent.getParcelableExtra<Uri>(Intent.EXTRA_STREAM)
                    if (uri != null) {
                        uris.add(uri.toString())
                    }
                }
                Intent.ACTION_SEND_MULTIPLE == intent?.action -> {
                    // ACTION_SEND_MULTIPLE — múltiplos arquivos
                    val uriList = intent.getParcelableArrayListExtra<Uri>(Intent.EXTRA_STREAM)
                    if (uriList != null) {
                        uriList.forEach { uri ->
                            if (uri != null) {
                                uris.add(uri.toString())
                            }
                        }
                    }
                }
                // Sem action de compartilhamento — retorna empty
            }

            // A ponte do React Native não sabe marshalizar um Array<String> Kotlin cru via
            // Promise — precisa de um WritableArray (Arguments.createArray()).
            val result = Arguments.createArray()
            uris.forEach { result.pushString(it) }
            promise.resolve(result)
        } catch (e: Exception) {
            // Graceful degradation: log e retorna empty em vez de falhar
            android.util.Log.e("ShareIntentPayload", "Erro ao ler share intent", e)
            promise.resolve(Arguments.createArray())
        }
    }

    /**
     * Limpa o Intent após o processamento, para evitar reprocessar o compartilhamento
     * se o app for minimizado e trazido para foreground novamente.
     *
     * Chama-se após consumir o payload — zera o action do Intent.
     */
    @ReactMethod
    fun clearShareIntent() {
        try {
            val mainActivity = reactApplicationContext.currentActivity
            if (mainActivity != null) {
                mainActivity.intent?.action = null
            }
        } catch (e: Exception) {
            android.util.Log.w("ShareIntentPayload", "Erro ao limpar share intent", e)
        }
    }
}
`;
}

/** @param {string} packageName */
function packageKotlinSource(packageName) {
  return `package ${packageName}

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager

/**
 * GERADO por \`plugins/withShareIntentPayload.js\` — NUNCA editar diretamente.
 * Registrado manualmente em \`MainApplication.kt\`.
 */
class ${PACKAGE_CLASS_NAME} : ReactPackage {
    override fun createNativeModules(reactContext: ReactApplicationContext): List<NativeModule> =
        listOf(${MODULE_CLASS_NAME}(reactContext))

    override fun createViewManagers(reactContext: ReactApplicationContext): List<ViewManager<*, *>> =
        emptyList()
}
`;
}

/**
 * Registra `ShareIntentPayloadPackage` em `MainApplication.kt`.
 * @type {import('expo/config-plugins').ConfigPlugin}
 */
function withShareIntentPayloadMainApplication(config) {
  return withMainApplication(config, (config) => {
    if (config.modResults.language !== 'kt') {
      throw new Error(
        `withShareIntentPayload: esperava MainApplication.kt (Kotlin), encontrou "${config.modResults.language}". ` +
          'Este plugin só sabe gerar o registro em Kotlin — ver plugins/withShareIntentPayload.js.',
      );
    }

    const merged = mergeContents({
      src: config.modResults.contents,
      newSrc: `          add(${PACKAGE_CLASS_NAME}())`,
      tag: 'transfer-files-share-intent-payload-package',
      anchor: /PackageList\(this\)\.packages\.apply \{/,
      offset: 1,
      comment: '//',
    });
    config.modResults.contents = merged.contents;

    return config;
  });
}

/**
 * Escreve os arquivos Kotlin no mesmo diretório de `MainApplication.kt`.
 * @type {import('expo/config-plugins').ConfigPlugin}
 */
function withShareIntentPayloadNativeFiles(config) {
  return withDangerousMod(config, [
    'android',
    async (config) => {
      const mainApplication = await AndroidConfig.Paths.getMainApplicationAsync(
        config.modRequest.projectRoot,
      );
      const packageName = AndroidConfig.Package.getPackage(config);
      if (!packageName) {
        throw new Error('withShareIntentPayload: config.android.package não definido em app.json');
      }

      const javaDir = path.dirname(mainApplication.path);

      fs.writeFileSync(
        path.join(javaDir, `${MODULE_CLASS_NAME}.kt`),
        moduleKotlinSource(packageName),
      );
      fs.writeFileSync(
        path.join(javaDir, `${PACKAGE_CLASS_NAME}.kt`),
        packageKotlinSource(packageName),
      );

      return config;
    },
  ]);
}

/**
 * Plugin completo: arquivos Kotlin + registro em MainApplication.
 * @type {import('expo/config-plugins').ConfigPlugin}
 */
function withShareIntentPayload(config) {
  config = withShareIntentPayloadNativeFiles(config);
  config = withShareIntentPayloadMainApplication(config);
  return config;
}

module.exports = withShareIntentPayload;
