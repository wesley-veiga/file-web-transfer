# Spec — Transferir Arquivos

**Feature:** Compartilhamento de arquivo via menu do sistema + pareamento por token/QR Code
**Documento pai:** [constitution.md](constitution.md)
**Versão:** 2.1.0 · **Data:** 2026-09-12 · *(rev. 2.1: compatibilidade restrita definitivamente ao Android — suporte a iOS removido do escopo do produto, deixa de ser uma decisão pendente da T-901; ver `tarefas.md` rev. 1.11 para o detalhamento em tarefas; rev. 2.0: pivô de produto — a navegação por abas dá lugar a dois fluxos únicos, Enviar e Receber, disparados por compartilhamento do SO ou por um botão na Home; o token de sessão deixa de ser cosmético e passa a ser controle de acesso real da API; upload múltiplo via share sheet passa a ser suportado; ver `tarefas.md` rev. 1.10/Fase 9 para o detalhamento em tarefas e o que foi descontinuado; rev. 1.2: remoção do modo rede própria — HU-08 removida, conectividade restrita a Wi-Fi local existente; rev. 1.1: Android 14+, modo rede própria HU-08)*
**Features envolvidas:** `features/server`, `features/transfer`, `features/files`, `web-ui/`

---

## 1. Visão Geral

**Pivô de produto (rev. 2.0):** o app deixa de ser um console de servidor com abas (Servidor, Compartilhados, Recebidos, Transferências) e passa a ter uma usabilidade mínima, centrada em dois fluxos disparados por evento, reaproveitando por baixo os mesmos módulos de servidor/transferência/arquivos já construídos nas Fases 0–8:

1. **Modo Enviar** — o usuário compartilha um arquivo (ou vários) para este app pelo menu de compartilhar do sistema operacional. O app abre direto numa tela que gera um **token** legível por humanos (reaproveita `generateSessionId`, T-104) e sobe o servidor automaticamente, exibindo o token como título da tela e um **QR Code** cuja URL já leva o token na querystring (`?token=<token>`). Quem escanear o QR (ou abrir o link) baixa o(s) arquivo(s); enquanto isso acontece, o dispositivo que está compartilhando mostra "transferência em andamento" e mantém a tela acesa até concluir.
2. **Modo Receber** — o usuário abre o app diretamente (não por compartilhamento) e toca no botão "Receber arquivo". O app gera um token, sobe o servidor e mostra o QR Code (URL + token) com o **token também visível como texto**. Quem acessar esse link, enquanto o host estiver em modo Receber, vê uma página para escolher um ou mais arquivos; ao selecionar, o envio começa imediatamente.

Em ambos os casos, acessar a URL **sem** o token na querystring (ou com um token inválido) abre uma caixa de texto pedindo a confirmação do token exibido no dispositivo host — o token passa a ser controle de acesso real da API (ver Seção 4), não apenas um identificador visual como era o antigo `sessionId` (v1).

**Conectividade — via rede Wi-Fi local existente, sem depender de internet** (sem mudança nesta revisão):

O servidor sobe no IP da rede Wi-Fi à qual o host já está conectado. Sem rede disponível, o app orienta o usuário a conectar-se a uma rede Wi-Fi antes de tentar novamente — o app não cria rede própria (modo removido, ver ADR-002).

### Fora de escopo (v1 / v2.0)

- Android 13 ou inferior (mínimo suportado: **Android 14 / API 34**);
- Transferência via internet ou entre redes diferentes;
- Criptografia TLS/HTTPS (rede local; o token de sessão mitiga acesso ao host errado ou por terceiros na mesma rede, mas o tráfego em si continua sem TLS);
- Retomada de transferência interrompida (candidato a v1.1);
- Mais de uma sessão/token ativos simultaneamente no mesmo host (um app = um modo ativo = um token por vez);
- **iOS (rev. 2.1): fora de escopo definitivamente.** O app é Android-only — não é mais uma decisão pendente da T-901, e sim uma decisão de produto tomada nesta revisão. O convidado (quem baixa/envia pela `web-ui`) continua podendo usar qualquer navegador, em qualquer plataforma — a restrição vale só para o app host.

> **Nota:** "Pareamento com senha", listado como fora de escopo/candidato a v1.1 até a rev. 1.2, passa a ser **entregue nesta revisão** na forma do token de sessão com validação real no servidor (Seção 4).

---

## 2. Histórias de Usuário

> **Reformulação (rev. 2.0, 2026-09-11):** as histórias abaixo substituem o fluxo antigo de navegação por abas. HU-01, HU-02, HU-06 e HU-07 (versões antigas) foram descontinuadas — ver notas ao final desta seção. HU-03, HU-04 e HU-05 tiveram seu conteúdo absorvido pelas novas histórias. Ver `tarefas.md` Fase 9 para as tarefas correspondentes.

### HU-09 — Abrir o app via compartilhamento do SO (modo Enviar)

> **Como** usuário, **quero** escolher este app no menu de compartilhar do sistema a partir de um ou mais arquivos, **para** compartilhá-los sem precisar abrir o app antes e navegar até uma tela específica.

**Comportamento esperado:**
- O app aparece como destino no menu de compartilhar do Android para arquivos de qualquer tipo (`ACTION_SEND`/`ACTION_SEND_MULTIPLE`). Sem suporte a iOS (rev. 2.1 — fora de escopo definitivamente).
- Ao ser invocado assim, o app abre diretamente na tela de Enviar (HU-11), pulando a Home idle (HU-10).
- Suporta um ou vários arquivos selecionados de uma vez no compartilhamento do SO (decisão desta revisão).

### HU-10 — Tela inicial (app aberto sem compartilhamento)

> **Como** usuário, **quero** ver uma tela simples ao abrir o app diretamente, **para** entender como usá-lo.

**Comportamento esperado:**
- Título: "Transfer Files".
- Texto de apoio: "Para compartilhar, navegue até um arquivo, clique em compartilhar, selecione este aplicativo como destino."
- Botão azul centralizado: "Receber arquivo", que leva à tela de Receber (HU-12).

### HU-11 — Modo Enviar: token, QR e progresso (host)

> **Como** usuário host que compartilhou um arquivo para o app, **quero** ver um token e um QR Code, **para** que outra pessoa na minha rede baixe o arquivo escaneando ou digitando o token.

**Comportamento esperado:**
- Ao entrar nesta tela (via HU-09), o app gera um token humano (reaproveita `generateSessionId`, T-104) e inicia o servidor automaticamente (reaproveita `ServerService`, T-203).
- O token é exibido como **título** da tela; abaixo, o QR Code com a URL completa + `?token=<token>`.
- Falha ao iniciar o servidor reaproveita o tratamento de erro por `ServerErrorCode` já existente (mensagem específica + tentar novamente).
- Quando o convidado inicia o download (HU-13), a tela passa a exibir "Transferência em andamento" com progresso (reaproveita o store de transferências, T-601), e o dispositivo **mantém a tela acesa** (`expo-keep-awake`) durante todo o processo, voltando ao normal ao concluir ou cancelar.
- Substitui, para este caso, o antigo fluxo de "iniciar servidor" manual da Home/Servidor (T-204, descontinuada).

### HU-12 — Modo Receber: gerar QR + token visível (host)

> **Como** usuário host, **quero** tocar em "Receber arquivo" e ver um token e QR Code, **para** que outra pessoa me envie um ou mais arquivos.

**Comportamento esperado:**
- Ao tocar em "Receber arquivo" (HU-10), o app gera um token (T-104) e inicia o servidor (T-203) automaticamente.
- A tela mostra o QR Code (URL + `?token=<token>`) e também o **token como texto visível** (diferente da HU-11: aqui o requisito exige o token legível além do QR, não só como título).
- Enquanto aguarda, mostra estado de espera; ao receber upload (HU-14), mostra progresso (reaproveita T-601); ao concluir, ação inline "Abrir/Compartilhar" para o arquivo recebido (reaproveita o comportamento da antiga aba Recebidos, T-303, descontinuada como aba).

### HU-13 — Acessar o link do modo Enviar (download pelo convidado)

> **Como** convidado, **quero** abrir o link/QR compartilhado, **para** baixar o arquivo que o host está compartilhando.

**Comportamento esperado:**
- A página web valida o token da querystring contra o token ativo da sessão do host (Seção 4).
- Token válido: mostra o(s) arquivo(s) disponíveis (nome, tamanho) com ação para iniciar o download; download nativo do navegador com `Content-Length` e nome correto (herda a antiga HU-05).
- Token ausente/inválido: ver HU-15 (confirmação de token).
- Absorve o conteúdo da antiga HU-05 ("Baixar arquivos do host"), agora restrito ao modo Enviar e ao token da sessão.

### HU-14 — Acessar o link do modo Receber (upload pelo convidado)

> **Como** convidado, **quero** abrir o link/QR do host em modo Receber, **para** enviar um ou mais arquivos para ele.

**Comportamento esperado:**
- A página web valida o token da querystring (Seção 4).
- Token válido: mostra área de upload (seleção múltipla + drag-and-drop quando suportado); **selecionar o(s) arquivo(s) já inicia a transferência**, sem botão de confirmação extra (decisão desta revisão: suporta múltiplos arquivos, mantendo a fila sequencial já existente, T-502).
- Token ausente/inválido: ver HU-15.
- Absorve o conteúdo da antiga HU-04 ("Enviar arquivos para o host"), agora restrito ao modo Receber e ao token da sessão.

### HU-15 — Confirmar token ausente ou inválido na URL (convidado)

> **Como** convidado que abriu a URL sem o token (ex.: copiou o link sem a querystring) ou com um token errado, **quero** digitar o token exibido no dispositivo host, **para** liberar o acesso ao conteúdo correto.

**Comportamento esperado:**
- Ao acessar a página sem `?token=` ou com token inválido, em vez do conteúdo de download/upload a página exibe uma caixa de texto pedindo o token.
- Ao confirmar um token válido, a página passa a exibir a view apropriada ao modo ativo do host (HU-13 ou HU-14), sem precisar recarregar com a querystring correta.
- Token inválido exibe mensagem de erro e permite nova tentativa, sem limite de tentativas nesta versão.
- Unifica o que antes eram dois requisitos equivalentes (um para download, um para upload).

### HU-16 — Encerrar sessão ativa

> **Como** usuário host em modo Enviar ou Receber, **quero** encerrar a sessão a qualquer momento, **para** parar de expor o token e o(s) arquivo(s).

**Comportamento esperado:**
- Ação de encerrar (reaproveita `ServerService.stop`) disponível nas telas de Enviar (HU-11) e Receber (HU-12).
- Havendo transferência em andamento, pede confirmação antes de encerrar (comportamento herdado da antiga HU-02).
- Ao encerrar: token invalidado, servidor parado, porta liberada, app volta para a Home idle (HU-10).
- Fechar o app de verdade continua parando o servidor e liberando a porta (comportamento de T-205/T-808, sem mudança nesta revisão).

---

### Histórias descontinuadas ou absorvidas (versões pré rev. 2.0)

> **HU-01 (Iniciar servidor) removida (rev. 2.0):** o botão manual de iniciar servidor na Home some — o servidor agora sobe automaticamente ao entrar em HU-11 ou HU-12. Ver T-204 (descontinuada) em `tarefas.md`.

> **HU-02 (Parar servidor) substituída (rev. 2.0):** conteúdo absorvido pela HU-16 (Encerrar sessão ativa), sem a aba/tela dedicada de servidor.

> **HU-03 (Acessar a interface web) mantida em espírito, ajustada (rev. 2.0):** a página continua sem recursos externos, responsiva, com tema claro/escuro; o antigo "exibe o identificador da sessão em destaque" dá lugar ao fluxo de token (HU-13/HU-14/HU-15) — o token não é mais exibido de forma passiva na página, é o mecanismo de acesso.

> **HU-04 (Enviar arquivos para o host) substituída (rev. 2.0):** conteúdo absorvido pela HU-14, agora restrito ao modo Receber e protegido por token.

> **HU-05 (Baixar arquivos do host) substituída (rev. 2.0):** conteúdo absorvido pela HU-13, agora restrito ao modo Enviar e protegido por token.

> **HU-06 (Disponibilizar arquivos para download via picker manual) removida (rev. 2.0):** a curadoria manual de uma lista "Compartilhados" some — o(s) arquivo(s) do modo Enviar vêm diretamente do compartilhamento do SO (HU-09). Ver T-302 (descontinuada) em `tarefas.md`.

> **HU-07 (Acompanhar transferências em aba dedicada) removida (rev. 2.0):** o progresso em tempo real passa a aparecer embutido nas telas de Enviar (HU-11) e Receber (HU-12), sem uma aba/tela própria. Ver T-603 (descontinuada) em `tarefas.md`.

> **HU-08 (Abrir rede própria) removida (rev. 1.2):** ver ADR-002 (status: Rejeitada) e T-209 em `tarefas.md`. Sem mudança nesta revisão.

---

## 3. Modelos de Dados

Tipos de domínio em `src/features/*/types/` — fonte única de verdade entre app e web-ui (Princípio II). Todos os payloads da API têm schema Zod correspondente em `shared/types/api.ts`.

```typescript
// ─── features/server/types ───────────────────────────────────────────

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
  startedAt: number | null;          // epoch ms
  error: ServerError | null;
}

export type ServerErrorCode =
  | 'NO_NETWORK'           // sem rede Wi-Fi disponível
  | 'PORT_UNAVAILABLE'     // nenhuma porta livre no range
  | 'PERMISSION_DENIED'    // permissão de rede/armazenamento negada
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
  mode: z.enum(['send', 'receive']),
  /** true quando o `token` enviado via querystring bate com o token ativo da sessão. Nunca ecoa o valor do token de volta (rev. 2.0). */
  tokenValid: z.boolean(),
  appVersion: z.string(),
  maxUploadBytes: z.number().int().positive(),
});

export const apiErrorSchema = z.object({
  error: z.object({
    code: z.string(),      // ex.: "FILE_TOO_LARGE", "INVALID_TOKEN" (rev. 2.0)
    message: z.string(),
  }),
});

export type FileEntryDto = z.infer<typeof fileEntryDtoSchema>;
export type SessionInfo = z.infer<typeof sessionInfoSchema>;
export type ApiError = z.infer<typeof apiErrorSchema>;
```

> **Rev. 2.0:** `sessionInfoSchema` deixa de ter o campo `sessionId` — antes ele ecoava o identificador da sessão sem nenhuma checagem, o que agora contradiria o modelo de acesso por token (expor a credencial numa rota sem gate). Ver Seção 4.

---

## 4. Contratos de API

API HTTP servida pelo servidor embarcado, consumida pela `web-ui`. Todas as respostas JSON usam `Content-Type: application/json; charset=utf-8`. Erros seguem sempre o envelope `apiErrorSchema`.

### `GET /` — Interface web

| | |
|---|---|
| Resposta | `200` — HTML autocontido da interface web (assets inline, sem CDN). Renderiza a view (download, upload ou caixa de token) conforme o modo ativo e a validade do token — ver T-909/T-910 em `tarefas.md` |

### `GET /api/session?token=<opcional>` — Informações da sessão (rev. 2.0: rota pública, gate parcial)

Usado pela web-ui ao carregar, para saber o modo ativo e se o token informado é válido — sem nunca expor o valor do token.

| | |
|---|---|
| Query | `token?: string` — quando presente, validado contra o token ativo da sessão |
| Resposta `200` | `SessionInfo` — sempre pública (não requer token válido); ex.: `{ "mode": "send", "tokenValid": false, "appVersion": "2.0.0", "maxUploadBytes": 4294967296 }` |

> **Rev. 2.0:** junto com `GET /`, é a única rota que responde sem token válido — propositalmente, para dar suporte à caixa de confirmação de token (HU-15). Nunca inclui o valor do token na resposta, com ou sem `token` na query.

### `GET /api/files` — Listar arquivos disponíveis para download

| | |
|---|---|
| Query | `token: string` (obrigatório, rev. 2.0) · `origin?: "shared" \| "received"` (padrão: `shared`) |
| Resposta `200` | `{ "files": FileEntryDto[] }` ordenado por `createdAt` desc |
| Erro `401` | `INVALID_TOKEN` (rev. 2.0) — token ausente ou não bate com o token ativo da sessão |

### `GET /api/files/:id/download` — Baixar arquivo

| | |
|---|---|
| Query | `token: string` (obrigatório, rev. 2.0) |
| Resposta `200` | Stream binário. Headers: `Content-Length`, `Content-Type` (mime real), `Content-Disposition: attachment; filename*=UTF-8''<nome-encodado>` |
| Erro `401` | `INVALID_TOKEN` (rev. 2.0) |
| Erro `404` | `{ "error": { "code": "FILE_NOT_FOUND", ... } }` — id inexistente ou removido do compartilhamento |

### `POST /api/upload?token=<token>` — Enviar arquivo para o host

| | |
|---|---|
| Query | `token: string` (obrigatório, rev. 2.0) |
| Request | `multipart/form-data`, campo `file` (um arquivo por request; a web-ui enfileira múltiplos uploads sequencialmente — múltiplos arquivos selecionados de uma vez são suportados, rev. 2.0). Processado com **streaming** — o corpo nunca é bufferizado inteiro em memória |
| Resposta `201` | `{ "file": FileEntryDto }` — arquivo salvo (nome final pode ter sufixo anti-duplicata) |
| Erro `401` | `INVALID_TOKEN` (rev. 2.0) |
| Erro `400` | `INVALID_MULTIPART` — corpo malformado ou campo `file` ausente |
| Erro `413` | `FILE_TOO_LARGE` — excede `maxUploadBytes` |
| Erro `422` | `INVALID_FILENAME` — nome vazio ou inválido após sanitização (path traversal → rejeitado, Princípio VI) |
| Erro `507` | `INSUFFICIENT_STORAGE` — sem espaço no dispositivo host |

### `GET /api/events` — Atualizações da sessão (polling)

A web-ui consulta a cada 3 s para atualizar a lista de arquivos.

| | |
|---|---|
| Query | `token: string` (obrigatório, rev. 2.0) · `since: number` (epoch ms da última consulta) |
| Resposta `200` | `{ "filesChangedAt": number }` — se maior que `since`, a web-ui refaz `GET /api/files` |
| Erro `401` | `INVALID_TOKEN` (rev. 2.0) |

### Regras transversais

- **Sanitização de upload:** nome normalizado (`basename` apenas, sem `..`, sem caracteres de controle, máx. 255 chars); escrita restrita ao diretório sandbox `received/` do app (ou pasta configurada, T-802).
- **Servidor parado:** qualquer request após `stopping` recebe connection refused (porta fechada) — a web-ui trata como estado "Servidor desconectado".
- **Controle de acesso por token (rev. 2.0):** `GET /` e `GET /api/session` são as únicas rotas públicas; todas as demais (`/api/files`, `/api/files/:id/download`, `/api/upload`, `/api/events`) exigem `token` de query batendo com o token ativo da sessão, sob pena de `401 INVALID_TOKEN`. Isso substitui a linha "Sem autenticação (v1)" da versão anterior desta spec — decisão de produto desta revisão (ver Seção 1).
- Nenhum endpoint expõe `localUri`, paths do sistema de arquivos, ou o valor do token fora do fluxo controlado pelo app (QR Code/tela do host).

---

## 5. Critérios de Aceite

### Tela Home (idle, app host)

- [ ] Título "Transfer Files", texto de apoio e botão azul centralizado "Receber arquivo" sempre visíveis quando o app abre sem compartilhamento.
- [ ] Tocar em "Receber arquivo" navega para a tela de Receber (gera token + inicia servidor em modo `receive`).

### Tela Enviar (app host, aberta via compartilhamento do SO)

- [ ] App recebido via compartilhamento do SO (um ou vários arquivos) abre direto nesta tela, sem passar pela Home idle.
- [ ] Token gerado e exibido como título; servidor inicia automaticamente em modo `send`; QR Code com URL + token exibido em até 2 s.
- [ ] Estado de erro ao iniciar servidor reaproveita mensagens por `ServerErrorCode` + ação "Tentar novamente".
- [ ] Ao iniciar um download pelo convidado: "Transferência em andamento" com progresso; tela permanece acesa (`expo-keep-awake`) até concluir/cancelar, voltando ao normal depois.
- [ ] Encerrar sessão com transferência ativa pede confirmação; ao confirmar, token invalidado, servidor parado, volta à Home idle.

### Tela Receber (app host)

- [ ] Ao tocar em "Receber arquivo": token gerado, servidor inicia em modo `receive`, QR Code exibido com URL + token, e o **token também como texto visível** (não só como título).
- [ ] Progresso de upload(s) em andamento exibido em tempo real (reaproveita T-601).
- [ ] Upload concluído: ação inline "Abrir/Compartilhar" para o arquivo recebido.
- [ ] Encerrar sessão segue as mesmas regras da tela Enviar.

### Interface Web (dispositivo convidado)

- [ ] **Carregamento:** página funcional sem nenhum recurso externo, responsiva (≥ 320 px), tema claro/escuro.
- [ ] **Token ausente/inválido na URL:** exibe caixa de texto pedindo o token em vez do conteúdo de download/upload; token válido digitado libera a view correta sem precisar recarregar a página.
- [ ] **Modo Enviar (download):** lista o(s) arquivo(s) disponíveis com nome/tamanho; clique dispara download nativo do navegador com nome correto (incluindo acentos/UTF-8).
- [ ] **Modo Receber (upload):** seleção múltipla + drag-and-drop (desktop); selecionar arquivo(s) já inicia o envio, sem botão extra; barra de progresso individual por arquivo; mensagens específicas por erro (`401`, `413`, `422`, `507`); "Tentar novamente" só para não concluídos.
- [ ] **Servidor desconectado:** banner "Servidor desconectado — verifique o app no celular host" quando o polling falha 2 vezes seguidas; some automaticamente ao reconectar.
- [ ] Nunca renderiza a view do modo errado (download quando o host está em Receber, ou vice-versa).

### API — controle de acesso por token

- [ ] `GET /` e `GET /api/session` respondem sem token.
- [ ] `GET /api/files`, `GET /api/files/:id/download`, `POST /api/upload` e `GET /api/events` retornam `401 INVALID_TOKEN` sem token válido, para qualquer token incorreto/ausente.
- [ ] `GET /api/session` nunca inclui o valor do token na resposta, com ou sem `token` na query.

### Qualidade (Definition of Done — Princípios III e VII)

- [ ] Testes unitários para **todas** as funções exportadas, incluindo o middleware de validação de token, a integração de compartilhamento do SO e as novas telas/estados.
- [ ] Cobertura ≥ 90% em `services/`, `lib/` e `store/`; ≥ 80% global — verificada no CI.
- [ ] Todos os payloads validados com os schemas Zod da Seção 3 (teste de contrato para cada endpoint: casos válido + cada código de erro, incluindo `401 INVALID_TOKEN`).
- [ ] Sem `any`; `tsc --noEmit` e ESLint limpos.
- [ ] Testado manualmente: compartilhar arquivo(s) de outro app → modo Enviar → download por um convidado; "Receber arquivo" → modo Receber → upload de um convidado; acesso sem token em ambos os casos; app host em Android, convidado acessando via navegador (rev. 2.1: iOS fora de escopo para o app host).
