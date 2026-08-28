# Tarefas — Transferir Arquivos

**Derivado de:** [transferir.md](transferir.md) · **Regido por:** [constitution.md](constitution.md)
**Revisão 1.2 (2026-08-27):** modo rede própria despriorizado e removido — T-206/T-207/T-208 marcadas como removidas (ver ADR-002, status Rejeitada); nova T-209 reverte a implementação de T-207; T-701 ajustada (cenário hotspot removido do roteiro).
**Revisão 1.1 (2026-07-16):** validado contra as novas regras — Android 14+ (T-001 ajustada), modo rede própria HU-08 (novas T-206/T-207/T-208), governança de repositório (nova T-006), cenário hotspot no teste de fogo (T-701 ajustada).

Cada tarefa é uma fatia pequena e entregável, com dependências explícitas e critério de pronto próprio. O fluxo de execução de **cada tarefa** usa os três agentes (em `.claude/agents/`):

1. `implementador` — implementa a tarefa;
2. `testador` — escreve/completa os testes unitários e os executa;
3. `validador` — confere a tarefa contra a spec, os critérios de aceite e a constituição (não escreve código).

Uma tarefa só é marcada `[x]` quando os três passos passam.

**Fluxo git por tarefa (obrigatório, ver constituição §5):** toda tarefa vive em uma branch própria `feat/t-xxx-descricao` criada a partir de `develop`; implementador e testador commitam **apenas nela**; o PR para `develop` é aberto com o skill `/criar-pr` e só recebe merge após veredito **APROVADA** do `validador`.

**Legenda:** `⬅ depende de` · **[P]** = paralelizável com as irmãs da mesma fase

---

## Fase 0 — Fundação do Projeto

- [x] **T-001 · Bootstrap do projeto Expo**
  Criar projeto Expo (dev build) com TypeScript `strict: true`, Expo Router, **`minSdkVersion = 34` (Android 14+)** e estrutura de pastas da constituição (`src/app`, `src/features/{server,transfer,files}`, `src/shared`, `web-ui/`).
  *Pronto quando:* app abre em Android 14+ e iOS com tela placeholder; build falha em `minSdk < 34`; `tsc --noEmit` limpo.

- [x] **T-002 · Qualidade automatizada** ⬅ T-001
  ESLint (flat config) + Prettier + `eslint-plugin-boundaries` (regras de dependência do Princípio IV) + Husky + lint-staged + Conventional Commits. Bloquear `any`, `console.log` e `TODO` sem issue.
  *Pronto quando:* commit com violação é rejeitado localmente; `npm run lint` limpo.

- [x] **T-003 · Infra de testes** ⬅ T-001
  Jest + React Native Testing Library configurados; thresholds de cobertura (90% domínio/serviços, 80% global); mocks base para `expo-file-system`, `expo-network` e módulo do servidor.
  *Pronto quando:* `npm test` roda um teste exemplo com cobertura reportada.

- [x] **T-004 · CI** ⬅ T-002, T-003
  Pipeline (GitHub Actions): typecheck → lint → testes com cobertura, bloqueando merge.
  *Pronto quando:* PR de teste com erro proposital fica vermelho.

- [x] **T-006 · Governança do repositório** ⬅ T-004
  No GitHub (`wesley-veiga/file-web-transfer`): proteção das branches `main` e `develop` (PR obrigatório, CI verde obrigatório, squash merge), template de PR com o checklist do `validador`, labels por fase.
  *Pronto quando:* push direto em `main`/`develop` é rejeitado; PR novo já nasce com o template.

- [x] **T-005 · NativeWind + design tokens** ⬅ T-001 **[P]**
  NativeWind instalado; `tailwind.config.js` com tokens de cor/espaçamento/tipografia; tema claro/escuro; componentes base em `shared/components` (Button, Card, Screen).
  *Pronto quando:* tela placeholder estilizada via `className` nos dois temas.

## Fase 1 — Biblioteca Compartilhada (funções puras, TDD)

- [x] **T-101 · Utilitários de formatação** ⬅ T-003 **[P]**
  `formatBytes`, `formatSpeed`, `formatDuration` em `shared/lib`.
  *Pronto quando:* 100% de cobertura (funções puras).

- [x] **T-102 · Sanitização de nomes de arquivo** ⬅ T-003 **[P]**
  `sanitizeFileName` (basename, sem `..`/controle, máx. 255) e `resolveDuplicateName` (sufixo `(1)`, `(2)`…). Casos de path traversal como testes obrigatórios.
  *Pronto quando:* todos os vetores de ataque da spec (Seção 4, regras transversais) cobertos por teste.

- [x] **T-103 · Schemas Zod da API** ⬅ T-003 **[P]**
  `shared/types/api.ts` conforme Seção 3 da spec (`fileEntryDtoSchema`, `sessionInfoSchema`, `apiErrorSchema`).
  *Pronto quando:* testes de parse válido/inválido para cada schema.

- [x] **T-104 · Gerador de sessionId humano** ⬅ T-003 **[P]**
  `generateSessionId()` (ex.: `maçã-42`), determinístico sob seed injetável para teste.
  *Pronto quando:* testes de formato e unicidade razoável.

## Fase 2 — Feature: Servidor (`features/server`)

- [x] **T-201 · Máquina de estados do servidor** ⬅ T-103
  Tipos `ServerInfo`/`ServerStatus`/`ServerError` + store Zustand com transições válidas (`idle → starting → running → stopping → idle`; `error` de qualquer estado). Sem I/O real — o serviço HTTP é injetado.
  *Pronto quando:* todas as transições (válidas e inválidas) testadas.

- [x] **T-202 · Spike: escolha da lib de servidor HTTP** ⬅ T-001
  Avaliar `react-native-http-bridge-refurbished` vs. implementação sobre TCP socket. Critério decisivo: upload multipart ≥ 1 GB com streaming, Android e iOS. Registrar decisão em `docs/adr/001-servidor-http.md`.
  *Pronto quando:* ADR escrito com prova de conceito medida. **(timebox: 1 dia)**
  **Decisão final (2026-08-27):** `react-native-http-bridge-refurbished` escolhida; PoC empírica dispensada por decisão de produto (sem infra de dispositivo físico) — ver ADR-001 §8.

- [x] **T-203 · Serviço do servidor HTTP** ⬅ T-201, T-202
  `ServerService` (start/stop, porta 8080 com fallback, IP via `expo-network` — rede Wi-Fi **ou** interface do hotspot, campo `networkMode`) atrás de interface injetável.
  *Pronto quando:* testes com mock do módulo nativo cobrindo sucesso nos dois modos, `NO_NETWORK`, `PORT_UNAVAILABLE`.
  **Nota (rev. 1.2):** `networkMode` passou a ter valor único `'wifi'` após T-209 — descrição acima é histórica.

- [x] **T-204 · Tela Home/Servidor** ⬅ T-203, T-005, T-104
  UI dos estados `idle/starting/running/error` (HU-01, HU-02): botão iniciar/parar, spinner, URL + QR Code + sessionId, mensagens por `ServerErrorCode`, confirmação ao parar com transferências ativas. Estado `idle` sem rede exibe a ação "Criar rede" (fluxo completo na T-208).
  *Pronto quando:* critérios de aceite "Tela Home / Servidor" da spec todos atendidos, com testes de componente por estado.
  **Nota (rev. 1.2):** ação "Criar rede" removida por T-209 (T-208 cancelada) — descrição acima é histórica.

- [x] **T-205 · Notificação persistente / ciclo de vida** ⬅ T-204
  Notificação enquanto `running`; encerrar app → para servidor e libera porta (e desliga hotspot criado pelo app, se houver).
  **Nota (rev. 1.2):** cláusula de hotspot sem efeito após T-209 — descrição acima é histórica.
  *Pronto quando:* comportamento verificado em Android e iOS.

- [ ] ~~T-206 · Spike: Local Only Hotspot no Android 14+~~ ⬅ T-001
  **Removida (rev. 1.2):** modo rede própria despriorizado — ver ADR-002 (status: Rejeitada) e T-209.

- [ ] ~~T-207 · Serviço de rede própria (`HotspotService`)~~ ⬅ T-206, T-201
  **Removida (rev. 1.2):** implementação revertida por T-209 — ver ADR-002 (status: Rejeitada). Havia sido marcada `[x]` (PR #27/#28); reversão registrada abaixo.

- [ ] ~~T-208 · Fluxo "Criar rede" na Home~~ ⬅ T-207, T-204
  **Removida (rev. 1.2):** UI da HU-08 não será implementada — HU-08 removida de `transferir.md`. Ver ADR-002 (status: Rejeitada) e T-209.

- [x] **T-209 · Remover Modo Rede Própria (reverte `HotspotService`)** ⬅ T-207
  Reverte a implementação de T-207: remove `HotspotService`, `hotspotServiceFactory`, `nativeHotspot`, o campo `hotspot`/tipo `HotspotInfo` de `ServerInfo`, os códigos de erro `HOTSPOT_UNSUPPORTED`/`HOTSPOT_FAILED` e a ação "Criar rede" (`onCreateNetworkPress`) da Home. `NetworkMode` passa a ter um único valor (`'wifi'`). Produto passa a suportar apenas conexão via IP de rede Wi-Fi local existente.
  *Pronto quando:* nenhuma referência a hotspot/rede própria resta em código, testes ou specs; estado `idle` sem rede exibe apenas orientação para conectar-se a uma rede Wi-Fi (sem CTA de criar rede); `tsc --noEmit`, `lint` e suíte de testes verdes com cobertura mantida.

## Fase 3 — Feature: Arquivos (`features/files`)

- [ ] **T-301 · Repositório de arquivos** ⬅ T-102, T-103 **[P]**
  `FileRepository` sobre `expo-file-system`: salvar em `received/`, listar, remover, mapear `FileEntry → FileEntryDto` (nunca expor `localUri`).
  *Pronto quando:* testes com mock de filesystem; teste garante que DTO não contém `localUri`.

- [x] **T-302 · Compartilhar arquivos do host** ⬅ T-301, T-005
  Document picker, lista "Compartilhados" com remoção (HU-06); store da feature.
  *Pronto quando:* critérios de aceite "Tela Arquivos Compartilhados" atendidos (exceto o item de 3 s, que depende de T-503).

- [ ] **T-303 · Aba Recebidos + abrir/compartilhar** ⬅ T-301, T-005
  Lista de recebidos com share sheet do SO (parte da HU-07).
  *Pronto quando:* abrir e compartilhar funcionam nos dois SOs.

## Fase 4 — API HTTP (rotas sobre o servidor)

- [ ] **T-401 · Roteador + envelope de erro** ⬅ T-203
  Mini-roteador sobre a lib escolhida; resposta de erro sempre no envelope `apiErrorSchema`; `GET /api/session`.
  *Pronto quando:* testes de contrato do envelope e de `/api/session`.

- [ ] **T-402 · `GET /api/files` + `GET /api/files/:id/download`** ⬅ T-401, T-301
  Listagem (query `origin`) e download com streaming, `Content-Length`, `Content-Disposition` UTF-8, `404` para id removido.
  *Pronto quando:* testes de contrato incluindo nome com acentos e id inexistente.

- [ ] **T-403 · `POST /api/upload` com streaming** ⬅ T-401, T-102, T-301
  Parser multipart com streaming (nunca bufferizar corpo inteiro); sanitização + anti-duplicata; erros `400/413/422/507`.
  *Pronto quando:* teste de contrato para cada código de erro; teste de memória com arquivo grande simulado (chunks).

- [ ] **T-404 · `GET /api/events` (polling)** ⬅ T-401
  `filesChangedAt` atualizado em toda mutação da lista de arquivos.
  *Pronto quando:* testes de `since` maior/menor/igual.

## Fase 5 — Interface Web (`web-ui/`)

- [ ] **T-501 · Página base autocontida** ⬅ T-401
  HTML/CSS/JS único, sem CDN, responsivo ≥ 320 px, tema claro/escuro, exibe `sessionId` (HU-03); empacotamento como asset servido em `GET /`.
  *Pronto quando:* página abre de outro dispositivo real na rede.

- [ ] **T-502 · Upload na web-ui** ⬅ T-501, T-403
  Seleção múltipla + drag-and-drop, fila sequencial, barra de progresso individual (XHR `upload.onprogress`), mensagens específicas por erro (`413/422/507`), "Tentar novamente" só para não concluídos (HU-04).
  *Pronto quando:* critérios de aceite "Upload — progresso" e "Upload — erros" atendidos.

- [ ] **T-503 · Download + polling na web-ui** ⬅ T-501, T-402, T-404
  Lista de arquivos com atualização a cada 3 s; download nativo; banner "Servidor desconectado" após 2 falhas de polling, some ao reconectar (HU-05).
  *Pronto quando:* critérios de aceite "Download" e "Servidor desconectado" atendidos.

## Fase 6 — Transferências em Tempo Real (app host)

- [ ] **T-601 · Store de transferências** ⬅ T-103 **[P]**
  Tipos `Transfer` + store Zustand: fila, progresso, velocidade (média móvel), transições de status, `cancelled` ao parar servidor.
  *Pronto quando:* toda a lógica de agregação testada com relógio mockado.

- [ ] **T-602 · Instrumentação das rotas** ⬅ T-601, T-402, T-403
  Upload/download reportam progresso ao store (mín. a cada 500 ms) sem bloquear a transferência.
  *Pronto quando:* testes garantem emissão de progresso e não-bloqueio (throttle testado).

- [ ] **T-603 · Tela Transferências** ⬅ T-601, T-005
  Lista em tempo real (direção, nome, %, velocidade, IP do peer), skeleton de loading, estado vazio ilustrado, item `failed` com mensagem (HU-07).
  *Pronto quando:* critérios de aceite "Tela Transferências" atendidos.

## Fase 7 — Integração e Endurecimento

- [ ] **T-701 · Teste de fogo E2E manual** ⬅ todas as anteriores
  Roteiro: Android host ↔ iOS convidado e vice-versa; arquivo ≥ 1 GB nas duas direções sem crash de memória; parar servidor no meio da transferência → `cancelled` correto; nomes com acento/emoji.
  *Pronto quando:* roteiro executado e registrado em `docs/testes-manuais.md`.

- [ ] **T-702 · Auditoria de conformidade final** ⬅ T-701
  Rodar o agente `validador` sobre o projeto inteiro: cobertura ≥ mínimos, zero `any`, boundaries respeitados, todos os critérios de aceite da spec marcados.
  *Pronto quando:* relatório do validador sem pendências.

---

## Ordem de execução sugerida

```
Fase 0: T-001 → T-002 → T-003 → T-004 → T-006
                 └─ T-005 [P]
Fase 1: T-101 · T-102 · T-103 · T-104   (todas em paralelo)
Fase 2: T-201 → T-203 → T-204 → T-205 → T-209
        T-202 (spike servidor, começar cedo — maior risco)
        ~~T-206 → T-207 → T-208~~ (removidas, rev. 1.2 — ver ADR-002)
Fase 3: T-301 → T-302 · T-303
Fase 4: T-401 → T-402 · T-403 · T-404
Fase 5: T-501 → T-502 · T-503
Fase 6: T-601 → T-602 → T-603
Fase 7: T-701 → T-702
```

> **Maior risco:** T-202 (streaming da lib de servidor) — decisão finalizada (ver ADR-001). T-206 removida (rev. 1.2, ver ADR-002).
