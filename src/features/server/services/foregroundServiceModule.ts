import { NativeModules, Platform } from 'react-native';

/**
 * Ponte para o foreground service Android nativo (`TransferForegroundService`,
 * gerado por `plugins/withForegroundService.js` — ver T-807 em `tarefas.md`).
 *
 * Sem isso, o Android pode matar o processo do app (e o servidor HTTP junto) a
 * qualquer momento em segundo plano, mesmo com uma notificação "comum" visível
 * (uma notificação normal, via `expo-notifications`, NÃO protege o processo —
 * só `startForeground()` faz isso).
 *
 * Conceito exclusivamente Android: iOS não tem foreground service (usa outros
 * mecanismos de execução em segundo plano, fora do escopo desta tarefa) — por
 * isso a implementação padrão é no-op em qualquer plataforma que não Android.
 */
export interface ForegroundServiceModule {
  /** Inicia o foreground service, exibindo `title`/`body` na notificação ongoing. */
  start: (title: string, body: string) => void;
  /** Para o foreground service e remove a notificação. */
  stop: () => void;
  /**
   * Indica se esta instância oferece proteção real de processo em segundo plano
   * (Android com `startForeground()` nativo disponível) — `true` só quando o
   * módulo nativo `TransferForegroundService` existe. O fallback no-op (iOS/web,
   * ou Android sem o módulo nativo — Expo Go, build sem `expo prebuild`
   * atualizado) sempre retorna `false`.
   *
   * T-808: `useAppLifecycle` usa isto para decidir se pode manter o servidor
   * rodando quando o app sai de foreground — só é seguro fazer isso quando há
   * proteção de processo de verdade, não apenas uma notificação cosmética.
   */
  isAvailable: () => boolean;
}

/** Formato do módulo nativo exposto pelo `TransferForegroundServiceModule.kt` gerado. */
interface NativeForegroundServiceModule {
  start(title: string, body: string): void;
  stop(): void;
}

/** Implementação no-op — usada em iOS/web e como fallback seguro se o módulo nativo não existir. */
function createNoopForegroundServiceModule(): ForegroundServiceModule {
  return {
    start: () => undefined,
    stop: () => undefined,
    isAvailable: () => false,
  };
}

/**
 * Módulo padrão de produção.
 *
 * Cai silenciosamente para o no-op (em vez de lançar) se o módulo nativo não estiver
 * presente — ex.: Expo Go (que não roda o config plugin) ou algum build Android
 * gerado sem `expo prebuild` atualizado. Nunca deve impedir o servidor de iniciar
 * só porque a proteção extra de foreground service não está disponível.
 */
export function createDefaultForegroundServiceModule(): ForegroundServiceModule {
  if (Platform.OS !== 'android') {
    return createNoopForegroundServiceModule();
  }

  const native = NativeModules.TransferForegroundService as
    NativeForegroundServiceModule | undefined;
  if (!native) {
    return createNoopForegroundServiceModule();
  }

  return {
    start: (title: string, body: string) => native.start(title, body),
    stop: () => native.stop(),
    isAvailable: () => true,
  };
}
