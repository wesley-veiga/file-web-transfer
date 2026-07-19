/** Estado do servidor embarcado. Máquina de estados:
 *  idle → starting → running → stopping → idle  (error a partir de qualquer estado) */
export type ServerStatus = 'idle' | 'starting' | 'running' | 'stopping' | 'error';

/** Como o host está conectado à rede que serve os convidados */
export type NetworkMode = 'wifi' | 'hotspot';

/** Dados da rede própria criada pelo app (Android, Local Only Hotspot) */
export interface HotspotInfo {
  ssid: string;
  password: string;
  /** Conteúdo do QR Code Wi-Fi: "WIFI:S:<ssid>;T:WPA;P:<senha>;;" */
  wifiQrPayload: string;
}

export interface ServerInfo {
  status: ServerStatus;
  /** null enquanto idle/error */
  networkMode: NetworkMode | null;
  /** Preenchido apenas quando networkMode === 'hotspot' no Android */
  hotspot: HotspotInfo | null;
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
  | 'NO_NETWORK' // sem rede e sem conseguir criar uma
  | 'PORT_UNAVAILABLE' // nenhuma porta livre no range
  | 'PERMISSION_DENIED' // permissão de rede/armazenamento/NEARBY_WIFI_DEVICES negada
  | 'HOTSPOT_UNSUPPORTED' // dispositivo/SO não permite criar rede própria
  | 'HOTSPOT_FAILED' // falha ao iniciar o Local Only Hotspot
  | 'UNKNOWN';

export interface ServerError {
  code: ServerErrorCode;
  message: string; // mensagem já traduzida para exibição
}
