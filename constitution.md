# Constituição — Transfer Files

**Aplicativo mobile de transferência de arquivos entre celulares via rede local**

- **Versão:** 1.1.0
- **Ratificada em:** 2026-07-16
- **Última emenda:** 2026-07-16 (Android 14+, modo rede própria/offline, fluxo de branches)

---

## 1. Missão do Produto

O Transfer Files é um aplicativo mobile que transforma o celular em um servidor de arquivos na rede local. Ao abrir o app, o usuário toca em um único botão para iniciar o servidor; o app exibe um link (endereço IP + porta, com QR Code) que qualquer outro dispositivo na mesma rede — celular, tablet ou computador — pode abrir no navegador para **enviar e baixar arquivos de qualquer tipo através de uma interface web**, sem instalar nada no segundo dispositivo.

### Decisão fundadora: HTTP

O servidor embarcado É um **servidor HTTP** que serve uma página web de upload/download. É o único protocolo capaz de entregar o requisito central — "acessar o link e transferir arquivos dentro de uma interface web" — em qualquer navegador moderno, sem instalar nada no dispositivo convidado. O termo "servidor de arquivos" neste documento refere-se sempre e exclusivamente a este servidor HTTP embarcado; nenhum outro protocolo de transferência será considerado.

### Decisão fundadora: funciona sem internet

O app NUNCA depende de internet. Há dois modos de conectividade, ambos obrigatórios:

1. **Mesma rede Wi-Fi:** host e convidado já conectados à mesma rede local — o servidor sobe nela.
2. **Rede própria (sem nenhuma rede disponível):** o host DEVE conseguir **abrir a própria rede local** pelo app para o convidado se conectar. No Android 14+, via **Local Only Hotspot** (rede criada pelo sistema, sem internet, com SSID/senha exibidos como QR Code Wi-Fi). No iOS, onde a criação programática não é permitida, o app guia a ativação manual do Hotspot Pessoal e detecta a interface ativa automaticamente.

---

## 2. Princípios Fundamentais

### Princípio I — Simplicidade Radical na Experiência

- A jornada principal DEVE ser completável em no máximo 2 toques: abrir o app → tocar no botão de iniciar servidor.
- Sem rede disponível NUNCA existe beco sem saída: a ação principal vira "Criar rede" (1 toque adicional) e a jornada segue — o app nunca exibe apenas "sem conexão" sem oferecer o caminho.
- O app DEVE exibir o endereço de acesso de forma legível **e** como QR Code assim que o servidor iniciar; no modo rede própria, exibir primeiro o QR Code Wi-Fi (entrar na rede) e depois o QR Code do link (acessar).
- O dispositivo receptor NUNCA precisa de app instalado: a interface web DEVE funcionar em qualquer navegador moderno sem plugins.
- Funcionalidades que compliquem a jornada principal (contas, login, nuvem) são proibidas sem emenda constitucional.

### Princípio II — TypeScript Estrito, Sem Exceções

- Todo o código DEVE ser escrito em TypeScript com `strict: true` no `tsconfig.json`.
- `any` é proibido (`@typescript-eslint/no-explicit-any` como erro). Casos excepcionais exigem `unknown` + type narrowing.
- Tipos de domínio (ex.: `TransferSession`, `ServerStatus`, `FileEntry`) vivem em módulos próprios e são a fonte única de verdade entre camadas.
- Contratos da API HTTP (payloads de upload, listagem de arquivos, progresso) DEVEM ser validados em runtime (ex.: Zod) — nunca apenas confiados por tipagem estática.

### Princípio III — Testes Unitários Obrigatórios (NÃO NEGOCIÁVEL)

- **Toda função exportada DEVE ter testes unitários.** Sem exceção: lógica de servidor, hooks, utilitários, formatadores, stores e componentes.
- Cobertura mínima exigida no CI: **90% de linhas e branches** nas camadas de domínio e serviços; **80%** global. Build falha abaixo disso.
- Fluxo recomendado: TDD (teste primeiro) para toda lógica de domínio e serviços. Testes escritos → testes falham → implementação → testes passam.
- Ferramentas: **Jest** + **React Native Testing Library** para componentes/hooks; mocks explícitos para módulos nativos (rede, filesystem).
- Testes DEVEM ser determinísticos: sem dependência de rede real, relógio real ou sistema de arquivos real — sempre via injeção de dependência ou mocks.
- Um PR sem testes para código novo DEVE ser rejeitado na revisão.

### Princípio IV — Arquitetura Feature-First com Camadas Explícitas

O projeto DEVE seguir organização **feature-first** (screaming architecture): a estrutura de pastas comunica o que o app faz, não quais frameworks usa.

```
src/
├── app/                      # Entrada, providers, navegação (Expo Router ou React Navigation)
├── features/                 # Cada feature é autocontida
│   ├── server/               #   Iniciar/parar servidor, status, QR Code
│   │   ├── components/       #   UI exclusiva da feature
│   │   ├── hooks/            #   ex.: useServer()
│   │   ├── services/         #   lógica do servidor HTTP
│   │   ├── store/            #   estado da feature
│   │   ├── types/            #   tipos da feature
│   │   └── __tests__/        #   testes colocalizados
│   ├── transfer/             #   Upload/download, progresso, histórico
│   └── files/                #   Listagem e gestão de arquivos recebidos
├── shared/                   # Reutilizável entre features
│   ├── components/           #   Design system (botões, cards…)
│   ├── hooks/
│   ├── lib/                  #   utilitários puros (formatBytes, getLocalIp…)
│   └── types/
└── web-ui/                   # Interface web servida pelo servidor HTTP (HTML/CSS/JS empacotados como asset)
```

Regras de dependência (aplicadas por lint, ex.: `eslint-plugin-boundaries`):

- `features/*` PODE importar de `shared/`; NUNCA de outra feature diretamente.
- `shared/` NUNCA importa de `features/` nem de `app/`.
- Componentes de UI NUNCA contêm lógica de rede/filesystem — isso vive em `services/`, consumido via hooks.
- Toda lógica de negócio DEVE ser função pura ou serviço injetável, testável sem renderizar UI.

### Princípio V — Estilização com Tailwind (NativeWind)

- Toda estilização DEVE usar **NativeWind** (Tailwind para React Native) via `className`.
- `StyleSheet.create` e estilos inline são proibidos, exceto quando o NativeWind comprovadamente não cobre o caso (documentar com comentário no local).
- Design tokens (cores, espaçamentos, tipografia) DEVEM ser centralizados no `tailwind.config.js` — nunca valores mágicos espalhados nos componentes.
- O app DEVE suportar tema claro e escuro desde a primeira versão.

### Princípio VI — Privacidade e Segurança Local-First

- Nenhum arquivo ou metadado sai da rede local. Integrações com nuvem/analytics de conteúdo são proibidas.
- O servidor DEVE rodar apenas enquanto o app estiver em primeiro plano ou com notificação persistente explícita; parar o servidor DEVE liberar a porta imediatamente.
- Uploads DEVEM ser sanitizados: nomes de arquivo normalizados (proteção contra path traversal, ex.: `../../`), tamanho máximo configurável, escrita restrita ao diretório sandbox do app.
- A interface web DEVE exibir um identificador da sessão para o usuário confirmar que está conectado ao dispositivo correto.

### Princípio VII — Qualidade Automatizada

- **ESLint + Prettier** obrigatórios, com verificação em pre-commit (Husky + lint-staged) e no CI.
- CI DEVE rodar em todo PR: typecheck (`tsc --noEmit`) → lint → testes com cobertura. Qualquer etapa vermelha bloqueia merge.
- Commits DEVEM seguir **Conventional Commits** (`feat:`, `fix:`, `test:`, `refactor:`…).
- Código morto, `console.log` e `TODO` sem issue associada são bloqueados no lint.

---

## 3. Stack Tecnológica (Restrições)

| Camada | Tecnologia | Observação |
|---|---|---|
| Framework | **React Native** (via **Expo**, dev build) | Expo com development build permite módulos nativos exigidos pelo servidor |
| Linguagem | **TypeScript** (strict) | Princípio II |
| Estilo | **NativeWind** (Tailwind CSS) | Princípio V |
| Navegação | **Expo Router** | File-based routing, padrão atual do ecossistema |
| Estado global | **Zustand** | Leve, testável sem provider; estado de servidor/transferências |
| Servidor HTTP embarcado | `react-native-http-bridge-refurbished` ou **TcpSocket + implementação própria** | Avaliar na fase de spec; requisito: suportar upload multipart de arquivos grandes (streaming) |
| Filesystem | `expo-file-system` | Sandbox do app + acesso à galeria via `expo-media-library` |
| Rede/IP local | `expo-network` | Obter IP na rede Wi-Fi ou na interface do hotspot |
| Rede própria (offline) | **Local Only Hotspot** (módulo nativo Android via config plugin Expo) | Criar rede sem internet no Android 14+; permissão `NEARBY_WIFI_DEVICES`; avaliar lib existente vs. módulo próprio no spike |
| QR Code | `react-native-qrcode-svg` | Exibição do link de acesso |
| Validação runtime | **Zod** | Contratos da API HTTP |
| Testes | **Jest** + **React Native Testing Library** | Princípio III |
| Lint/format | **ESLint** (flat config) + **Prettier** + `eslint-plugin-boundaries` | Princípio VII |
| Git hooks | **Husky** + **lint-staged** | Princípio VII |

Trocar qualquer item desta tabela exige emenda constitucional (ver Governança).

---

## 4. Restrições e Requisitos Não Funcionais

- **Plataformas:** **Android 14 (API 34) ou superior** — `minSdkVersion = 34` — e iOS (mínimo definido pelo Expo SDK vigente). Nenhuma feature pode ser exclusiva de uma plataforma sem justificativa documentada. *Exceção registrada:* criação programática de rede própria é exclusiva do Android (o iOS não permite; o fluxo iOS guia a ativação manual do Hotspot Pessoal).
- **Rede:** operação 100% independente de internet. Com rede Wi-Fi disponível, os dispositivos usam essa rede; **sem nenhuma rede, o host DEVE conseguir abrir a própria rede local** (Android: Local Only Hotspot; iOS: Hotspot Pessoal com orientação do app) e servir através dela.
- **Arquivos:** qualquer tipo/extensão; transferências grandes (≥ 1 GB) DEVEM usar streaming — nunca carregar o arquivo inteiro em memória.
- **Interface web:** autocontida (HTML/CSS/JS empacotados no app, sem CDN), responsiva, com barra de progresso de upload/download e suporte a múltiplos arquivos.
- **Desempenho:** servidor DEVE iniciar em < 2 s; UI nunca bloqueia durante transferências (trabalho fora da JS thread principal quando possível).
- **Idiomas:** pt-BR como padrão; strings centralizadas para permitir i18n futura.

---

## 5. Fluxo de Desenvolvimento

1. **Spec antes de código:** toda feature nasce de uma especificação curta (o quê/por quê) e um plano técnico (como), derivados desta constituição.
2. **TDD nas camadas de lógica:** testes primeiro em `services/`, `lib/` e `store/`.
3. **PRs pequenos:** um PR por feature ou fatia de feature; descrição referencia a spec.
4. **Revisão obrigatória:** todo PR passa por revisão verificando aderência aos Princípios I–VII antes do merge.
5. **Definition of Done:** typecheck limpo + lint limpo + testes passando com cobertura mínima + testado manualmente em Android **e** iOS.

### Versionamento e branches (GitHub Flow com `develop`)

Repositório: `git@github.com:wesley-veiga/file-web-transfer.git`

- **`main`** — produção. Protegida; recebe merge apenas de `develop` em releases, sempre com tag SemVer (`v1.0.0`).
- **`develop`** — integração contínua. Protegida; base de toda branch de tarefa e alvo de todo PR de tarefa.
- **Branch de tarefa:** `feat/t-xxx-descricao-curta` (prefixos `fix/`, `chore/`, `docs/`, `test/` quando aplicável), sempre criada a partir de `develop` atualizada.
- **1 tarefa = 1 branch = 1 PR** para `develop`. Agentes (implementador, testador) DEVEM commitar exclusivamente na branch da própria tarefa — commit direto em `main` ou `develop` é proibido.
- Todo PR DEVE receber veredito **APROVADA** do agente `validador` antes do merge (squash merge, título em Conventional Commits).
- PRs são criados pelo skill `/criar-pr`, que padroniza título, corpo e checklist.

---

## 6. Governança

- Esta constituição prevalece sobre qualquer outra prática ou preferência individual do time.
- **Emendas** exigem: proposta escrita com justificativa, avaliação de impacto sobre código existente e atualização da versão deste documento.
- **Versionamento da constituição (SemVer):**
  - **MAJOR:** remoção ou redefinição incompatível de um princípio;
  - **MINOR:** novo princípio ou expansão material de um existente;
  - **PATCH:** esclarecimentos e correções de redação.
- Toda revisão de PR DEVE verificar conformidade com esta constituição; violações exigem justificativa explícita registrada no PR ou correção antes do merge.
- Complexidade DEVE ser justificada: na dúvida entre duas soluções, escolher a mais simples que satisfaça os princípios.
