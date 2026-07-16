# Spec — Transferir Arquivos

**Feature:** Servidor de arquivos local + transferência via interface web
**Documento pai:** [constitution.md](constitution.md)
**Versão:** 1.1.0 · **Data:** 2026-07-16 · *(rev. 1.1: Android 14+, modo rede própria HU-08)*
**Features envolvidas:** `features/server`, `features/transfer`, `features/files`, `web-ui/`

---

## 1. Visão Geral

O recurso transforma o celular (host) em um servidor HTTP na rede local. Com um toque, o usuário inicia o servidor; o app exibe o endereço de acesso (`http://<ip-local>:<porta>`) como texto e QR Code. Qualquer dispositivo na mesma rede (convidado) abre esse link no navegador e acessa uma interface web onde pode:

1. **Enviar arquivos** para o celular host (upload, múltiplos arquivos, com barra de progresso);
2. **Baixar arquivos** que o host disponibilizou (download);
3. **Ver a lista** de arquivos disponíveis e recebidos na sessão.

No app, o host acompanha em tempo real as transferências em andamento, o histórico da sessão e pode selecionar quais arquivos do dispositivo ficam disponíveis para download. Nenhum dado sai da rede local (Princípio VI).

**Conectividade — dois modos, nenhum depende de internet:**

| Modo | Quando | Como |
|---|---|---|
| **Wi-Fi** | Host já conectado a uma rede | Servidor sobe no IP da rede atual |
| **Rede própria** | Host sem nenhuma rede | O app **cria a rede**: no Android 14+ inicia um Local Only Hotspot e exibe SSID/senha como QR Code Wi-Fi para o convidado entrar; no iOS orienta a ativação manual do Hotspot Pessoal e detecta a interface ativa (HU-08) |

### Fora de escopo (v1)

- Android 13 ou inferior (mínimo suportado: **Android 14 / API 34**);
- Transferência via internet ou entre redes diferentes;
- Criptografia TLS/HTTPS (rede local; identificador de sessão mitiga conexão ao host errado);
- Pareamento com senha (candidato a v1.1);
- Retomada de transferência interrompida (candidato a v1.1).

---

## 2. Histórias de Usuário

### HU-01 — Iniciar servidor

> **Como** usuário host, **quero** tocar em um botão para iniciar o servidor, **para** disponibilizar meu celular para transferências na rede local.

**Comportamento esperado:**
- Ao tocar em "Iniciar servidor", o app obtém o IP local, sobe o servidor HTTP em porta livre (padrão `8080`, fallback incremental) e muda o estado para `running` em menos de 2 s.
- A tela passa a exibir: endereço completo, QR Code do link e identificador da sessão (ex.: `maçã-42`, legível por humanos).
- Sem nenhuma rede disponível, o fluxo não termina em beco sem saída: a ação principal vira **"Criar rede"** (HU-08); assim que a rede própria estiver ativa, o servidor sobe normalmente na interface dela.

### HU-02 — Parar servidor

> **Como** usuário host, **quero** parar o servidor a qualquer momento, **para** encerrar o acesso ao meu dispositivo.

**Comportamento esperado:**
- Botão "Parar" visível sempre que o servidor estiver `running`.
- Se houver transferência em andamento, o app pede confirmação ("Há 2 transferências em andamento. Parar mesmo assim?").
- Ao parar: porta liberada imediatamente, conexões encerradas, estado volta para `idle`; transferências interrompidas ficam no histórico como `cancelled`.

### HU-03 — Acessar a interface web (convidado)

> **Como** usuário convidado, **quero** abrir o link (ou escanear o QR Code) no navegador do meu dispositivo, **para** transferir arquivos sem instalar nada.

**Comportamento esperado:**
- A página carrega em qualquer navegador moderno, sem recursos externos (sem CDN).
- Exibe o identificador da sessão em destaque, para o convidado confirmar com o host que está no dispositivo certo.
- Layout responsivo (celular e desktop), com tema claro/escuro conforme preferência do sistema.

### HU-04 — Enviar arquivos para o host (upload via web)

> **Como** usuário convidado, **quero** selecionar um ou mais arquivos (ou arrastá-los) na página web e enviá-los, **para** que fiquem salvos no celular host.

**Comportamento esperado:**
- Seleção múltipla via input de arquivo e drag-and-drop (desktop).
- Cada arquivo mostra: nome, tamanho, barra de progresso individual e status (`na fila`, `enviando`, `concluído`, `erro`).
- Uploads processados com streaming — arquivos de qualquer tamanho, sem travar o app host.
- Em caso de erro (queda de conexão, servidor parado), o item exibe estado de erro com botão "Tentar novamente".
- Nome de arquivo duplicado no destino recebe sufixo automático (`foto.jpg` → `foto (1).jpg`); nunca sobrescreve.

### HU-05 — Baixar arquivos do host (download via web)

> **Como** usuário convidado, **quero** ver a lista de arquivos que o host disponibilizou e baixá-los, **para** receber arquivos do celular host.

**Comportamento esperado:**
- A página lista os arquivos compartilhados: nome, tamanho, tipo (ícone) e data.
- Clicar em um arquivo inicia o download nativo do navegador (streaming, com `Content-Length` para o navegador exibir progresso).
- Lista atualizada automaticamente (polling) quando o host adiciona/remove arquivos.

### HU-06 — Disponibilizar arquivos para download (host)

> **Como** usuário host, **quero** escolher arquivos do meu celular para compartilhar, **para** que os convidados possam baixá-los.

**Comportamento esperado:**
- Botão "Compartilhar arquivos" abre o seletor de documentos/galeria do sistema.
- Arquivos selecionados aparecem na lista "Compartilhados" do app e imediatamente na interface web dos convidados.
- O host pode remover um arquivo da lista a qualquer momento; downloads já em andamento desse arquivo são concluídos, novos são bloqueados (`404`).

### HU-07 — Acompanhar transferências (host)

> **Como** usuário host, **quero** ver as transferências em andamento e o histórico da sessão, **para** saber o que entrou e saiu do meu dispositivo.

**Comportamento esperado:**
- Lista em tempo real: direção (recebendo/enviando), nome, tamanho, progresso (%), velocidade e dispositivo de origem (IP).
- Ao concluir um recebimento, o arquivo aparece na aba "Recebidos" com ação "Abrir" / "Compartilhar" (share sheet do SO).
- Histórico persiste apenas durante a sessão do servidor (zerado ao iniciar novo servidor).

### HU-08 — Abrir rede própria quando não há rede (host)

> **Como** usuário host sem acesso a nenhuma rede Wi-Fi, **quero** que o app crie uma rede local a partir do meu celular, **para** que o convidado se conecte a ela e a transferência aconteça mesmo sem internet.

**Comportamento esperado:**
- Ao detectar ausência de rede (`expo-network`), a tela Home exibe **"Criar rede"** como ação principal (no lugar de um botão desabilitado).
- **Android 14+:** o app inicia um **Local Only Hotspot** (permissão `NEARBY_WIFI_DEVICES`; pedida com explicação prévia do motivo). Ao ativar, exibe o SSID e a senha gerados pelo sistema **e** um **QR Code Wi-Fi** (formato `WIFI:S:<ssid>;T:WPA;P:<senha>;;`) que o convidado escaneia com a câmera para entrar na rede. A jornada tem duas etapas visualmente claras: **1) Conectar à rede** (QR Wi-Fi) → **2) Acessar o link** (QR HTTP), com indicador de qual etapa o convidado está.
- **iOS:** criação programática não é permitida pelo sistema; o app exibe passo a passo para ativar o **Hotspot Pessoal** nas Configurações e detecta automaticamente quando a interface do hotspot fica ativa (gateway `172.20.10.1`), iniciando o servidor nela sem toque adicional.
- **Erros:** `HOTSPOT_UNSUPPORTED` (hardware/SO não permite) e `HOTSPOT_FAILED` (falha ao iniciar) exibem mensagens específicas + fallback sugerido ("conecte os dois dispositivos à mesma rede Wi-Fi"). Permissão negada → `PERMISSION_DENIED` com atalho para as configurações do app.
- Parar o servidor DEVE desligar junto o hotspot criado pelo app (Android); nunca deixar a rede aberta órfã.

---

## 3. Modelos de Dados

Tipos de domínio em `src/features/*/types/` — fonte única de verdade entre app e web-ui (Princípio II). Todos os payloads da API têm schema Zod correspondente em `shared/types/api.ts`.

```typescript
// ─── features/server/types ───────────────────────────────────────────

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
  startedAt: number | null;          // epoch ms
  error: ServerError | null;
}

export type ServerErrorCode =
  | 'NO_NETWORK'           // sem rede e sem conseguir criar uma
  | 'PORT_UNAVAILABLE'     // nenhuma porta livre no range
  | 'PERMISSION_DENIED'    // permissão de rede/armazenamento/NEARBY_WIFI_DEVICES negada
  | 'HOTSPOT_UNSUPPORTED'  // dispositivo/SO não permite criar rede própria
  | 'HOTSPOT_FAILED'       // falha ao iniciar o Local Only Hotspot
  | 'UNKNOWN';

export interface ServerError {
  code: ServerErrorCode;
  message: string; // mensagem já traduzida para exibição
}

// ─── features/transfer/types ─────────────────────────────────────────

export type TransferDirection = 'upload' | 'download'; // do ponto de vista do host: upload = recebendo
export type TransferStatus = 'queued' | 'active' | 'completed' | 'failed' | 'cancelled';

export interface Transfer {
  id: string;                 // uuid
  direction: TransferDirection;
  fileName: string;
  /** Tamanho total em bytes; null se o cliente não informou Content-Length */
  sizeBytes: number | null;
  transferredBytes: number;
  status: TransferStatus;
  /** IP do dispositivo convidado */
  peerIp: string;
  startedAt: number;
  finishedAt: number | null;
  /** Bytes/s, média móvel; null enquanto queued */
  speedBps: number | null;
  errorMessage: string | null;
}

// ─── features/files/types ────────────────────────────────────────────

export type FileOrigin = 'received' | 'shared'; // recebido de convidado | compartilhado pelo host

export interface FileEntry {
  id: string;                 // uuid estável durante a sessão
  name: string;               // nome sanitizado (sem path, sem caracteres de controle)
  sizeBytes: number;
  mimeType: string;           // "application/octet-stream" quando desconhecido
  /** URI local no sandbox do app (nunca exposto na API) */
  localUri: string;
  origin: FileOrigin;
  createdAt: number;
}

/** Projeção pública de FileEntry — único formato que sai pela API */
export interface FileEntryDto {
  id: string;
  name: string;
  sizeBytes: number;
  mimeType: string;
  createdAt: number;
}
```

```typescript
// ─── shared/types/api.ts — schemas Zod (validação runtime, Princípio II) ──
import { z } from 'zod';

export const fileEntryDtoSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(255),
  sizeBytes: z.number().int().nonnegative(),
  mimeType: z.string(),
  createdAt: z.number().int().positive(),
});

export const sessionInfoSchema = z.object({
  sessionId: z.string(),
  appVersion: z.string(),
  maxUploadBytes: z.number().int().positive(),
});

export const apiErrorSchema = z.object({
  error: z.object({
    code: z.string(),      // ex.: "FILE_TOO_LARGE"
    message: z.string(),
  }),
});

export type FileEntryDto = z.infer<typeof fileEntryDtoSchema>;
export type SessionInfo = z.infer<typeof sessionInfoSchema>;
export type ApiError = z.infer<typeof apiErrorSchema>;
```

---

## 4. Contratos de API

API HTTP servida pelo servidor embarcado, consumida pela `web-ui`. Todas as respostas JSON usam `Content-Type: application/json; charset=utf-8`. Erros seguem sempre o envelope `apiErrorSchema`.

### `GET /` — Interface web

| | |
|---|---|
| Resposta | `200` — HTML autocontido da interface web (assets inline, sem CDN) |

### `GET /api/session` — Informações da sessão

Usado pela web-ui ao carregar, para exibir o identificador da sessão e limites.

| | |
|---|---|
| Resposta `200` | `SessionInfo` — `{ "sessionId": "maçã-42", "appVersion": "1.0.0", "maxUploadBytes": 4294967296 }` |

### `GET /api/files` — Listar arquivos disponíveis para download

| | |
|---|---|
| Query | `origin?: "shared" \| "received"` (padrão: `shared`) |
| Resposta `200` | `{ "files": FileEntryDto[] }` ordenado por `createdAt` desc |

### `GET /api/files/:id/download` — Baixar arquivo

| | |
|---|---|
| Resposta `200` | Stream binário. Headers: `Content-Length`, `Content-Type` (mime real), `Content-Disposition: attachment; filename*=UTF-8''<nome-encodado>` |
| Erro `404` | `{ "error": { "code": "FILE_NOT_FOUND", ... } }` — id inexistente ou removido do compartilhamento |

### `POST /api/upload` — Enviar arquivo para o host

| | |
|---|---|
| Request | `multipart/form-data`, campo `file` (um arquivo por request; a web-ui enfileira múltiplos uploads sequencialmente). Processado com **streaming** — o corpo nunca é bufferizado inteiro em memória |
| Resposta `201` | `{ "file": FileEntryDto }` — arquivo salvo (nome final pode ter sufixo anti-duplicata) |
| Erro `400` | `INVALID_MULTIPART` — corpo malformado ou campo `file` ausente |
| Erro `413` | `FILE_TOO_LARGE` — excede `maxUploadBytes` |
| Erro `422` | `INVALID_FILENAME` — nome vazio ou inválido após sanitização (path traversal → rejeitado, Princípio VI) |
| Erro `507` | `INSUFFICIENT_STORAGE` — sem espaço no dispositivo host |

### `GET /api/events` — Atualizações da sessão (polling)

A web-ui consulta a cada 3 s para atualizar a lista de arquivos.

| | |
|---|---|
| Query | `since: number` (epoch ms da última consulta) |
| Resposta `200` | `{ "filesChangedAt": number }` — se maior que `since`, a web-ui refaz `GET /api/files` |

### Regras transversais

- **Sanitização de upload:** nome normalizado (`basename` apenas, sem `..`, sem caracteres de controle, máx. 255 chars); escrita restrita ao diretório sandbox `received/` do app.
- **Servidor parado:** qualquer request após `stopping` recebe connection refused (porta fechada) — a web-ui trata como estado "Servidor desconectado".
- **Sem autenticação (v1):** superfície limitada à rede local; nenhum endpoint expõe `localUri` ou paths do sistema de arquivos.

---

## 5. Critérios de Aceite

### Tela Home / Servidor (app host)

- [ ] **Estado `idle` com rede:** botão "Iniciar servidor" habilitado, exibindo o nome da rede atual (SSID).
- [ ] **Estado `idle` sem rede:** ação principal vira "Criar rede" (HU-08) — nunca existe estado sem caminho para avançar.
- [ ] **Estado `starting` (loading):** botão mostra spinner e fica desabilitado; nenhum toque duplo inicia dois servidores (idempotência).
- [ ] **Estado `running`:** exibe URL, QR Code e `sessionId` em até 2 s após o toque; botão vira "Parar servidor".
- [ ] **Estado `error`:** mensagem específica por `ServerErrorCode` (nunca erro genérico quando o código é conhecido) + ação "Tentar novamente".
- [ ] **Parar com transferências ativas:** diálogo de confirmação; ao confirmar, transferências marcadas como `cancelled` no histórico.
- [ ] **App em background:** notificação persistente enquanto `running`; encerrar o app para o servidor e libera a porta.

### Modo Rede Própria — HU-08 (app host)

- [ ] **Android — criação:** tocar em "Criar rede" pede `NEARBY_WIFI_DEVICES` com explicação prévia; hotspot ativo com SSID/senha + QR Code Wi-Fi exibidos em até 5 s.
- [ ] **Android — duas etapas:** jornada "1) Conectar à rede → 2) Acessar o link" com as duas etapas e os dois QR Codes claramente distintos.
- [ ] **Android — permissão negada:** mensagem específica + atalho para as configurações do app; nunca erro genérico.
- [ ] **Android — encerramento:** parar o servidor desliga o hotspot criado pelo app; nenhuma rede órfã permanece ativa.
- [ ] **iOS:** passo a passo do Hotspot Pessoal; ao detectar a interface ativa, servidor inicia automaticamente sem toque adicional.
- [ ] **Erros:** `HOTSPOT_UNSUPPORTED` e `HOTSPOT_FAILED` com mensagens próprias + fallback sugerido (mesma rede Wi-Fi).

### Tela Transferências (app host)

- [ ] **Loading inicial:** skeleton/placeholder enquanto o estado da sessão carrega (nunca tela branca).
- [ ] **Lista vazia:** estado vazio ilustrado com instrução ("Compartilhe o link ao lado para começar").
- [ ] **Transferência ativa:** progresso, velocidade e IP do peer atualizados no mínimo a cada 500 ms, sem travar a UI (Princípio: UI nunca bloqueia).
- [ ] **Transferência falha:** item marcado como `failed` com `errorMessage` visível; a falha de uma transferência não afeta as demais.
- [ ] **Recebido concluído:** ação "Abrir/Compartilhar" funcional via share sheet do sistema.

### Tela Arquivos Compartilhados (app host)

- [ ] Seleção via document picker do sistema; cancelar o picker não altera a lista.
- [ ] Arquivo adicionado aparece na web-ui dos convidados em até 3 s (ciclo de polling).
- [ ] Remoção imediata da lista; novo request de download do id removido retorna `404`.

### Interface Web (dispositivo convidado)

- [ ] **Carregamento:** página funcional sem nenhum recurso externo; exibe `sessionId` em destaque.
- [ ] **Upload — progresso:** barra individual por arquivo com %, tamanho e status; múltiplos arquivos enfileirados sequencialmente.
- [ ] **Upload — erros:** cada código de erro da API (`413`, `422`, `507`) exibe mensagem específica; queda de conexão exibe "Conexão perdida" + botão "Tentar novamente" (que reenvia apenas os arquivos não concluídos).
- [ ] **Download:** clique dispara download nativo do navegador com nome de arquivo correto (incluindo acentos/UTF-8).
- [ ] **Servidor desconectado:** banner "Servidor desconectado — verifique o app no celular host" quando o polling falha 2 vezes seguidas; some automaticamente ao reconectar.
- [ ] **Responsivo:** utilizável em viewport ≥ 320 px; drag-and-drop apenas onde suportado (desktop), sem quebrar mobile.

### Qualidade (Definition of Done — Princípios III e VII)

- [ ] Testes unitários para **todas** as funções exportadas: máquina de estados do servidor, sanitização de nomes, geração de sufixo anti-duplicata, parsing multipart, formatadores (`formatBytes`, `formatSpeed`), stores Zustand e hooks (`useServer`, `useTransfers`).
- [ ] Cobertura ≥ 90% em `services/`, `lib/` e `store/`; ≥ 80% global — verificada no CI.
- [ ] Todos os payloads validados com os schemas Zod da Seção 3 (teste de contrato para cada endpoint: casos válido + cada código de erro).
- [ ] Sem `any`; `tsc --noEmit` e ESLint limpos.
- [ ] Testado manualmente: Android ↔ iOS, upload e download de arquivo ≥ 1 GB sem crash de memória (streaming comprovado).
