/** Estado do servidor embarcado. Máquina de estados:
 *  idle → starting → running → stopping → idle  (error a partir de qualquer estado) */
export type ServerStatus = 'idle' | 'starting' | 'running' | 'stopping' | 'error';

/** Como o host está conectado à rede que serve os convidados. Único modo suportado: Wi-Fi existente (rede própria removida, ver ADR-002). */
export type NetworkMode = 'wifi';

/** Modo da sessão ativa (rev. 2.0) — define se a tela do host e a API expõem download ou upload. */
export type SessionMode = 'send' | 'receive';

export interface ServerInfo {
  status: ServerStatus;
  /** null enquanto idle/error */
  networkMode: NetworkMode | null;
  /** IP na rede local, ex.: "192.168.0.12". null enquanto idle/error */
  ip: string | null;
  port: number | null;
  /** URL completa exibida ao usuário e codificada no QR Code — já inclui `?token=<token>` (rev. 2.0) */
  url: string | null;
  /**
   * Token da sessão, ex.: "maçã-42" (rev. 2.0: renomeia o antigo `sessionId`).
   * Deixou de ser cosmético — é a credencial de acesso validada pela API (Seção 4).
   * Gerado pela mesma função (`generateSessionId`, T-104); o campo mudou de nome para refletir a nova semântica de segurança.
   */
  token: string | null;
  /** Modo da sessão ativa — 'send' ao entrar via compartilhamento do SO, 'receive' ao tocar em "Receber arquivo". null enquanto idle/error (rev. 2.0) */
  mode: SessionMode | null;
  startedAt: number | null; // epoch ms
  error: ServerError | null;
}

export type ServerErrorCode =
  | 'NO_NETWORK' // sem rede Wi-Fi disponível
  | 'PORT_UNAVAILABLE' // nenhuma porta livre no range
  | 'PERMISSION_DENIED' // permissão de rede/armazenamento negada
  | 'UNKNOWN';

export interface ServerError {
  code: ServerErrorCode;
  message: string; // mensagem já traduzida para exibição
}
