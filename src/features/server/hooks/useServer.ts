import { useCallback } from 'react';
import { useServerStore } from '../store/serverStore';
import { createServerService } from '../services/serverServiceFactory';
import { ServerServiceError } from '../services/serverService';
import type { NetworkMode, ServerErrorCode, ServerError as ServerErrorType } from '../types';
import type { HttpModule } from '../services/httpModule';

/**
 * Mapeia erros técnicos (ServerServiceError, Error genérico) para ServerError tipado com mensagem traduzida.
 */
function mapErrorToServerError(error: unknown): ServerErrorType {
  if (error instanceof ServerServiceError) {
    return {
      code: error.code,
      message: getErrorMessage(error.code),
    };
  }

  if (error instanceof Error) {
    return {
      code: 'UNKNOWN',
      message: 'Erro desconhecido ao gerenciar servidor',
    };
  }

  return {
    code: 'UNKNOWN',
    message: 'Erro desconhecido ao gerenciar servidor',
  };
}

/**
 * Mensagens traduzidas por ErrorCode.
 * (Futuro: extrair para arquivo de i18n)
 */
function getErrorMessage(code: ServerErrorCode): string {
  const messages: Record<ServerErrorCode, string> = {
    NO_NETWORK: 'Nenhuma rede disponível. Conecte-se a uma rede Wi-Fi.',
    PORT_UNAVAILABLE: 'A porta padrão está indisponível. Tente outra conexão ou reinicie o app.',
    PERMISSION_DENIED: 'Permissão negada. Verifique as configurações de rede do dispositivo.',
    UNKNOWN: 'Erro desconhecido ao gerenciar servidor.',
  };

  return messages[code];
}

/**
 * Hook que fornece interface para gerenciar o servidor HTTP.
 *
 * Responsabilidades:
 * - Orquestrar chamadas ao `ServerService`
 * - Atualizar o `serverStore` conforme o servidor muda de estado
 * - Mapear erros técnicos para `ServerErrorType` com mensagens traduzidas
 *
 * Uso em componente:
 * ```tsx
 * const { start, stop } = useServer();
 * const serverInfo = useServerStore(state => state.serverInfo);
 *
 * return (
 *   <Button
 *     disabled={serverInfo.status === 'starting'}
 *     onPress={() => start('wifi')}
 *   >
 *     {serverInfo.status === 'running' ? 'Parar' : 'Iniciar'}
 *   </Button>
 * );
 * ```
 *
 * Testes:
 * ```ts
 * const { start, stop } = renderHook(() => useServer(mockHttpModule));
 * await act(() => start('wifi'));
 * ```
 */
export function useServer(httpModule?: HttpModule) {
  const store = useServerStore();

  const start = useCallback(
    async (networkMode: NetworkMode): Promise<void> => {
      // Transição: idle → starting
      store.startRequested();

      try {
        // Criar serviço (com injeção opcional para testes)
        const serverService = createServerService(httpModule);

        // Iniciar servidor
        const result = await serverService.start(networkMode);

        // Transição: starting → running
        store.started({
          networkMode: result.networkMode,
          ip: result.ip,
          port: result.port,
          url: result.url,
          sessionId: result.sessionId,
          startedAt: Date.now(),
        });
      } catch (error) {
        // Mapear erro para ServerError
        const serverError = mapErrorToServerError(error);

        // Transição: starting → error
        store.failed(serverError);

        throw error;
      }
    },
    [store, httpModule],
  );

  const stop = useCallback(async (): Promise<void> => {
    // Transição: running → stopping
    store.stopRequested();

    try {
      // Criar serviço
      const serverService = createServerService(httpModule);

      // Parar servidor
      await serverService.stop();

      // Transição: stopping → idle
      store.stopped();
    } catch (error) {
      // Mapear erro
      const serverError = mapErrorToServerError(error);

      // Transição: stopping → error
      store.failed(serverError);

      throw error;
    }
  }, [store, httpModule]);

  const reset = useCallback(() => {
    store.reset();
  }, [store]);

  return {
    start,
    stop,
    reset,
  };
}
