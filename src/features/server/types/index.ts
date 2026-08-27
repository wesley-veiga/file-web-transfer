/** Estado do servidor embarcado. Máquina de estados:
 *  idle → starting → running → stopping → idle  (error a partir de qualquer estado) */
export type ServerStatus = 'idle' | 'starting' | 'running' | 'stopping' | 'error';

/** Como o host está conectado à rede que serve os convidados. Único modo suportado: Wi-Fi existente (rede própria removida, ver ADR-002). */
export type NetworkMode = 'wifi';

export interface ServerInfo {
  status: ServerStatus;
  /** null enquanto idle/error */
  networkMode: NetworkMode | null;
  /** IP na rede local, ex.: "192.168.0.12". null enquanto idle/error */
  ip: string | null;
  port: number | null;
  /** URL completa exibida ao usuário e codificada no QR Code */
  url: string | null;
  /** Identificador humano da sessão, ex.: "maçã-42" */
  sessionId: string | null;
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
