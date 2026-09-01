// @ts-check
/**
 * Expo config plugin — Foreground Service Android real para o servidor HTTP (T-807).
 *
 * ## Por que um plugin customizado em vez de uma lib pronta
 * `android/` deste repo é gerado via `expo prebuild` e não é versionado (`.gitignore`) —
 * qualquer permissão/`<service>`/código nativo precisa vir de um Expo config plugin, nunca de
 * edição direta em `android/`. `expo-notifications` (já usado pelo app) NÃO oferece foreground
 * service no Android — só notificações "normais" (confirmado na doc oficial do SDK 57,
 * https://docs.expo.dev/versions/v57.0.0/sdk/notifications/, sem qualquer menção a
 * `startForeground`/tipo de foreground service). A alternativa mais conhecida para isso via
 * config plugin, Notifee, foi **arquivada** (abril/2026) e seu substituto mantido pela
 * comunidade (`react-native-notify-kit`) é um fork jovem, não-oficial, que duplicaria a
 * responsabilidade de notificação já coberta por `expo-notifications` — dependência nova de
 * proveniência incerta para resolver algo que também dá para implementar com ~150 linhas de
 * Kotlin bem entendidas e sob controle total do time. Por isso: plugin customizado.
 *
 * ## O que este plugin gera em `android/`
 * - Permissões `FOREGROUND_SERVICE`, `FOREGROUND_SERVICE_DATA_SYNC` (obrigatória a partir do
 *   Android 14/API 34 — `minSdkVersion` deste projeto — para declarar o tipo do foreground
 *   service) e `POST_NOTIFICATIONS` (obrigatória desde Android 13 para qualquer notificação,
 *   incluindo a do foreground service, ser exibida ao usuário).
 * - `<service android:name=".TransferForegroundService" android:foregroundServiceType="dataSync">`
 *   — tipo `dataSync` porque o servidor transfere arquivos para outros dispositivos na rede
 *   local (categoria mais próxima entre as oficiais; não há uma categoria "servidor de rede
 *   local" dedicada).
 * - Três arquivos Kotlin (`TransferForegroundService`, `TransferForegroundServiceModule`,
 *   `TransferForegroundServicePackage`) escritos diretamente no diretório onde o `prebuild`
 *   coloca `MainApplication.kt` (mesmo pacote — resolvido dinamicamente via
 *   `AndroidConfig.Package.getPackage()`, nunca hardcoded).
 * - Registro manual de `TransferForegroundServicePackage` em `MainApplication.kt`, no mesmo
 *   ponto de extensão que o próprio template do Expo comenta para esse fim
 *   ("Packages that cannot be autolinked yet can be added manually here").
 *
 * ## Verificação
 * `npx expo prebuild --platform android` (rodado neste PR) e inspeção do
 * `android/app/src/main/AndroidManifest.xml` e `MainApplication.kt` gerados — ver relatório da
 * tarefa T-807 para o diff exato observado.
 */

const fs = require('fs');
const path = require('path');
const {
  withAndroidManifest,
  withMainApplication,
  withDangerousMod,
  AndroidConfig,
} = require('expo/config-plugins');
const { mergeContents } = require('@expo/config-plugins/build/utils/generateCode');

const SERVICE_CLASS_NAME = 'TransferForegroundService';
const MODULE_CLASS_NAME = 'TransferForegroundServiceModule';
const PACKAGE_CLASS_NAME = 'TransferForegroundServicePackage';

const FOREGROUND_SERVICE_PERMISSIONS = [
  'android.permission.FOREGROUND_SERVICE',
  'android.permission.FOREGROUND_SERVICE_DATA_SYNC',
  'android.permission.POST_NOTIFICATIONS',
];

/** @param {string} packageName */
function serviceKotlinSource(packageName) {
  return `package ${packageName}

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.IBinder
import androidx.core.app.NotificationCompat

/**
 * Foreground service Android real que protege o processo do app enquanto o servidor HTTP
 * (\`react-native-tcp-socket\`, gerenciado por \`ServerService\` no lado JS) está rodando — sem
 * \`startForeground()\`, o Android pode matar o processo (e o servidor junto) a qualquer momento
 * em segundo plano (achado real de uso, T-807).
 *
 * GERADO por \`plugins/withForegroundService.js\` a cada \`expo prebuild\` — NUNCA editar este
 * arquivo diretamente em \`android/\`, a mudança é perdida no próximo prebuild.
 */
class ${SERVICE_CLASS_NAME} : Service() {

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val title = intent?.getStringExtra(EXTRA_TITLE) ?: DEFAULT_TITLE
        val body = intent?.getStringExtra(EXTRA_BODY) ?: DEFAULT_BODY
        startForeground(NOTIFICATION_ID, buildNotification(title, body), ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC)
        // START_NOT_STICKY de propósito: quem decide se este serviço deve existir é o lado JS
        // (ServerService, amarrado ao ciclo de vida real do servidor TCP) — o Android nunca deve
        // recriar este serviço sozinho depois de morto, isso mostraria uma notificação de
        // "servidor ativo" enganosa sem o servidor TCP de fato rodando junto.
        return START_NOT_STICKY
    }

    override fun onDestroy() {
        stopForeground(STOP_FOREGROUND_REMOVE)
        super.onDestroy()
    }

    private fun buildNotification(title: String, body: String): Notification {
        ensureChannel()
        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle(title)
            .setContentText(body)
            .setSmallIcon(applicationInfo.icon)
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setCategory(NotificationCompat.CATEGORY_SERVICE)
            .build()
    }

    private fun ensureChannel() {
        val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        if (manager.getNotificationChannel(CHANNEL_ID) == null) {
            manager.createNotificationChannel(
                NotificationChannel(CHANNEL_ID, CHANNEL_NAME, NotificationManager.IMPORTANCE_LOW),
            )
        }
    }

    companion object {
        const val EXTRA_TITLE = "title"
        const val EXTRA_BODY = "body"
        private const val DEFAULT_TITLE = "Servidor ativo"
        private const val DEFAULT_BODY = "Compartilhando arquivos na rede local"
        private const val CHANNEL_ID = "transfer_files_server_channel"
        private const val CHANNEL_NAME = "Servidor de transferência"
        private const val NOTIFICATION_ID = 4821
    }
}
`;
}

/** @param {string} packageName */
function moduleKotlinSource(packageName) {
  return `package ${packageName}

import android.content.Intent
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

/**
 * Ponte JS → \`${SERVICE_CLASS_NAME}\`. Exposta ao lado JS como o módulo nativo
 * "TransferForegroundService" (ver \`src/features/server/services/foregroundServiceModule.ts\`).
 *
 * GERADO por \`plugins/withForegroundService.js\` — NUNCA editar diretamente em \`android/\`.
 */
class ${MODULE_CLASS_NAME}(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "TransferForegroundService"

    @ReactMethod
    fun start(title: String, body: String) {
        val context = reactApplicationContext
        val intent = Intent(context, ${SERVICE_CLASS_NAME}::class.java).apply {
            putExtra(${SERVICE_CLASS_NAME}.EXTRA_TITLE, title)
            putExtra(${SERVICE_CLASS_NAME}.EXTRA_BODY, body)
        }
        context.startForegroundService(intent)
    }

    @ReactMethod
    fun stop() {
        val context = reactApplicationContext
        context.stopService(Intent(context, ${SERVICE_CLASS_NAME}::class.java))
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
 * GERADO por \`plugins/withForegroundService.js\` — NUNCA editar diretamente em \`android/\`.
 * Registrado manualmente em \`MainApplication.kt\` (autolinking não se aplica: este módulo não
 * é um pacote npm próprio, é gerado dentro do próprio projeto Android pelo plugin).
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
 * Adiciona as permissões de foreground service ao AndroidManifest.xml.
 * @type {import('expo/config-plugins').ConfigPlugin}
 */
function withForegroundServicePermissions(config) {
  return AndroidConfig.Permissions.withPermissions(config, FOREGROUND_SERVICE_PERMISSIONS);
}

/**
 * Declara o `<service>` do foreground service dentro de `<application>`.
 * @type {import('expo/config-plugins').ConfigPlugin}
 */
function withForegroundServiceManifestEntry(config) {
  return withAndroidManifest(config, (config) => {
    const mainApplication = AndroidConfig.Manifest.getMainApplicationOrThrow(config.modResults);
    mainApplication.service = mainApplication.service ?? [];

    const qualifiedName = `.${SERVICE_CLASS_NAME}`;
    const alreadyDeclared = mainApplication.service.some(
      (service) => service.$['android:name'] === qualifiedName,
    );
    if (!alreadyDeclared) {
      mainApplication.service.push({
        $: {
          'android:name': qualifiedName,
          'android:exported': 'false',
          // Android 14+ exige declarar o tipo junto da permissão FOREGROUND_SERVICE_DATA_SYNC.
          'android:foregroundServiceType': 'dataSync',
        },
      });
    }

    return config;
  });
}

/**
 * Registra `TransferForegroundServicePackage` em `MainApplication.kt`, no mesmo ponto de
 * extensão que o próprio template do Expo comenta para pacotes não autolinkáveis.
 * @type {import('expo/config-plugins').ConfigPlugin}
 */
function withForegroundServiceMainApplication(config) {
  return withMainApplication(config, (config) => {
    if (config.modResults.language !== 'kt') {
      throw new Error(
        `withForegroundService: esperava MainApplication.kt (Kotlin), encontrou "${config.modResults.language}". ` +
          'Este plugin só sabe gerar o registro em Kotlin — ver plugins/withForegroundService.js.',
      );
    }

    const merged = mergeContents({
      src: config.modResults.contents,
      newSrc: `          add(${PACKAGE_CLASS_NAME}())`,
      tag: 'transfer-files-foreground-service-package',
      anchor: /PackageList\(this\)\.packages\.apply \{/,
      offset: 1,
      comment: '//',
    });
    config.modResults.contents = merged.contents;

    return config;
  });
}

/**
 * Escreve os três arquivos Kotlin no mesmo diretório de `MainApplication.kt` (mesmo pacote,
 * resolvido dinamicamente — nunca hardcoded, para não quebrar se `android.package` mudar).
 * @type {import('expo/config-plugins').ConfigPlugin}
 */
function withForegroundServiceNativeFiles(config) {
  return withDangerousMod(config, [
    'android',
    async (config) => {
      const mainApplication = await AndroidConfig.Paths.getMainApplicationAsync(
        config.modRequest.projectRoot,
      );
      const packageName = AndroidConfig.Package.getPackage(config);
      if (!packageName) {
        throw new Error(
          'withForegroundService: config.android.package não definido em app.json — necessário ' +
            'para gerar o pacote Kotlin correto dos arquivos do foreground service.',
        );
      }

      const javaDir = path.dirname(mainApplication.path);

      fs.writeFileSync(
        path.join(javaDir, `${SERVICE_CLASS_NAME}.kt`),
        serviceKotlinSource(packageName),
      );
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
 * Plugin completo: permissões + `<service>` + arquivos Kotlin + registro em MainApplication.
 * @type {import('expo/config-plugins').ConfigPlugin}
 */
function withForegroundService(config) {
  config = withForegroundServicePermissions(config);
  config = withForegroundServiceManifestEntry(config);
  config = withForegroundServiceNativeFiles(config);
  config = withForegroundServiceMainApplication(config);
  return config;
}

module.exports = withForegroundService;
