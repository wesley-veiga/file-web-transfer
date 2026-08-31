# Tarefas — Transferir Arquivos

**Derivado de:** [transferir.md](transferir.md) · **Regido por:** [constitution.md](constitution.md)
**Revisão 1.5 (2026-08-31):** revisão de screenshots do app em uso (tema claro e escuro) encontrou 4 bugs visuais adicionais além dos já corrigidos na rev. 1.4 — status bar ilegível no tema claro, modal de Transferências sobrepondo área não clicável do sistema, espaçamentos cortando texto na tela Servidor, toast sem texto com ícones colados nas bordas. Nova T-803 na Fase 8 registra esses achados.
**Revisão 1.4 (2026-08-31):** execução de T-701 (teste de fogo manual em dispositivo real) encontrou 7 bugs reais e 2 pedidos de melhoria de UX, corrigidos em sequência (ver PRs abaixo; todos referenciam T-701 no título/commit). Nova Fase 8 registra as duas melhorias maiores (compartilhar por pasta sem duplicar, local de recebidos configurável) como tarefas formais, ainda em andamento — T-701 continua `[ ]` até o roteiro completo estar executado e registrado em `docs/testes-manuais.md` (pendência já conhecida: o documento só tem a seção 1.1 preenchida, numa branch separada não mesclada).
- Navegação por abas nunca conectada (app só tinha a Home) — PR #52.
- `listen()` do servidor HTTP com callback no argumento errado (loading infinito), race de porta em `findAvailablePort`, retry travado no estado `error`, SSID morto em `useNetworkStatus`, `write()`/`destroy()` concorrentes derrubando conexões — PR #52.
- Chamada concorrente ao document picker rejeitada pela lib nativa — PR #53.
- Ícone quebrado (fallback `MissingIcon` do react-navigation) e depois emoji cortado (`includeFontPadding` do Android) na navbar — PRs #53 e #55.
- Corrupção binária em upload e download (leitura/escrita usando UTF-8 por padrão em vez dos bytes exatos) — arquivos jpeg/mov não abriam no destino — PR #54.
- "Transferências" virou botão flutuante + modal na tela Servidor em vez de aba fixa — PR #56.

**Revisão 1.3 (2026-08-28):** nova T-405 — implementação nativa real do `HttpModule` (T-401–T-404 rodavam só contra mocks); ADR-001 revertido de `react-native-http-bridge-refurbished` para `react-native-tcp-socket` após leitura do código nativo revelar que a lib escolhida não suporta streaming (ver ADR-001 §8, emenda v1.2).
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

- [x] **T-301 · Repositório de arquivos** ⬅ T-102, T-103 **[P]**
  `FileRepository` sobre `expo-file-system`: salvar em `received/`, listar, remover, mapear `FileEntry → FileEntryDto` (nunca expor `localUri`).
  *Pronto quando:* testes com mock de filesystem; teste garante que DTO não contém `localUri`.

- [x] **T-302 · Compartilhar arquivos do host** ⬅ T-301, T-005
  Document picker, lista "Compartilhados" com remoção (HU-06); store da feature.
  *Pronto quando:* critérios de aceite "Tela Arquivos Compartilhados" atendidos (exceto o item de 3 s, que depende de T-503).

- [x] **T-303 · Aba Recebidos + abrir/compartilhar** ⬅ T-301, T-005
  Lista de recebidos com share sheet do SO (parte da HU-07).
  *Pronto quando:* abrir e compartilhar funcionam nos dois SOs.

## Fase 4 — API HTTP (rotas sobre o servidor)

- [x] **T-401 · Roteador + envelope de erro** ⬅ T-203
  Mini-roteador sobre a lib escolhida; resposta de erro sempre no envelope `apiErrorSchema`; `GET /api/session`.
  *Pronto quando:* testes de contrato do envelope e de `/api/session`.

- [x] **T-402 · `GET /api/files` + `GET /api/files/:id/download`** ⬅ T-401, T-301
  Listagem (query `origin`) e download com streaming, `Content-Length`, `Content-Disposition` UTF-8, `404` para id removido.
  *Pronto quando:* testes de contrato incluindo nome com acentos e id inexistente.

- [x] **T-403 · `POST /api/upload` com streaming** ⬅ T-401, T-102, T-301
  Parser multipart com streaming (nunca bufferizar corpo inteiro); sanitização + anti-duplicata; erros `400/413/422/507`.
  *Pronto quando:* teste de contrato para cada código de erro; teste de memória com arquivo grande simulado (chunks).

- [x] **T-404 · `GET /api/events` (polling)** ⬅ T-401
  `filesChangedAt` atualizado em toda mutação da lista de arquivos.
  *Pronto quando:* testes de `since` maior/menor/igual.

- [x] **T-405 · Implementação nativa do `HttpModule` (`react-native-tcp-socket`)** ⬅ T-203, T-401, T-402, T-403, T-404
  T-401–T-404 rodam apenas contra mocks; nenhuma implementação real de `HttpModule` existe e nada em `src/app/` chama `setHttpModule()`/`registerFileRoutes()`/`registerUploadRoute()`/`registerEventsRoute()`. Ao tentar ligar isso pela primeira vez, ficou constatado que a lib escolhida em T-202 (`react-native-http-bridge-refurbished`) não suporta streaming de fato (ver ADR-001 §8, emenda v1.2) — decisão revertida para a Alternativa 2.2 do ADR: servidor HTTP/1.1 próprio sobre `react-native-tcp-socket`, reaproveitando o `multipartStreamParser` (T-403) alimentado incrementalmente pelos eventos `data` do socket (sem `Transfer-Encoding: chunked`, sem keep-alive — parser simplificado). Inclui remover `react-native-http-bridge-refurbished` das dependências e conectar as funções de `apiSetup.ts` na inicialização real do app.
  *Pronto quando:* app inicia o servidor num emulador/dispositivo real sem erro; `GET /api/session`, `GET /api/files`, `GET /api/files/:id/download`, `POST /api/upload` e `GET /api/events` respondem a requisição HTTP real (não mock) na rede local; teste de memória com arquivo grande simulado (chunks) cobrindo o novo transporte, não só o parser.

## Fase 5 — Interface Web (`web-ui/`)

- [x] **T-501 · Página base autocontida** ⬅ T-401
  HTML/CSS/JS único, sem CDN, responsivo ≥ 320 px, tema claro/escuro, exibe `sessionId` (HU-03); empacotamento como asset servido em `GET /`.
  *Pronto quando:* página abre de outro dispositivo real na rede.

- [x] **T-502 · Upload na web-ui** ⬅ T-501, T-403
  Seleção múltipla + drag-and-drop, fila sequencial, barra de progresso individual (XHR `upload.onprogress`), mensagens específicas por erro (`413/422/507`), "Tentar novamente" só para não concluídos (HU-04).
  *Pronto quando:* critérios de aceite "Upload — progresso" e "Upload — erros" atendidos.

- [x] **T-503 · Download + polling na web-ui** ⬅ T-501, T-402, T-404
  Lista de arquivos com atualização a cada 3 s; download nativo; banner "Servidor desconectado" após 2 falhas de polling, some ao reconectar (HU-05).
  *Pronto quando:* critérios de aceite "Download" e "Servidor desconectado" atendidos.

## Fase 6 — Transferências em Tempo Real (app host)

- [x] **T-601 · Store de transferências** ⬅ T-103 **[P]**
  Tipos `Transfer` + store Zustand: fila, progresso, velocidade (média móvel), transições de status, `cancelled` ao parar servidor.
  *Pronto quando:* toda a lógica de agregação testada com relógio mockado.

- [x] **T-602 · Instrumentação das rotas** ⬅ T-601, T-402, T-403
  Upload/download reportam progresso ao store (mín. a cada 500 ms) sem bloquear a transferência.
  *Pronto quando:* testes garantem emissão de progresso e não-bloqueio (throttle testado).

- [x] **T-603 · Tela Transferências** ⬅ T-601, T-005
  Lista em tempo real (direção, nome, %, velocidade, IP do peer), skeleton de loading, estado vazio ilustrado, item `failed` com mensagem (HU-07).
  *Pronto quando:* critérios de aceite "Tela Transferências" atendidos.

## Fase 7 — Integração e Endurecimento

- [ ] **T-701 · Teste de fogo E2E manual** ⬅ todas as anteriores
  Roteiro: Android host ↔ iOS convidado e vice-versa; arquivo ≥ 1 GB nas duas direções sem crash de memória; parar servidor no meio da transferência → `cancelled` correto; nomes com acento/emoji.
  *Pronto quando:* roteiro executado e registrado em `docs/testes-manuais.md`.

- [ ] **T-702 · Auditoria de conformidade final** ⬅ T-701
  Rodar o agente `validador` sobre o projeto inteiro: cobertura ≥ mínimos, zero `any`, boundaries respeitados, todos os critérios de aceite da spec marcados.
  *Pronto quando:* relatório do validador sem pendências.

## Fase 8 — Melhorias pós-teste manual (achados de T-701)

- [ ] **T-801 · Compartilhar por pasta sem duplicar (SAF)** ⬅ T-302
  Botão "Vincular pasta" (convive com o document picker avulso existente): `StorageAccessFramework.requestDirectoryPermissionsAsync()` + `readDirectoryAsync()` listam o conteúdo da pasta escolhida. O toggle habilitar/desabilitar é **da funcionalidade como um todo** (compartilhar a pasta vinculada), não por arquivo individual — liga/desliga a exposição de toda a pasta de uma vez; a funcionalidade só tem efeito com o servidor ativo (com o servidor parado, o toggle fica desabilitado/indica que é preciso iniciar o servidor). Diferente do fluxo atual, o arquivo NÃO é copiado para a sandbox — `FileRepository.linkFromUri()` grava uma entrada com `localUri` apontando pro arquivo original (`linked: true`); desabilitar o compartilhamento da pasta nunca apaga os arquivos reais do usuário, só desvincula. Cada item da lista mostra thumbnail do arquivo quando possível (imagens/vídeos) ou um ícone padrão por tipo quando não for possível gerar thumbnail. A pasta escolhida é lembrada entre reinícios do app. A rota de download nunca serve um stream truncado/parcial silenciosamente: falha ao ler o arquivo vinculado (`localUri` externo) retorna erro explícito no `apiErrorSchema`.
  *Pronto quando:* com o servidor ativo, arquivos de uma pasta vinculada e habilitada aparecem em "Baixar arquivos" do convidado e baixam corretamente sem nunca terem sido duplicados no armazenamento do host, com o hash (SHA-256) do arquivo baixado pelo convidado idêntico ao do arquivo original vinculado (teste automatizado compara os hashes); desabilitar o toggle da pasta remove todos os seus arquivos da lista exposta sem apagar os arquivos originais; toggle fica indisponível/orienta iniciar o servidor quando ele está parado; lista exibe thumbnail quando possível e ícone padrão como fallback; testes cobrindo permissão negada, toggle nos dois sentidos, comportamento com servidor parado e erro explícito em leitura falha/parcial do arquivo vinculado.

- [ ] **T-802 · Local de recebidos configurável (SAF)** ⬅ T-301, T-405
  Tela/seção de configurações para escolher, via SAF, uma pasta externa onde os arquivos recebidos (`origin: 'received'`) devem ser salvos. O upload continua sendo escrito via streaming incremental no arquivo temporário da sandbox (**sem mudança** — API de SAF não suporta append, então mudar isso reintroduziria o problema de memória que a T-405 resolveu); só ao finalizar (`finish()`), se houver pasta configurada, o arquivo completo é movido para lá via cópia nativa arquivo-a-arquivo (`moveAsync`/`copyAsync`, nunca lendo o conteúdo pra uma string JS). Após o move, o hash (SHA-256) do arquivo na pasta configurada é comparado com o hash do arquivo recebido antes do move; se não conferir, a operação retorna erro explícito ao usuário (o arquivo recebido NÃO é apagado da sandbox, a transferência não é dada como concluída com sucesso). Sem pasta configurada, comportamento atual é mantido (fica em `received/` da sandbox).
  *Pronto quando:* upload de arquivo ≥ 1 GB com pasta configurada não estoura memória (streaming preservado) e o arquivo final aparece na pasta escolhida, achável pelo gerenciador de arquivos do celular, com hash SHA-256 idêntico ao do arquivo recebido antes do move; mismatch de hash simulado em teste gera erro explícito (arquivo original preservado na sandbox, usuário informado da falha) em vez de sucesso silencioso; sem pasta configurada, nada muda.

- [ ] **T-803 · Ajustes visuais diversos (achados de revisão de screenshots)** ⬅ T-204, T-603, T-302
  Corrige 4 bugs visuais encontrados em revisão de screenshots do app em uso (tema claro e escuro): (1) no tema claro, a status bar (área superior/notch) renderiza texto e ícones em branco sobre fundo branco, ilegível — a cor de conteúdo da status bar (`expo-status-bar`, `style`/`barStyle`) precisa reagir ao tema ativo em vez de fixa; (2) o modal de "Transferências" (popup introduzido na T-701/PR#56) invade e sobrepõe a área não clicável do sistema (status bar/notch) em vez de respeitar a safe area no topo; (3) na tela Servidor há dois espaçamentos indevidos cortando texto — um empurra/corta o título "Servidor" contra a status bar no topo, outro corta o botão "Parar servidor" contra a tab bar inferior; (4) o toast/snackbar de erro (ex.: falha ao selecionar arquivo na tela Compartilhados) renderiza sem o texto da mensagem — aparece com o ícone de alerta e o botão de fechar colados nas bordas laterais, sem padding nem o texto entre eles. Inclui também renomear o texto do header e do label do botão/aba "Servidor" para "Início" (a tela e a rota continuam sendo a mesma, só muda o texto exibido).
  *Pronto quando:* nos dois temas, status bar mantém contraste legível (ícones/texto escuros no tema claro, claros no escuro); modal de Transferências respeita a safe area e não sobrepõe status bar/notch; título e botão da tab bar exibem "Início" em vez de "Servidor" em todos os lugares onde o texto aparecia (header, aba inferior); nenhum desses elementos é cortado pela status bar/tab bar em nenhum tema; toast exibe o texto da mensagem de erro com padding correto entre ícone, texto e botão de fechar; validado visualmente em dispositivo real nos dois temas.

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
Fase 8: T-801 · T-802 · T-803   (achados de T-701, paralelizáveis entre si)
```

> **Maior risco:** T-202 (streaming da lib de servidor) — decisão finalizada (ver ADR-001). T-206 removida (rev. 1.2, ver ADR-002).
