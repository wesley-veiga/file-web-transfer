# Tarefas — Transferir Arquivos

**Derivado de:** [transferir.md](transferir.md) · **Regido por:** [constitution.md](constitution.md)
**Revisão 1.14 (2026-09-15):** nova **T-914** — em teste real no emulador Android (a pedido do usuário, que reportou a seção "Local de Recebidos" fechando sozinha ao clicar em "Escolher Pasta"), achado que o fechamento acontecia incondicionalmente após qualquer tentativa de seleção/limpeza de pasta (sucesso, cancelamento OU erro) por um `onConfigured?.()` chamado sem checar o resultado — corrigido para só fechar em sucesso real, restaurando o contrato já documentado no próprio componente. Ver T-914 para detalhes.
**Revisão 1.13 (2026-09-15):** nova **T-913** — em teste real no emulador Android (a pedido do usuário, que reportou o app não aparecer no menu de compartilhar do SO), achados três bugs reais em `plugins/withShareIntent.js` e `plugins/withShareIntentPayload.js` (T-901/T-903), nenhum pego pelos testes de unidade porque os mocks reproduziam os mesmos erros em vez de validar contra o schema real do Expo/Android — corrigidos e validados empiricamente (ver T-913 para detalhes). Também corrigido nesta revisão: checkbox da **T-902** estava `[ ]` por esquecimento — a tarefa foi de fato implementada e mesclada junto com o restante da Fase 9 (confirmado por inspeção de código: `ServerInfo.token`/`mode` presentes, sem resquício de `sessionId`).
**Revisão 1.12 (2026-09-12):** Fase 9 concluída — todas as tarefas T-901–T-912 implementadas, testadas e aprovadas pelo `validador`, mescladas em `develop`. O pivô de usabilidade (rev. 1.10/2.0) está totalmente em produção: navegação por abas antiga (Home/Servidor, Compartilhados, Recebidos, Transferências) removida pela T-912 junto com as telas descontinuadas (T-204, T-302, T-303, T-603) e um componente órfão (`FileItemThumbnail`, achado durante a limpeza da T-912 por derrubar a cobertura de branches abaixo do threshold). App agora opera nos dois fluxos únicos — Enviar (T-903/T-904) e Receber (T-905/T-906) — com token como controle de acesso real (T-902/T-908) e a web-ui renderizando por modo com confirmação de token (T-909/T-910). Pendências conhecidas fora desta fase: T-701 (teste de fogo manual, exige dispositivo Android real), T-702 (auditoria final, depende de T-701), T-806/T-809 (investigação de performance de upload, também exige dispositivo real para profiling).
**Revisão 1.11 (2026-09-12):** decisão de produto — compatibilidade restrita definitivamente ao **Android**; suporte a iOS removido do escopo (deixa de ser uma decisão pendente da T-901). T-901 reescrita para focar só em share intent Android; T-701 ajustada (roteiro de teste de fogo não depende mais de dispositivo iOS); nota de risco da Fase 9 atualizada. Nenhuma tarefa já concluída/mesclada foi reaberta ou teve o texto histórico alterado — a mudança afeta apenas trabalho ainda não iniciado. Ver `transferir.md` rev. 2.1.0.
**Revisão 1.10 (2026-09-11):** pivô de produto — a usabilidade do app é substituída por dois fluxos únicos disparados por evento (**Enviar**, aberto automaticamente ao compartilhar arquivo(s) pelo menu do SO; **Receber**, aberto ao tocar num botão na Home), pareados por token/QR Code. O token deixa de ser cosmético (como o antigo `sessionId`) e passa a ser controle de acesso real, validado pela API. Reaproveita os módulos de servidor/transferência/arquivos das Fases 0–8; a navegação por abas (Home/Servidor, Compartilhados, Recebidos, Transferências) é descontinuada. **T-204, T-302, T-303, T-603** e a UI de vínculo de pasta da **T-801** têm o título riscado abaixo — foram de fato concluídas e mescladas em sua época, só deixam de ser reaproveitadas por esta mudança de direção (checkbox mantido `[x]`, nada foi desfeito retroativamente); a técnica de acesso sem cópia da T-801 (`linkFromUri`) permanece em uso via nova T-903. **T-802** continua totalmente válida, apenas ganha uma tarefa (T-911) para reancorar seu ponto de entrada na navegação nova. Nova **Fase 9** (T-901–T-912) detalha a implementação, como continuação deste documento. Ver `transferir.md` rev. 2.0.0 para a spec completa da mudança.
**Revisão 1.9 (2026-09-01):** T-808 aprovada com ressalva e mesclada — `useAppLifecycle.ts` não derruba mais o servidor Android ao sair de foreground quando o foreground service da T-807 está ativo. Duas pendências de validação manual em dispositivo físico registradas no item (ver nota na T-808), fora do alcance deste ambiente.
**Revisão 1.8 (2026-09-01):** T-805 e T-807 aprovadas e mescladas (T-807 com ressalva registrada no próprio item). T-806 reprovada no critério de performance mas mesclada mesmo assim pelo código seguro/testável entregue — permanece `[ ]`, ver nota no item. Duas novas tarefas: **T-808** (decisão de produto — parar de derrubar o servidor ao sair de foreground, contando com o foreground service da T-807 para proteção) e **T-809** (investigar o gargalo real de performance do upload, provavelmente no round-trip base64 da bridge nativa, não no loop que a T-806 já investigou e descartou).
**Revisão 1.7 (2026-09-01):** T-804 mesclada e concluída. Novos achados em uso real, mesmo dia: (1) o mesmo padrão de OOM da T-804 existe também na verificação de hash pós-upload (`moveReceivedFileToConfiguredFolder`, T-802) — nova T-805; (2) a UI trava e a transferência fica lenta durante upload por causa de um loop manual de conversão de bytes na thread JS (`appendToFileAsync`) — nova T-806; (3) o servidor desconecta ao vincular pasta com muitos arquivos — causa raiz dupla: listagem sequencial em `folderSharingService.ts` e, mais grave, ausência de foreground service Android de verdade protegendo o processo em segundo plano — nova T-807 (a mais arquitetural das três, requer Expo config plugin já que `android/` não é versionado).
**Revisão 1.6 (2026-09-01):** achado em uso real (dispositivo físico) — download de arquivo de 41MB de uma pasta compartilhada causa `OutOfMemoryError`. A rota `GET /api/files/:id/download` nunca teve streaming de verdade, apesar do critério de pronto da T-402 mencionar isso; T-405 só resolveu streaming de upload. Nova T-804 na Fase 8 registra a correção.
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

- [x] ~~**T-204 · Tela Home/Servidor**~~ ⬅ T-203, T-005, T-104
  UI dos estados `idle/starting/running/error` (HU-01, HU-02): botão iniciar/parar, spinner, URL + QR Code + sessionId, mensagens por `ServerErrorCode`, confirmação ao parar com transferências ativas. Estado `idle` sem rede exibe a ação "Criar rede" (fluxo completo na T-208).
  *Pronto quando:* critérios de aceite "Tela Home / Servidor" da spec todos atendidos, com testes de componente por estado.
  **Nota (rev. 1.2):** ação "Criar rede" removida por T-209 (T-208 cancelada) — descrição acima é histórica.
  **Descontinuada (rev. 1.10, 2026-09-11):** UI substituída pela Home idle (T-905) e pelas telas Enviar/Receber (T-904/T-906) do pivô de usabilidade — ver Fase 9. Código removido de fato pela T-912.

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

- [x] ~~**T-302 · Compartilhar arquivos do host**~~ ⬅ T-301, T-005
  Document picker, lista "Compartilhados" com remoção (HU-06); store da feature.
  *Pronto quando:* critérios de aceite "Tela Arquivos Compartilhados" atendidos (exceto o item de 3 s, que depende de T-503).
  **Descontinuada (rev. 1.10, 2026-09-11):** curadoria manual via picker + aba "Compartilhados" substituída pelo recebimento automático de arquivo(s) via compartilhamento do SO (T-903) — ver Fase 9. Código removido de fato pela T-912.

- [x] ~~**T-303 · Aba Recebidos + abrir/compartilhar**~~ ⬅ T-301, T-005
  Lista de recebidos com share sheet do SO (parte da HU-07).
  *Pronto quando:* abrir e compartilhar funcionam nos dois SOs.
  **Descontinuada (rev. 1.10, 2026-09-11):** aba dedicada substituída pela ação inline "Abrir/Compartilhar" na tela Receber (T-906) — ver Fase 9. Código removido de fato pela T-912.

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

- [x] ~~**T-603 · Tela Transferências**~~ ⬅ T-601, T-005
  Lista em tempo real (direção, nome, %, velocidade, IP do peer), skeleton de loading, estado vazio ilustrado, item `failed` com mensagem (HU-07).
  *Pronto quando:* critérios de aceite "Tela Transferências" atendidos.
  **Descontinuada (rev. 1.10, 2026-09-11):** tela/aba dedicada removida — progresso passa a aparecer embutido nas telas Enviar (T-904) e Receber (T-906) — ver Fase 9. Código removido de fato pela T-912.

## Fase 7 — Integração e Endurecimento

- [ ] **T-701 · Teste de fogo E2E manual** ⬅ todas as anteriores
  Roteiro: app host em Android, convidado acessando via navegador (qualquer dispositivo/plataforma, já que o convidado usa a `web-ui`, não o app nativo); arquivo ≥ 1 GB nas duas direções sem crash de memória; parar servidor no meio da transferência → `cancelled` correto; nomes com acento/emoji.
  *Pronto quando:* roteiro executado e registrado em `docs/testes-manuais.md`.
  **Nota (rev. 1.11, 2026-09-12):** roteiro original citava "iOS convidado" — removido; o app é Android-only (ver `transferir.md` rev. 2.1), o papel de convidado sempre foi via navegador, não via app nativo em outra plataforma.

- [ ] **T-702 · Auditoria de conformidade final** ⬅ T-701
  Rodar o agente `validador` sobre o projeto inteiro: cobertura ≥ mínimos, zero `any`, boundaries respeitados, todos os critérios de aceite da spec marcados.
  *Pronto quando:* relatório do validador sem pendências.

## Fase 8 — Melhorias pós-teste manual (achados de T-701)

- [x] ~~**T-801 · Compartilhar por pasta sem duplicar (SAF)**~~ ⬅ T-302
  Botão "Vincular pasta" (convive com o document picker avulso existente): `StorageAccessFramework.requestDirectoryPermissionsAsync()` + `readDirectoryAsync()` listam o conteúdo da pasta escolhida. O toggle habilitar/desabilitar é **da funcionalidade como um todo** (compartilhar a pasta vinculada), não por arquivo individual — liga/desliga a exposição de toda a pasta de uma vez; a funcionalidade só tem efeito com o servidor ativo (com o servidor parado, o toggle fica desabilitado/indica que é preciso iniciar o servidor). Diferente do fluxo atual, o arquivo NÃO é copiado para a sandbox — `FileRepository.linkFromUri()` grava uma entrada com `localUri` apontando pro arquivo original (`linked: true`); desabilitar o compartilhamento da pasta nunca apaga os arquivos reais do usuário, só desvincula. Cada item da lista mostra thumbnail do arquivo quando possível (imagens/vídeos) ou um ícone padrão por tipo quando não for possível gerar thumbnail. A pasta escolhida é lembrada entre reinícios do app. A rota de download nunca serve um stream truncado/parcial silenciosamente: falha ao ler o arquivo vinculado (`localUri` externo) retorna erro explícito no `apiErrorSchema`.
  *Pronto quando:* com o servidor ativo, arquivos de uma pasta vinculada e habilitada aparecem em "Baixar arquivos" do convidado e baixam corretamente sem nunca terem sido duplicados no armazenamento do host, com o hash (SHA-256) do arquivo baixado pelo convidado idêntico ao do arquivo original vinculado (teste automatizado compara os hashes); desabilitar o toggle da pasta remove todos os seus arquivos da lista exposta sem apagar os arquivos originais; toggle fica indisponível/orienta iniciar o servidor quando ele está parado; lista exibe thumbnail quando possível e ícone padrão como fallback; testes cobrindo permissão negada, toggle nos dois sentidos, comportamento com servidor parado e erro explícito em leitura falha/parcial do arquivo vinculado.
  **Descontinuada (rev. 1.10, 2026-09-11):** o toggle de "vincular pasta" e a aba "Compartilhados" que o hospedava somem com o pivô de usabilidade (ver T-302). A técnica de acesso sem cópia (`FileRepository.linkFromUri`, `linked: true`) continua em uso — é reaproveitada pela nova T-903 para lidar com arquivo(s) recebidos via compartilhamento do SO. Código de UI removido de fato pela T-912.

- [x] **T-802 · Local de recebidos configurável (SAF)** ⬅ T-301, T-405
  Tela/seção de configurações para escolher, via SAF, uma pasta externa onde os arquivos recebidos (`origin: 'received'`) devem ser salvos. O upload continua sendo escrito via streaming incremental no arquivo temporário da sandbox (**sem mudança** — API de SAF não suporta append, então mudar isso reintroduziria o problema de memória que a T-405 resolveu); só ao finalizar (`finish()`), se houver pasta configurada, o arquivo completo é copiado para lá via cópia nativa arquivo-a-arquivo (`copyAsync`, nunca lendo o conteúdo pra uma string JS além do necessário pro hash — **nunca `moveAsync`**, de propósito: o original só é apagado da sandbox depois de confirmado o hash da cópia, para nunca ficar num estado sem nenhuma cópia íntegra do arquivo). Após a cópia, o hash (SHA-256) do arquivo na pasta configurada é comparado com o hash do arquivo recebido antes do move; se não conferir, a cópia corrompida é descartada, o original permanece intacto na sandbox, e a operação retorna erro explícito ao usuário (a transferência não é dada como concluída com sucesso). Sem pasta configurada, comportamento atual é mantido (fica em `received/` da sandbox).
  *Pronto quando:* upload de arquivo ≥ 1 GB com pasta configurada não estoura memória (streaming preservado) e o arquivo final aparece na pasta escolhida, achável pelo gerenciador de arquivos do celular, com hash SHA-256 idêntico ao do arquivo recebido antes do move; mismatch de hash simulado em teste gera erro explícito (arquivo original preservado na sandbox, usuário informado da falha) em vez de sucesso silencioso; sem pasta configurada, nada muda.
  **Nota (rev. 1.10, 2026-09-11):** a funcionalidade continua totalmente válida, mas seu ponto de entrada na UI dependia da Home/Servidor (T-204), descontinuada pelo pivô de usabilidade — ver T-911 na Fase 9 para reancorar o acesso a esta configuração na navegação nova.

- [x] **T-803 · Ajustes visuais diversos (achados de revisão de screenshots)** ⬅ T-204, T-603, T-302
  Corrige 4 bugs visuais encontrados em revisão de screenshots do app em uso (tema claro e escuro): (1) no tema claro, a status bar (área superior/notch) renderiza texto e ícones em branco sobre fundo branco, ilegível — a cor de conteúdo da status bar (`expo-status-bar`, `style`/`barStyle`) precisa reagir ao tema ativo em vez de fixa; (2) o modal de "Transferências" (popup introduzido na T-701/PR#56) invade e sobrepõe a área não clicável do sistema (status bar/notch) em vez de respeitar a safe area no topo; (3) na tela Servidor há dois espaçamentos indevidos cortando texto — um empurra/corta o título "Servidor" contra a status bar no topo, outro corta o botão "Parar servidor" contra a tab bar inferior; (4) o que parecia um toast/snackbar de erro sem texto (ex.: falha ao selecionar arquivo na tela Compartilhados) — investigação mostrou que não era um componente de toast do app (não existia nenhum); era o **LogBox nativo do React Native** disparado por `console.error` sem tratamento de UI nos `catch` do carregamento inicial da tela — corrigido com `Alert.alert` nesses pontos, não com um componente de toast novo. Inclui também renomear o texto do header e do label do botão/aba "Servidor" para "Início" (a tela e a rota continuam sendo a mesma, só muda o texto exibido).
  *Pronto quando:* nos dois temas, status bar mantém contraste legível (ícones/texto escuros no tema claro, claros no escuro); modal de Transferências respeita a safe area e não sobrepõe status bar/notch; título e botão da tab bar exibem "Início" em vez de "Servidor" em todos os lugares onde o texto aparecia (header, aba inferior); nenhum desses elementos é cortado pela status bar/tab bar em nenhum tema; toast exibe o texto da mensagem de erro com padding correto entre ícone, texto e botão de fechar; validado visualmente em dispositivo real nos dois temas.

- [x] **T-804 · Streaming real no download de arquivo (corrige OOM em arquivo grande)** ⬅ T-402, T-405
  Achado em uso real (dispositivo físico): baixar um arquivo de 41MB de uma pasta compartilhada derruba o app com `OutOfMemoryError` no Android. Causa raiz: `handleDownloadFile` (`src/bootstrap/apiSetup.ts`) lê o arquivo inteiro de uma vez com `fsModule.readAsStringAsync(uri, { encoding: 'base64' })` e converte para `Buffer` — mantém simultaneamente em memória a string base64 (~1,37× o tamanho do arquivo) e o `Buffer` decodificado, um padrão que não escala com o tamanho do arquivo. O critério de pronto da T-402 dizia "download com streaming", mas isso nunca foi implementado de fato — só o upload (T-403/T-405) ficou realmente incremental; o próprio código documenta essa lacuna deliberada ("sem streaming real — ver T-405"), que se mostrou um problema real em uso, não só teórico. Corrigir isso exige mudança em duas camadas: (1) `HttpModule`/`nativeHttpModule.ts` (`src/features/server/services/`) — estender `HttpServerResponse.body` para aceitar também uma fonte de bytes entregue em pedaços (ex.: gerador assíncrono de `Buffer`s com tamanho total conhecido, usado para `Content-Length`), e fazer `writeResponse` escrever cada pedaço em sequência no socket respeitando o mesmo padrão de backpressure/confirmação (`'written'`/callback) já usado hoje entre head e body — nunca destruir o socket antes do último pedaço confirmado; (2) `handleDownloadFile` (`apiSetup.ts`) — trocar a leitura de string única por leitura em blocos do arquivo (ex.: `readAsStringAsync` com `position`/`length`, decodificando cada bloco de base64 para `Buffer` isoladamente) e entregar isso como a nova fonte streamable, preservando os headers atuais (`Content-Type`, `Content-Length`, `Content-Disposition`) e o tratamento de erro de leitura de arquivo vinculado (T-801, `LINKED_FILE_READ_ERROR`) — inclusive quando a falha ocorre a meio do streaming, não só no início.
  *Pronto quando:* download de um arquivo grande (cenário de teste: arquivo ≥ 100MB, ou reprodução do caso real de 41MB em dispositivo físico com heap limitado) completa sem `OutOfMemoryError` e sem pico de memória proporcional ao tamanho total do arquivo (memória usada por request fica limitada ao tamanho de um bloco, não do arquivo inteiro); o arquivo baixado continua byte-a-byte idêntico ao original (hash SHA-256 confere, preservando a correção de corrupção binária de T-701); falha de leitura no meio do streaming de um arquivo vinculado ainda produz erro explícito (nunca stream truncado silencioso, requisito já coberto em T-801) em vez de resposta corrompida/incompleta sem aviso; testes cobrindo leitura em blocos do arquivo e escrita em múltiplos pedaços no socket (não só o caminho de um único chunk).

- [x] **T-805 · OOM ao verificar integridade no upload (hash de arquivo grande)** ⬅ T-801, T-802, T-804
  Mesmo padrão de bug da T-804, achado em uso real num local diferente: `FileRepositoryImpl#moveReceivedFileToConfiguredFolder` (`src/features/files/services/fileRepository.ts`, linhas ~703-729) lê o arquivo **inteiro, duas vezes** (original na sandbox + cópia no destino SAF) com `readAsStringAsync(uri, { encoding: 'base64' })` só para calcular hash SHA-256 de verificação de integridade (requisito da T-802). Erro real capturado: `OutOfMemoryError` ao mover um vídeo recebido para a pasta configurada. Corrigir exige hash **incremental/streaming**: ler o arquivo em blocos (mesmo padrão de `DOWNLOAD_CHUNK_BYTES`/`position`+`length` já usado em `handleDownloadFile`, T-804) e alimentar cada bloco a um cálculo de SHA-256 incremental, sem nunca materializar o arquivo inteiro em memória de uma vez — nem como string base64, nem como Buffer. Ponto de atenção: `expo-crypto` (`src/shared/lib/hashUtils.ts`, função `hashSha256`) só expõe `Crypto.digestStringAsync`, um digest "de uma vez só" (sem `.update()`/estado incremental) — não dá para simplesmente trocar a leitura e continuar chamando essa função por bloco (cada chamada geraria um hash independente, não um hash cumulativo do arquivo inteiro). É necessário decidir e implementar uma forma de SHA-256 incremental (ex.: implementação pura em JS com API de `update()`/`digest()` por bloco, ou avaliar se há alguma forma de compor digests parciais que ainda produza o SHA-256 correto do arquivo completo — não é apenas concatenar hashes de blocos, isso não é criptograficamente equivalente ao hash do arquivo inteiro). Documente a decisão tomada e o porquê. Isso deve virar uma função/utilitário reaproveitável em `hashUtils.ts` (não uma solução ad-hoc só dentro de `fileRepository.ts`), já que o mesmo padrão (verificar integridade sem carregar tudo em memória) pode ser útil em outros pontos no futuro.
  *Pronto quando:* mover um arquivo grande (≥ 100MB, ou reprodução do caso real) para a pasta configurada não causa `OutOfMemoryError` nem pico de memória proporcional ao tamanho do arquivo; o hash calculado de forma incremental é **idêntico** ao hash que a implementação anterior (não incremental) produziria para o mesmo conteúdo (teste comparando os dois resultados para arquivos pequenos/médios, onde calcular dos dois jeitos ainda é viável); mismatch de hash simulado ainda é detectado corretamente (comportamento da T-802 — cópia corrompida descartada, original preservado, erro explícito ao usuário — continua funcionando); testes cobrindo hash de arquivo maior que um bloco (múltiplas chamadas de `update()`/equivalente).

- [ ] **T-806 · Loop de conversão de bytes trava a UI e deixa a transferência lenta** ⬅ T-403, T-405
  Achado em uso real: durante upload, a UI do app trava (perceptível ao usuário) e a transferência é visivelmente lenta. Causa raiz: `appendToFileAsync` (`src/features/files/services/fileRepositoryFactory.ts`, linhas ~79-86), chamada uma vez por chunk de upload recebido, converte a string binária (latin1, um char = um byte, vinda de `chunk.toString('binary')` em `nativeHttpModule.ts`) para `Uint8Array` com um **loop manual em JavaScript, byte a byte** (`for (let i = 0; i < content.length; i++) bytes[i] = content.charCodeAt(i) & 0xff`). Para um arquivo grande isso significa centenas de milhões (ou bilhões) de iterações rodando de forma síncrona na mesma thread JS que processa eventos do socket **e** re-renderiza a UI React — daí os dois sintomas ao mesmo tempo (lentidão + UI travada), não são dois bugs separados, são o mesmo. Corrigir: substituir o loop manual por uma conversão em lote mais eficiente (ex.: `Buffer.from(content, 'latin1')`, já que `buffer` já é dependência do projeto — usada em outros pontos como `nativeHttpModule.ts`/`apiSetup.ts`) e medir se isso já é suficiente. Se o ganho não for suficiente, avaliar (com o usuário, antes de embarcar numa reescrita grande) se vale a pena eliminar de vez o round-trip `Buffer` (socket) → `string` (`chunk.toString('binary')`) → `Uint8Array` (`appendToFileAsync`), fazendo `nativeHttpModule.ts` entregar os bytes crus e o `multipartStreamParser` (`src/shared/lib/multipartStreamParser.ts`) trabalhar diretamente sobre `Buffer` em vez de `string` para localizar os boundaries — mudança maior, mais arriscada, e fora do escopo mínimo desta tarefa a menos que a conversão em lote sozinha não resolva o problema de forma satisfatória.
  *Pronto quando:* upload de um arquivo grande (≥ 200MB, medido em dispositivo real ou emulador com throttling de CPU comparável) completa em tempo sensivelmente menor que antes da correção (medir antes/depois, registrar os números no PR); a UI do app permanece responsiva durante o upload (ex.: um indicador de progresso/animação continua atualizando, sem congelamentos perceptíveis de vários segundos); conteúdo do arquivo recebido continua byte-a-byte idêntico ao original (hash SHA-256 confere, preservando a correção de corrupção binária de T-701); testes cobrindo a nova função de conversão com dados binários reais (bytes ≥ 0x80, não só ASCII).
  **Resultado (REPROVADA pelo validador, mesclada mesmo assim — rev. 1.8):** o loop foi extraído para `binaryStringToBytes` (`shared/lib`), testável e com cobertura completa (bytes ≥ 0x80 inclusive), mas **sem ganho de performance** — a troca sugerida acima (`Buffer.from(latin1)`) foi medida e é 7-9x **mais lenta** que o loop manual com o polyfill `buffer` real do projeto (benchmark documentado no código), então não foi aplicada. O critério de pronto sobre performance/UI responsiva não foi atendido; o código foi mesclado por ser seguro e sem regressão, mas a tarefa em si continua em aberto até o ganho real ser entregue. Ver T-809 (nova tarefa) para investigar o gargalo real, identificado como provável round-trip base64 pela bridge nativa do socket (`nativeHttpModule.ts`), não o loop de conversão em si.

- [x] **T-807 · Servidor não sobrevive a operações longas em segundo plano (sem foreground service real) + listagem de pasta lenta** ⬅ T-203, T-405, T-801
  Achado em uso real: ao vincular uma pasta com muitos arquivos ("Vincular pasta", T-801), o servidor desconecta. Duas causas raiz combinadas: **(a)** `listFolderFiles` (`src/features/files/services/folderSharingService.ts`, linhas ~127-153) chama `getInfoAsync` **sequencialmente, um arquivo de cada vez** (`for...of` com `await` dentro do loop) para cada arquivo da pasta escolhida via SAF — numa pasta com centenas/milhares de arquivos, isso demora muito tempo, mantendo o app numa operação longa; **(b)** mais grave e mais geral: o servidor HTTP (`react-native-tcp-socket`, iniciado por `ServerService`) roda inteiramente dentro do processo do app **sem nenhuma proteção de foreground service do Android** — confirmado que não existe `<service>` nem a permissão `FOREGROUND_SERVICE`/`FOREGROUND_SERVICE_DATA_SYNC` no manifest gerado, e a notificação "persistente" existente (`notificationService.ts`) é uma notificação local comum, **não** um foreground service de verdade (não chama `startForeground()`, não impede o Android de matar o processo). Enquanto o app fica em segundo plano por tempo suficiente (ex.: durante o picker do sistema operacional, ou qualquer operação longa como a listagem de (a)), o Android pode matar o processo a qualquer momento e o servidor cai junto — isso pode se repetir em qualquer cenário de app em background, não só ao escolher pasta. **Restrição importante de implementação:** a pasta `android/` deste repositório é **gerada via `expo prebuild`** e está no `.gitignore` (não versionada) — qualquer mudança nativa (novo `<service>`, permissões no manifest, código nativo Kotlin/Java) **não pode** ser feita editando `android/` diretamente (seria perdida no próximo prebuild); precisa ser implementada como um **Expo config plugin** (`@expo/config-plugins`, já disponível via `expo`) registrado em `app.json` (`expo.plugins`), do jeito que os plugins existentes (`expo-splash-screen`, etc.) já fazem. Pesquisar se alguma lib compatível com Expo SDK 57 (managed/config-plugin, não bare puro) já resolve foreground service Android de forma pronta antes de escrever um plugin do zero; se nenhuma servir, implementar o plugin customizado necessário (permissões, declaração do `<service>`, `startForeground()` amarrado ao início/fim do `ServerService`). Documentar a decisão tomada (lib escolhida vs. plugin customizado) e por quê.
  *Pronto quando:* `listFolderFiles` lista uma pasta com muitos arquivos (ex.: simular centenas de entradas em teste) num tempo compatível com paralelização real (não mais um `getInfoAsync` estritamente sequencial por arquivo — testável observando que múltiplas chamadas ficam pendentes ao mesmo tempo, não uma de cada vez); item problemático isolado continua sendo ignorado sem derrubar a listagem inteira (comportamento já existente, não pode regredir); com o servidor ativo, o app sobrevive a pelo menos alguns minutos em segundo plano (aparelho real, tela apagada/app minimizado) sem o processo ser encerrado pelo Android — validado manualmente em dispositivo físico, já que isso não é testável de forma confiável em teste unitário; permissão de foreground service (`FOREGROUND_SERVICE`, `FOREGROUND_SERVICE_DATA_SYNC` conforme aplicável a Android 14+, ver `AGENTS.md`) e a declaração do serviço aparecem no `AndroidManifest.xml` **gerado** após `expo prebuild` (prova de que vêm do plugin, não de edição manual); iniciar/parar o servidor (`ServerService`) inicia/encerra o foreground service correspondente; notificação persistente continua visível e correta enquanto o foreground service está ativo.
  **Ressalva (APROVADA pelo validador com ressalva — rev. 1.8):** o foreground service em si está implementado e verificado (manifest/serviço confirmados via `expo prebuild` real, Kotlin revisado). Porém `useAppLifecycle.ts` já para o servidor **de propósito** assim que o app sai de foreground (comportamento pré-existente de T-205) — inclusive durante o próprio picker de pasta do sistema, o cenário que motivou esta tarefa. Isso significa que a proteção do foreground service, sozinha, não resolve o "servidor desconecta" relatado pelo usuário enquanto esse stop deliberado continuar ativo. Decisão de produto não resolvida aqui de propósito — ver T-808 (nova tarefa).

- [x] **T-808 · Servidor deve continuar rodando em segundo plano, protegido pelo foreground service** ⬅ T-807
  Decisão de produto decorrente da ressalva da T-807: `useAppLifecycle.ts` (`handleAppStateChange`) para o servidor **proativamente** assim que o `AppState` sai de `active` — comportamento original da T-205, escrito numa época em que a única proteção existente era uma notificação comum (sem foreground service real), então parar era a leitura mais segura possível do Princípio VI ("servidor roda apenas em primeiro plano OU com notificação persistente explícita"). Agora que a T-807 implementou um foreground service Android de verdade (`startForeground()` real, processo protegido), a leitura do Princípio VI muda: a notificação persistente passa a ser uma proteção genuína, não cosmética, o que abre espaço pra manter o servidor ativo em segundo plano em vez de derrubá-lo no instante em que o app perde foreground. Ajustar `useAppLifecycle.ts` para: no Android, com o foreground service ativo, **não** parar o servidor só por sair de foreground — continuar rodando protegido pelo foreground service + notificação persistente; manter o comportamento de parar o servidor ao fechar/matar o app de verdade (isso continua correto e necessário). Avaliar se iOS precisa de tratamento diferente (não tem foreground service equivalente ao Android — plataforma historicamente mais restritiva a processos em background; conferir o que é viável lá antes de generalizar o comportamento). Cobre também a pendência de validação manual em dispositivo físico que a T-807 deixou em aberto (critério "sobrevive minutos em segundo plano").
  *Pronto quando:* no Android, com o servidor ativo e o foreground service rodando, sair de foreground (ex.: abrir o picker de pasta do sistema, minimizar o app) **não** derruba o servidor — validado manualmente em dispositivo físico real (tela apagada/app minimizado por alguns minutos, servidor continua respondendo a requisições); fechar/matar o app de verdade continua parando o servidor e liberando a porta (comportamento de T-205 preservado nesse caso); testes cobrindo a nova lógica condicional de `handleAppStateChange` (Android com foreground service ativo vs. inativo vs. iOS); documentar no código a leitura do Princípio VI que justifica a mudança.
  **Ressalva (APROVADA pelo validador com ressalva — rev. 1.9):** lógica condicional implementada e testada corretamente para os 4 casos (Android protegido/desprotegido, iOS, web); leitura do Princípio VI conferida como literal, não forçada. Duas pendências continuam em aberto, ambas exigindo dispositivo físico real (não validável neste ambiente): (1) "sobrevive minutos em segundo plano" nunca foi executado de fato; (2) o cenário de fechar/matar o app com o servidor no caminho protegido (Android) depende do Android encerrar o foreground service e fechar o socket TCP ao remover a task — tecnicamente fundamentado (`stopWithTask` não foi setado como `false` no `<service>` do plugin, então vale o default `true`), mas o *timing* de "liberar a porta imediatamente" (exigência literal do Princípio VI) nunca foi medido nesse caminho específico. Antes da T-808 isso não era um problema porque o `stop()` explícito já rodava ao minimizar; agora é o único mecanismo de liberação de porta nesse caminho. Recomenda-se que o roteiro de validação manual (T-701 ou dedicado) cubra explicitamente os dois cenários antes de considerar o Princípio VI cumprido de ponta a ponta neste caminho.

- [ ] **T-809 · Investigar gargalo real de performance no upload** ⬅ T-806
  Continuação da T-806: o loop de conversão de bytes foi descartado como causa raiz (extração + benchmark mostraram que ele já é rápido — ~190-330ms de CPU agregada para 200MB — e que a otimização óbvia seria pior). A hipótese não investigada e mais provável, documentada pelo implementador da T-806: o round-trip de cada chunk de 16KB do socket nativo (`react-native-tcp-socket`) passa por um encode/decode base64 pela bridge do React Native antes mesmo de `nativeHttpModule.ts` receber o dado, mais a conversão `chunk.toString('binary')` — isso multiplicado por milhares de chunks num arquivo grande é o suspeito real da lentidão/UI travando relatada pelo usuário. Investigar com profiling real (não só raciocínio): medir onde o tempo é gasto de fato durante um upload grande em dispositivo físico ou emulador (ex.: marks de tempo em pontos-chave do pipeline: chegada do chunk no socket nativo, entrega em JS, parsing multipart, escrita em disco). Se a bridge for confirmada como gargalo, avaliar a mudança maior que a T-806 decidiu não fazer: `nativeHttpModule.ts` entregando bytes crus (sem round-trip base64/string) e `multipartStreamParser.ts` trabalhando diretamente sobre `Buffer` em vez de `string` — mudança de maior risco, exige plano cuidadoso antes de embarcar (não é um one-shot como as tarefas anteriores).
  *Pronto quando:* causa raiz real da lentidão/UI travando durante upload identificada com evidência de profiling (não só hipótese); se a correção exigir a mudança maior de arquitetura (bridge/parser em Buffer), decisão tomada com o usuário antes de implementar, dado o risco maior; upload de arquivo grande (≥200MB) mensuravelmente mais rápido e UI responsiva, validado em dispositivo real, com números antes/depois registrados (o critério de performance que a T-806 não conseguiu cumprir).

## Fase 9 — Reformulação de Usabilidade: Compartilhar via SO + Pareamento por Token (pivô rev. 2.0)

> Contexto (rev. 1.10): pivô de produto que substitui a navegação por abas por dois fluxos únicos — Enviar (aberto ao compartilhar arquivo(s) pelo menu do SO) e Receber (aberto por um botão na Home) — pareados por token/QR Code, com o token virando controle de acesso real da API. Reaproveita os módulos de servidor/transferência/arquivos das Fases 0–8. Ver `transferir.md` rev. 2.0.0 para a spec completa (HU-09 a HU-16) e as notas de descontinuação em T-204, T-302, T-303, T-603 e T-801.

- [x] **T-901 · Spike: integração com o menu de compartilhar do SO (share intent, Android)** ⬅ T-001
  Investigar, na versão do Expo em uso (ler `AGENTS.md` — documentação versionada do Expo antes de codar), como registrar o app como destino do menu de compartilhar do Android (`ACTION_SEND`/`ACTION_SEND_MULTIPLE`, aceitando qualquer tipo de arquivo). Verificar se alguma lib compatível com o Expo managed workflow (config plugin) já resolve isso, ou se é necessário um plugin customizado (`@expo/config-plugins`), como feito na T-807 para o foreground service Android. Registrar a decisão em `docs/adr/003-share-intent.md`.
  *Pronto quando:* ADR escrito com prova de conceito real — outro app do sistema consegue compartilhar ao menos um arquivo para este app no Android. **(timebox: 1 dia)**
  **Nota (rev. 1.11, 2026-09-12):** versão original desta tarefa também investigava a Share Extension do iOS e pedia uma decisão de viabilidade sobre a plataforma; removido — o app é Android-only (decisão de produto, ver `transferir.md` rev. 2.1).

- [x] **T-902 · Estender `ServerInfo` com `token` e `mode`** ⬅ T-201, T-104 **[P]**
  Renomeia `sessionId` para `token` em `ServerInfo` (spec Seção 3, rev. 2.0) e adiciona o campo `mode: 'send' | 'receive' | null`. `ServerService.start()` passa a receber o modo da sessão como parâmetro e gera o token internamente (reaproveita `generateSessionId`, T-104); a `url` exposta já inclui `?token=<token>`. O token deixa de ser cosmético — passa a ser a credencial validada pela API (ver T-908).
  *Pronto quando:* testes da máquina de estados (T-201) cobrindo o novo campo `mode` e a geração de token em `start(mode)`; nenhuma referência a `sessionId` resta no código do servidor.

- [x] **T-903 · Receber arquivo(s) via compartilhamento do SO** ⬅ T-901, T-301
  App recebe um ou mais arquivos vindos do menu de compartilhar do SO (decisão desta revisão: suporta múltiplos, via `ACTION_SEND_MULTIPLE`). Os arquivos recebidos não são copiados para o sandbox do app quando possível — reaproveita a técnica de `FileRepository.linkFromUri` (`localUri` externo, `linked: true`) introduzida na T-801; o toggle de UI da T-801 foi descontinuado, mas a técnica de acesso sem cópia continua válida aqui.
  *Pronto quando:* compartilhar 1 arquivo e depois vários arquivos de outro app entrega a este app a lista correta de arquivos vinculados sem duplicação em disco; testes cobrindo payload de compartilhamento único e múltiplo, e item inválido/inacessível isolado sem derrubar o restante.

- [x] **T-904 · Tela "Enviar": token, QR e progresso com tela sempre acesa** ⬅ T-903, T-902, T-601
  Nova tela, aberta automaticamente quando o app é invocado via compartilhamento do SO (T-903): inicia o servidor em modo `'send'` (T-902), exibe o token gerado como **título** da tela e um QR Code com a URL + `?token=<token>`; ao detectar download em andamento (reaproveita o store de transferências, T-601), exibe "Transferência em andamento" com progresso e mantém a tela ligada (`expo-keep-awake`) até concluir ou cancelar, desligando o keep-awake logo depois; erros de servidor reaproveitam o tratamento por `ServerErrorCode` já existente. Substitui, para este caso, o fluxo manual de iniciar servidor da antiga Home/Servidor (T-204, descontinuada).
  *Pronto quando:* critérios de aceite da HU-09/HU-11 (`transferir.md`) atendidos; teste garante que o keep-awake é sempre desligado ao sair da tela ou concluir (nunca fica travado ligado); testes de componente para os estados idle/iniciando/erro/transferindo.

- [x] **T-905 · Tela inicial (Home idle)** ⬅ T-005 **[P]**
  Tela exibida quando o app é aberto diretamente (sem compartilhamento): título "Transfer Files", texto de apoio ("Para compartilhar, navegue até um arquivo, clique em compartilhar, selecione este aplicativo como destino.") e botão azul centralizado "Receber arquivo" que navega para a tela de Receber (T-906). Substitui a Home/Servidor antiga (T-204, descontinuada) como tela de entrada padrão do app.
  *Pronto quando:* critérios de aceite da HU-10 atendidos; teste de componente cobre título, texto de apoio e navegação do botão.

- [x] **T-906 · Tela "Receber": gerar QR + token visível** ⬅ T-905, T-902, T-601
  Ao tocar em "Receber arquivo" (T-905), inicia o servidor em modo `'receive'` (T-902) e exibe o QR Code (URL + `?token=<token>`) e também o **token como texto visível** (rótulo dedicado, diferente do uso do token como título na T-904). Mostra progresso de upload(s) em andamento (reaproveita T-601) e, ao concluir, ação inline "Abrir/Compartilhar" para o arquivo recebido, reaproveitando o comportamento da antiga aba Recebidos (T-303, descontinuada como aba).
  *Pronto quando:* critérios de aceite da HU-12 atendidos; testes de componente para os estados idle/iniciando/erro/recebendo/concluído.

- [x] **T-907 · Encerrar sessão ativa (Enviar/Receber → Home)** ⬅ T-904, T-906
  Ação de encerrar sessão disponível nas telas de Enviar (T-904) e Receber (T-906), reaproveitando `ServerService.stop()`; pede confirmação se houver transferência em andamento (comportamento herdado da antiga HU-02). Ao encerrar: token invalidado, servidor parado, porta liberada, app volta à Home idle (T-905). Fechar o app de verdade continua parando o servidor (T-205/T-808, sem mudança).
  *Pronto quando:* critérios de aceite da HU-16 atendidos; testes cobrindo confirmação com/sem transferência ativa e retorno ao estado idle.

- [x] **T-908 · Middleware de validação de token na API** ⬅ T-401, T-902 **[P]**
  Decisão desta revisão: o token deixa de ser cosmético (como o `sessionId` era) e passa a ser controle de acesso real. Middleware no roteador (T-401) valida o `token` de query em toda requisição às rotas de transferência (`GET /api/files`, `GET /api/files/:id/download`, `POST /api/upload`, `GET /api/events`) contra o token ativo da sessão (T-902); requisição sem token ou com token inválido recebe `401` no envelope `apiErrorSchema` com o novo código `INVALID_TOKEN`, em vez de servir o recurso. `GET /` e `GET /api/session` continuam públicos — `GET /api/session` passa a responder `{ mode, tokenValid, appVersion, maxUploadBytes }`, nunca ecoando o valor do token (spec Seção 4, rev. 2.0).
  *Pronto quando:* testes de contrato cobrindo token ausente, inválido e válido nas quatro rotas gated; teste garante que `GET /api/session` nunca inclui o token na resposta.

- [x] **T-909 · Web-ui: renderização condicional por modo (download vs. upload)** ⬅ T-501, T-908
  A página web deixa de assumir upload e download sempre disponíveis ao mesmo tempo: com um token na querystring, consulta `GET /api/session?token=...` e renderiza só a view correspondente ao `mode` ativo — lista de arquivo(s) para baixar (modo `send`, reaproveita T-503) ou área de upload (modo `receive`, reaproveita T-502). Upload passa a suportar seleção múltipla (decisão desta revisão), mantendo a fila sequencial já existente (T-502), com a transferência iniciando automaticamente ao selecionar o(s) arquivo(s), sem botão extra de confirmação.
  *Pronto quando:* critérios de aceite da HU-13/HU-14 (lado convidado) atendidos; teste garante que a view do modo errado nunca aparece; upload de múltiplos arquivos inicia sem clique adicional.

- [x] **T-910 · Web-ui: caixa de confirmação de token** ⬅ T-908, T-909
  Ao acessar a página sem `?token=` na URL, ou com `tokenValid: false`, a página exibe uma caixa de texto pedindo o token em vez do conteúdo de download/upload; ao confirmar um token válido, passa a exibir a view apropriada ao modo (T-909) sem precisar recarregar a página com a querystring correta. Token inválido exibe mensagem de erro e permite nova tentativa.
  *Pronto quando:* critérios de aceite da HU-15 atendidos; teste cobre acesso sem token, com token inválido e com token válido digitado manualmente.

- [x] **T-911 · Reancorar configuração de pasta de recebidos na nova navegação** ⬅ T-802, T-906 **[P]**
  A funcionalidade da T-802 (escolher pasta externa para arquivos recebidos via SAF) continua válida, mas seu ponto de entrada na UI dependia da antiga Home/Servidor (T-204), descontinuada por esta revisão. Adicionar um acesso discreto (ex.: ícone de configurações na Home idle, T-905, ou na tela Receber, T-906) que não contradiga o layout mínimo exigido para a Home (título + texto de apoio + botão "Receber arquivo").
  *Pronto quando:* configuração de pasta de recebidos continua acessível e funcional, sem regressão em relação à T-802; layout da Home idle continua atendendo aos critérios da T-905/HU-10.

- [x] **T-912 · Remover navegação em abas e telas descontinuadas** ⬅ T-904, T-905, T-906, T-907, T-909, T-910, T-911
  Remove a navegação por abas (Home/Servidor, Compartilhados, Recebidos, Transferências) e o código específico de T-204, T-302 (fluxo manual de picker + aba Compartilhados), T-303 (aba Recebidos) e T-603 (tela Transferências), substituídos pelas telas desta fase. O toggle de "vincular pasta" da T-801 (UI na aba Compartilhados) também é removido; a técnica de acesso sem cópia (`linkFromUri`) permanece em uso via T-903. Deve ser a última tarefa da fase, para não remover código ainda em uso pelas telas novas antes delas estarem prontas.
  *Pronto quando:* nenhuma referência às telas/abas removidas resta em código, testes ou navegação; `tsc --noEmit`, lint e suíte de testes verdes; cobertura mantida nos mínimos da constituição.

- [x] **T-913 · Corrigir app ausente no menu de compartilhar do SO (achado em uso real)** ⬅ T-901, T-903
  Achado ao testar em dispositivo/emulador real: o app nunca aparecia como destino ao compartilhar uma imagem pelo menu do SO, apesar de T-901/T-903 estarem "concluídas". Causa raiz tripla, nenhuma pega pelos testes de unidade existentes (mocks reproduziam os mesmos bugs em vez de validá-los contra o schema real do Expo/Android):
  1. `plugins/withShareIntent.js` escrevia o intent filter na chave `mainActivity.intentFilter` (camelCase); a chave literal exigida pelo builder de XML do `@expo/config-plugins` é `'intent-filter'` (kebab-case) — a chave errada gerava uma tag `<intentFilter>` inválida, silenciosamente ignorada pelo `PackageManager` do Android, então o app nunca era resolvido como destino de `ACTION_SEND`.
  2. `plugins/withShareIntentPayload.js` gerava Kotlin que não compilava: usava `currentActivity` sem receiver (não existe em `ReactContextBaseJavaModule`, precisa de `reactApplicationContext.currentActivity`) e `Intent.EXTRA_STREAM_URIS`, constante inexistente no Android SDK (`ACTION_SEND_MULTIPLE` usa a mesma chave `EXTRA_STREAM`, como `ArrayList<Uri>`). Como `android/` é gerado (gitignored) e nenhum build nativo real havia rodado desde que o plugin foi escrito, o erro de compilação nunca foi detectado.
  3. Mesmo corrigido o Kotlin, `getShareIntentPayload()` resolvia a Promise com `uris.toTypedArray()` (`Array<String>` cru) — a bridge do React Native não sabe marshalizar esse tipo, lançando `RuntimeException` em runtime; precisa de `Arguments.createArray()` + `pushString()` (`WritableArray`).
  Corrigido nos três pontos; suíte de testes de `withShareIntent.js` atualizada para usar a chave real (`'intent-filter'`) e ganhou um teste de regressão específico para essa classe de bug. Validado empiricamente em emulador Android: `pm resolve-activity`/`query-activities` confirmam o app como destino de `ACTION_SEND` para `image/*`; um `ACTION_SEND` real com uma imagem da MediaStore abre o app direto na tela Enviar (T-904), com token/QR/"Aguardando download" renderizados e sem exceções no logcat.
  *Pronto quando:* app aparece no menu de compartilhar do SO para qualquer app terceiro (verificado via `pm query-activities`); compartilhar uma imagem real abre o app na tela Enviar sem erro; suíte de testes, `tsc --noEmit` e lint verdes.

- [x] **T-914 · Corrigir seção de pasta de recebidos fechando sem confirmação (achado em uso real)** ⬅ T-802, T-911
  Achado ao testar em emulador Android (a pedido do usuário, que reportou "clico em Escolher Pasta e o modal fecha, a escolha de pasta não é acionada"): reproduzido — o seletor de pasta do SAF (`ACTION_OPEN_DOCUMENT_TREE`) sempre abria corretamente, mas `ReceivedFolderConfigurationSection.handleSelectFolder`/`handleClearFolder` chamavam `onConfigured?.()` **incondicionalmente** após `await selectFolder()`/`clearFolder()`, e o hook `useReceivedFolderConfiguration` nunca propagava sucesso/cancelamento/erro (engolia tudo internamente, sempre resolvendo a Promise). Resultado: cancelar o seletor do SAF, ou qualquer erro ao salvar a pasta, fechava a seção de configuração (via `setShowConfiguration(false)` na tela Receber) exatamente como um sucesso — o usuário nunca chegava a ver a confirmação "Pasta Configurada" nem qualquer mensagem de erro; a rapidez da transição dava a impressão de que o próprio seletor nunca tinha sido acionado. Bug não pego pelos testes existentes porque nenhum deles simulava o toque no botão (`fireEvent.press`) — só verificavam que o componente renderizava sem lançar exceção em cada estado estático.
  Corrigido: `selectFolder()`/`clearFolder()` agora retornam `Promise<boolean>` (`true` só quando algo de fato mudou); o componente só chama `onConfigured` quando o retorno é `true` — restaurando o contrato já documentado no JSDoc original ("Callback opcional ao terminar a configuração **com sucesso**"). Testes de componente reescritos para de fato pressionar os botões e cobrir os quatro casos (sucesso/cancelamento/erro em cada ação). Validado empiricamente em emulador: cancelar o seletor do SAF (voltar sem escolher pasta) mantém a seção aberta com a pasta anterior intacta; concluir a seleção mostra a confirmação antes de fechar.
  *Pronto quando:* cancelar ou errar na seleção/limpeza de pasta nunca fecha a seção de configuração nem descarta mensagens de erro; testes de componente exercitam o toque real nos botões para os quatro casos; suíte de testes, `tsc --noEmit` e lint verdes.

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
        T-804 (achado em uso real, depende de T-402/T-405)
        T-805 · T-806 · T-807   (achados em uso real pós-T-804, paralelizáveis entre si)
        T-808 (depende de T-807) · T-809 (depende de T-806)
Fase 9: T-901 → T-902 [P] → T-903 → T-904
        T-905 [P] → T-906 → T-907   (T-904 e T-906 alimentam T-907)
        T-908 [P] → T-909 → T-910
        T-911 [P]
        T-912 (depende de T-904/905/906/907/909/910/911 — remove código antigo por último)
```

> **Maior risco:** T-202 (streaming da lib de servidor) — decisão finalizada (ver ADR-001). T-206 removida (rev. 1.2, ver ADR-002). T-901 (viabilidade de share intent no Android) é o maior risco da Fase 9 — spike primeiro, como o T-202 foi para a Fase 2. *(rev. 1.11: risco de iOS removido junto com o suporte à plataforma — ver `transferir.md` rev. 2.1.)*
