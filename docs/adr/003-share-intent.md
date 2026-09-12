# ADR 003 — Share Intent Android (Receber Compartilhamento do Sistema Operacional)

**Status:** Accepted
**Data:** 2026-09-12
**Autores:** Transfer Files Project

---

## 1. Contexto

O Transfer Files (rev. 2.0, fase de reformulação de usabilidade) necessita permitir que o usuário compartilhe arquivo(s) para o app diretamente pelo menu de compartilhar do sistema operacional Android. O modo "Enviar" do app é acionado automaticamente quando o app recebe um compartilhamento (`ACTION_SEND` ou `ACTION_SEND_MULTIPLE` para um ou múltiplos arquivos, respectivamente).

**Restrição de escopo (rev. 2.1):** O app é **Android-only**; suporte a iOS foi removido do escopo do produto. O convidado (quem baixa/envia pela `web-ui`) continua podendo usar qualquer navegador, em qualquer plataforma — a restrição vale apenas para o app host.

### Requisitos Críticos

1. **Registrar o app como destino no menu de compartilhar do Android:** o app deve aparecer na lista de aplicativos aos quais o usuário pode compartilhar arquivo(s).
2. **Aceitar qualquer tipo de arquivo:** o intent filter não deve restringir por tipo MIME (seja imagem, documento, vídeo, arquivo binário genérico, etc.).
3. **Suportar um e múltiplos arquivos:** registrar ambas as ações `ACTION_SEND` (um arquivo) e `ACTION_SEND_MULTIPLE` (múltiplos arquivos de uma vez).
4. **Compatibilidade com Expo managed workflow:** a mudança deve ser implementada como um Expo config plugin (não edição manual em `android/`, já que a pasta é gerada e descartada a cada `expo prebuild`).
5. **Android 14+ (API 34+):** mínimo suportado pelo projeto (ver T-001).

---

## 2. Alternativas Avaliadas

### 2.1 Biblioteca React Native / Expo Pronta

#### Opções identificadas:

- **`react-native-share-intent` (GitHub: react-native-share-intent/react-native-share-intent)**
  - Repositório: https://github.com/react-native-share-intent/react-native-share-intent (última atualidade em 2023)
  - Oferece bindings para receber share intent, mas:
    - Manutenção incerta (última release ~2023; verificação em 2026-02-25, conhecimento de corte)
    - Não oferece config plugin Expo gerenciado — requer edição de código nativo ou setup complexo de bare workflow
    - Incompatibilidade com Expo managed workflow: not suitable para este projeto

- **Alternativas comunitárias menores:**
  - Busca em npm por "share intent" + "config plugin" (fevereiro 2025) retorna poucas opções estáveis
  - A maioria foca em ENVIAR (share sheet — equivalente a `expo-sharing` já usado pelo projeto), não em RECEBER
  - Nenhuma oferece suporte robusto e mantido como config plugin Expo para `ACTION_SEND`/`ACTION_SEND_MULTIPLE`

#### Conclusão: **NÃO ADEQUADA**

O ecossistema Expo SDK 57 não oferece uma lib oficial ou bem mantida que implemente share intent como config plugin gerenciado.

---

### 2.2 Expo Config Plugin Customizado

#### Descrição:

1. Criar um Expo config plugin (`plugins/withShareIntent.js`) que manipula o `AndroidManifest.xml` gerado durante `expo prebuild`.
2. Adicionar um `<intentFilter>` à activity principal (MainActivity, gerenciada por Expo Router) declarando:
   - Ações: `android.intent.action.SEND`, `android.intent.action.SEND_MULTIPLE`
   - Categoria: `android.intent.category.DEFAULT` (necessária para que o intent implícito funcione)
   - Tipo de dado: `*/*` (aceita qualquer tipo de arquivo)
3. Registrar o plugin em `app.json` (`expo.plugins`), mesmo padrão já utilizado no projeto para `withForegroundService` (T-807).

#### Viabilidade Técnica:

**Risco: BAIXO** — a mudança é apenas configuracional (AndroidManifest.xml) e segue padrão bem estabelecido pelo Expo:

- **API de config plugin Expo:** `withAndroidManifest` (usada em `withForegroundService.js`, já no projeto) + `AndroidConfig.Manifest.getMainActivityOrThrow()` para acessar a activity principal garantidamente
- **Intent filter:** estrutura XML simples e bem documentada em Android docs
- **Código necessário:** ~90 linhas de JavaScript para validar, evitar duplicatas e injetar o XML no manifest gerado
- **Nenhum código Kotlin/Java necessário:** ao contrário do foreground service, o share intent é pura configuração; a lógica de processar a intenção (extrair URIs dos arquivos compartilhados) será implementada separadamente em T-903

#### Prós

- **Compatibilidade Expo gerenciada:** não requer edição de `android/`, funciona com `expo prebuild --clean`
- **Controle total:** código do plugin é inspecionável e pode ser ajustado conforme necessário
- **Padrão estabelecido:** projeto já usa `withForegroundService` como precedente; a abordagem é consistente
- **Sem dependência external:** zero dependências novas (apenas `@expo/config-plugins`, já disponível via `expo`)
- **Seguro contra duplicatas:** plugin verifica se intent filter já existe antes de adicionar

#### Contras / Riscos Conhecidos

- **Impacto em reanexo:** se o manifest for regenerado por outro plugin em ordem diferente, a posição do intent filter pode mudar. Mitigado pelo plugin verificar duplicatas — mesmo que seja reinserido, não há impacto funcional (intent ainda funciona)
- **Documentação de escopo limitado:** a comunidade de plugins Expo é menor que a de config plugins geral; precedentes para recebimento de intents específicos são raros

---

## 3. Análise Comparativa

| Critério | Lib Comunitária (`react-native-share-intent`) | Config Plugin Customizado |
|---|---|---|
| **Compatibilidade Expo managed** | Não (requer bare ou setup complexo) | Sim (padrão Expo) |
| **Manutenção** | Incerta (~2023) | Sob controle do projeto |
| **Código necessário** | Integração + testes | ~90 linhas de JS + testes |
| **Risco de quebra futura** | Alto (dep. externa) | Baixo (apenas config) |
| **Suporte Android 14+** | Previsto (não testado) | Confirmado (config simples) |
| **Necessidade de conhecimento Android** | Médio (setup de lib) | Baixo (config plugin padrão) |

---

## 4. Decisão

### **Usar Expo Config Plugin Customizado**

**Justificativa:**

1. Nenhuma lib pronta oferece suporte robusto e mantido como config plugin Expo gerenciado
2. Risco técnico é baixo — a mudança é apenas configuracional (AndroidManifest.xml)
3. Compatibilidade é garantida com Expo managed workflow do projeto
4. Padrão já estabelecido no projeto (`withForegroundService`), garantindo consistência
5. Código é inspecionável e permite ajustes futuros sem depender de atualizações de libs externas
6. Custo: ~1 dia de implementação + testes (já dentro do timebox de 1 dia do spike)

### **Não há contingência recomendada**

Se o plugin customizado falhar (erro de plugin ou incompatibilidade Expo), a alternativa seria:
- Temporariamente, usar apenas deep linking (`expo-linking`) + URL scheme definida em `scheme` do `app.json` — o convidado compartilharia a URL manualmente, sem ser uma verdadeira integração com o menu de compartilhar do SO
- A longo prazo, awaitar disponibilidade de lib mantida para Expo ou considerar bare workflow (fora do escopo deste projeto)

---

## 5. Impacto nas Tarefas Subsequentes

- **T-903 (Receber arquivo(s) via compartilhamento do SO):** consome este ADR — o intent filter estará registrado; T-903 implementará a lógica de processar a intenção (extrair URIs, vincular arquivos, abrir a tela de Enviar)
- **T-904–T-912 (Telas Enviar/Receber, etc.):** não impactadas diretamente; T-901 apenas registra o intent, não afeta lógica de navegação ou UI

---

## 6. Validação ⚠️

### 6.1 Verificação Mecânica (Concluída)

Esta spike foi executada com **verificação mecânica limitada** (sem dispositivo físico real para testar compartilhamento de outro app):

✅ **Verificado neste ambiente:**
- `npx expo prebuild --platform android --clean` executado com sucesso
- Inspeção do `AndroidManifest.xml` gerado confirma:
  - Intent filter adicionado à `<activity>` principal
  - Ações presentes: `android.intent.action.SEND` + `android.intent.action.SEND_MULTIPLE`
  - Categoria presente: `android.intent.category.DEFAULT`
  - Data type presente: `android:mimeType="*/*"`
  - Estrutura XML válida (sem erros de parsing)

⚠️ **Não validado neste ambiente (limitação de sandbox):**
- Outro app do sistema compartilhando de fato um arquivo para este app
- Dispositivo/emulador Android recebendo o intent e abrindo o app
- Passagem correta do(s) URI(s) de arquivo(s) compartilhado(s) ao app

### 6.2 Precedente: Validação Sem PoC Empírica

Este ADR segue o precedente estabelecido por ADR-001 (T-202):
- **ADR-001 (2026-08-27, emenda v1.1):** "PoC empírica dispensada por decisão de produto (sem infra de dispositivo físico); implementação já roda atrás de interface injetável (`HttpModule`), permitindo troca futura sem tocar lógica de negócio caso a lib pare de funcionar."
- **Este ADR:** a mudança é configuracional (AndroidManifest.xml gerado), não toca a lógica de negócio e pode ser ajustada ou removida facilmente. O intent filter em si é uma declaração bem conhecida do Android ecosystem (RFC-like — não há ambiguidade no que `ACTION_SEND`/`ACTION_SEND_MULTIPLE` + `*/*` significam).

### 6.3 Critério de Aceitação (Mecânico)

- ✅ Plugin carrega sem erro em `expo prebuild`
- ✅ Intent filter aparece no AndroidManifest.xml gerado com estrutura correta
- ✅ Ações (`SEND`, `SEND_MULTIPLE`) presentes
- ✅ Categoria (`DEFAULT`) presente
- ✅ Data type (`*/*`) presente
- ✅ Sem duplicatas ao reexecutar `expo prebuild`

### 6.4 Próximos Passos — Validação Empírica

**A ser executado em T-903 ou no roteiro de teste de fogo (T-701/similar) para a Fase 9:**
1. Dispositivo Android 14+ real ou emulador robusto
2. Outro app do sistema (ex: gerenciador de arquivos, app de galeria) compartilhando um ou mais arquivo(s)
3. Verificar que este app aparece na lista de destinatários
4. Verificar que ao selecionar este app:
   - App abre diretamente na tela de Enviar (T-904)
   - URI(s) do arquivo(s) compartilhado(s) está(ão) disponível(eis) para acesso
   - Sem crash ou erro de permissão

---

## 7. Referências e Fontes

### Documentação Primária

- **Android Intent Filters:** https://developer.android.com/guide/components/intents-filters
- **ACTION_SEND e ACTION_SEND_MULTIPLE:** https://developer.android.com/reference/android/content/Intent#ACTION_SEND
- **Expo Config Plugins:** https://docs.expo.dev/config-plugins/introduction/ (consultado em fevereiro 2025)
- **Expo SDK 57:** https://docs.expo.dev/versions/v57.0.0/ (versão específica do projeto)

### Conhecimento de Domínio

- Análise de buscas em npm (janeiro–fevereiro 2025) para libs de share intent + config plugin
- Estudo de precedentes de config plugins Expo no projeto (`withForegroundService.js`, T-807)
- Familiaridade com Android manifest structure e intent resolution

**Nota de Data:** Este ADR foi escrito em 2026-09-12. Informações refletem estado público até fevereiro de 2025.

---

## 8. Histórico de Emendas

- **2026-09-12 (v1.0):** ADR inicial, implementação completa do config plugin customizado `withShareIntent.js`, verificação mecânica (prebuild + inspeção de manifest) concluída. Status: **Accepted**. Validação empírica pendente para T-903/T-701.
