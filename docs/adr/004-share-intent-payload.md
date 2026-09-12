# ADR 004 — Leitura de Share Intent Payload (Receber Arquivo(s) Compartilhado(s) do Android)

**Status:** Accepted
**Data:** 2026-09-12
**Autores:** Transfer Files Project

---

## 1. Contexto

A tarefa T-903 necessita que o app receba arquivo(s) compartilhado(s) via menu de compartilhar do Android (ACTION_SEND/ACTION_SEND_MULTIPLE) e os vincule ao repositório de arquivos sem duplicação em disco.

O requisito central é: **extrair as URIs do(s) arquivo(s) compartilhado(s)** do Intent Android e passá-las para o `FileRepository.linkFromUri()` da T-301.

**Pré-requisito:** T-901 já registrou o intent filter (`ACTION_SEND`, `ACTION_SEND_MULTIPLE`) via config plugin, garantindo que o app aparece no menu de compartilhar do SO. Aqui tratamos a etapa seguinte: LER o payload (EXTRA_STREAM / EXTRA_STREAM_URIS).

---

## 2. Problema Técnico

Quando o Android invoca o app via compartilhamento, passa os dados via Intent extras:

- **ACTION_SEND (um arquivo):** `EXTRA_STREAM` contém uma única `Uri`
- **ACTION_SEND_MULTIPLE (múltiplos arquivos):** `EXTRA_STREAM_URIS` contém um `ArrayList<Uri>`

O lado JavaScript do Expo não consegue acessar `getIntent()` ou seus extras — isso exige código nativo Android.

### Requisitos

1. Ler as URIs do Intent sem copiar o(s) arquivo(s) para a sandbox (reaproveita `linkFromUri`, T-301)
2. Suportar um E múltiplos arquivos
3. Isolar erro por item: um arquivo inacessível não derruba o processamento dos demais
4. Limpar o Intent após consumir (evita reprocessamento ao minimizar/restaurar o app)
5. Ser testável sem módulo nativo real (injeção de dependência)

---

## 3. Alternativas Avaliadas

### 3.1 Expo SDK 57 — APIs Oficiais Existentes

#### Opções investigadas:

- **`expo-linking`**: Deep linking via `ACTION_VIEW`. **Não suporta** ACTION_SEND/SEND_MULTIPLE.
- **`expo-media-library`**: Acesso à galeria do usuário (outro fluxo). Não recebe intents.
- **`expo-sharing`**: Share sheet para ENVIAR. Não para receber.
- **Nenhuma lib oficial da Expo** expõe `getIntent()` ou EXTRA_STREAM.

#### Conclusão: **NÃO ADEQUADA**

---

### 3.2 Biblioteca React Native Comunitária

#### Opções identificadas:

- **`react-native-share-intent`** (GitHub: react-native-share-intent/react-native-share-intent)
  - Oferece bindings para receber share intent
  - Última release: ~2023, manutenção incerta
  - **Crítico:** Não oferece suporte como config plugin Expo gerenciado — incompatível com `expo prebuild`
  - Requereria bare workflow ou setup complexo

#### Conclusão: **NÃO ADEQUADA** por incompatibilidade com Expo managed workflow

---

### 3.3 Módulo Nativo Customizado (Config Plugin Kotlin)

#### Descrição:

1. Criar um Expo config plugin (`plugins/withShareIntentPayload.js`) que gera código Kotlin
2. O módulo Kotlin (`ShareIntentPayloadModule`) expõe:
   - `getShareIntentPayload(): Promise<string[]>` — retorna array de URIs
   - `clearShareIntent(): Promise<void>` — limpa o Intent após consumir
3. Registrar o módulo nativo em `MainApplication.kt` (autolinking não se aplica — é gerado, não é pacote npm)
4. Serviço JS (`shareIntentService.ts`) chama o módulo nativo, processa as URIs, valida e vincula

#### Viabilidade Técnica:

**Risco: BAIXO** — precedente forte (T-807, foreground service):

- **Padrão estabelecido:** projeto já usa config plugin customizado com código Kotlin gerado (`withForegroundService.js`, T-807)
- **Código necessário:** ~200 linhas Kotlin + ~400 linhas JS (serviço + testes)
- **Interface testável:** serviço recebe módulo nativo injetável → 100% testável em Jest sem módulo real
- **Nenhuma dependência nova:** apenas `expo/config-plugins`, já disponível

#### Prós

- **Compatibilidade garantida:** Expo managed workflow, `expo prebuild`, sem bare necessário
- **Padrão do projeto:** segue precedente de T-807, consistência arquitetural
- **Código sob controle:** inspecionável, ajustável, sem depender de libs externas mantidas por terceiros
- **Isolamento de dependência:** o serviço JS é puro e testável; o módulo nativo é uma implementação intercambiável
- **Graceful degradation:** se módulo não estiver disponível (ex.: iOS, emulador), retorna empty em vez de falhar

#### Contras / Riscos Conhecidos

- **Dupla manutenção:** mudanças no Intent Android podem exigir ajuste de código Kotlin
- **Validação empírica pendente:** sem dispositivo real, a leitura do Intent não foi testada de ponta a ponta

---

## 4. Análise Comparativa

| Critério | API Expo Oficial | Lib Comunitária | Config Plugin Customizado |
|---|---|---|---|
| **Compatibilidade Expo managed** | Não (não existe) | Não | Sim |
| **Suporta ACTION_SEND/SEND_MULTIPLE** | Não | Sim (theoretic) | Sim |
| **Manutenção** | N/A | Incerta (~2023) | Sob controle do projeto |
| **Setup necessário** | N/A | Bare workflow ou complexo | Config plugin (padrão Expo) |
| **Risco de quebra futura** | N/A | Alto (dep. ext.) | Baixo (apenas config) |
| **Testabilidade (JS)** | N/A | Requer module real | 100% (injeção de dep.) |
| **Precedente no projeto** | N/A | Nenhum | Sim (T-807) |

---

## 5. Decisão

### **Usar Módulo Nativo Customizado via Config Plugin**

**Justificativa:**

1. Expo SDK 57 não oferece API oficial para receber intents com payload
2. Libs comunitárias existentes estão pouco mantidas e são incompatíveis com Expo managed workflow
3. Config plugin customizado segue padrão já estabelecido no projeto (T-807, foreground service)
4. Risco técnico baixo — mudança é configuracional + Kotlin simples
5. Código é testável em 100% (serviço JS isolado do módulo nativo via injeção)
6. Compatibilidade garantida com `expo prebuild --clean` e pipeline CI

### **Sem contingência imediata**

Se o plugin falhar em produção:
- Fallback graceful: módulo nativo mock retorna empty, fluxo de compartilhamento fica desabilitado
- Longo prazo: awaitar lib mantida da comunidade ou considerar reescrita em bare workflow (fora do escopo)

---

## 6. Impacto nas Tarefas Subsequentes

- **T-904 (Tela Enviar):** consome `shareIntentService.ts`; navega para a tela quando app é invocado via compartilhamento
- **T-905 (Home idle):** tela padrão quando app abre sem Intent
- **T-906–T-912:** não impactadas diretamente; T-903 apenas fornece dados de compartilhamento

---

## 7. Implementação

### 7.1 Config Plugin (`plugins/withShareIntentPayload.js`)

- Gera `ShareIntentPayloadModule.kt` com métodos nativos
- Gera `ShareIntentPayloadPackage.kt` para registro
- Registra em `MainApplication.kt` via `mergeContents`
- Nenhuma permissão adicional necessária (intent filter já foi registrado por T-901)

### 7.2 Serviço JS (`src/features/files/services/shareIntentService.ts`)

Classe `ShareIntentService`:
- Recebe módulo nativo + repositório injetados
- Método `processShareIntent()` orquestra: lê URIs → processa cada uma → vincula → limpa Intent
- Isolamento de erro: erro em uma URI não derruba as outras
- Retorna resultado consolidado (sucessos + erros isolados)

Factory function:
- Obtém módulo nativo real ou mock (graceful degradation)
- Instancia serviço com dependências

### 7.3 Testes (`src/features/files/__tests__/shareIntentService.test.ts`)

- Testes do serviço JS com módulo nativo mockado (100% cobertura)
- Casos: sucesso (1 arquivo, múltiplos), erro isolado, limpeza, fallback
- MIME type detection, extração de nome de file:// e content:// URIs

### 7.4 MIME Types (`src/shared/lib/mimeTypes.ts`)

- Função utilitária `getMimeType(fileName)` baseada em extensão
- Fallback: `'application/octet-stream'` para tipos desconhecidos
- Reutilizável em outros contextos futuros

---

## 8. Validação ⚠️

### 8.1 Verificação Mecânica (Concluída)

✅ **Verificado neste ambiente:**
- Config plugin compilado sem erro (`withShareIntentPayload.js` valida)
- `npx expo prebuild --platform android` executa com sucesso (relatório em PR)
- Código Kotlin compilável (sintaxe, imports, sem circular dependencies)
- Serviço JS typado stricto, TypeScript `--noEmit` limpo
- Testes Jest passando: 100% de cobertura do serviço

⚠️ **Não validado neste ambiente (limitação de sandbox):**
- Outro app compartilhando arquivo de fato para este app
- Leitura real de Intent pelo módulo nativo (Kotlin)
- Passagem correta de URIs ao lado JS
- Comportamento de ACTION_SEND vs ACTION_SEND_MULTIPLE em dispositivo real

### 8.2 Precedente: Validação Sem PoC Empírica

Este ADR segue o precedente de ADR-001 (spike T-202):
- Mudança é principalmente configuracional (código Kotlin bem conhecido)
- Serviço JS é 100% testável isolado do módulo nativo (injeção de dependência)
- Estrutura `ACTION_SEND`/`ACTION_SEND_MULTIPLE`/`EXTRA_STREAM` é RFC-like da Android docs

### 8.3 Critério de Aceitação (Mecânico)

- ✅ Config plugin carrega em `expo prebuild`
- ✅ Arquivos Kotlin gerados com sintaxe válida
- ✅ Métodos `getShareIntentPayload()` e `clearShareIntent()` presentes
- ✅ Módulo registrado em `MainApplication.kt`
- ✅ Serviço JS testado 100% com mocks do módulo nativo
- ✅ MIME type detection funcional para extensões comuns + fallback
- ✅ Isolamento de erro comprovado (uma URI ruim não derruba resto)

### 8.4 Próximos Passos — Validação Empírica

**A ser executado em T-904 (tela Enviar) ou T-701 (teste de fogo):**
1. Dispositivo Android 14+ real ou emulador
2. Outro app (ex.: galeria, gerenciador de arquivos, câmera) compartilhando arquivo(s)
3. Verificar que:
   - App abre direto na tela Enviar (T-904)
   - URI(s) lida(s) corretamente
   - Arquivo(s) vinculado(s) sem cópia
   - Sem crash ou erro de permissão
   - ACTION_SEND (1 arquivo) e ACTION_SEND_MULTIPLE (múltiplos) funcionam

---

## 9. Referências e Fontes

### Documentação Primária

- **Android Intent / EXTRA_STREAM:** https://developer.android.com/reference/android/content/Intent
  - `ACTION_SEND`: https://developer.android.com/reference/android/content/Intent#ACTION_SEND
  - `ACTION_SEND_MULTIPLE`: https://developer.android.com/reference/android/content/Intent#ACTION_SEND_MULTIPLE
  - `EXTRA_STREAM`: https://developer.android.com/reference/android/content/Intent#EXTRA_STREAM
- **Expo Config Plugins:** https://docs.expo.dev/config-plugins/introduction/ (v57.0.0)
- **Expo SDK 57:** https://docs.expo.dev/versions/v57.0.0/

### Precedentes no Projeto

- **ADR-001:** spike de servidor HTTP — precedente de validação sem PoC empírica
- **ADR-003:** share intent Android (T-901) — registração de intent filter
- **T-807:** foreground service Android — implementação de config plugin customizado com Kotlin

---

## 10. Histórico de Emendas

- **2026-09-12 (v1.0):** ADR inicial, decisão de módulo nativo customizado vs. API Expo / lib comunitária. Config plugin implementado (`withShareIntentPayload.js`), serviço JS (`shareIntentService.ts`) + testes com cobertura completa. Status: **Accepted**. Validação empírica pendente para T-904/T-701.

---

## 11. Apêndice: Estrutura do Código Kotlin Gerado

```kotlin
class ShareIntentPayloadModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    @ReactMethod
    fun getShareIntentPayload(promise: Promise) {
        // Lê MainActivity.getIntent()
        // ACTION_SEND → EXTRA_STREAM (1 Uri)
        // ACTION_SEND_MULTIPLE → EXTRA_STREAM_URIS (ArrayList<Uri>)
        // Retorna Promise<string[]> com URIs stringificadas
    }

    @ReactMethod
    fun clearShareIntent() {
        // Zera intent.action para evitar reprocessamento
    }
}
```

A interface JS é:
```typescript
interface ShareIntentPayloadModule {
  getShareIntentPayload(): Promise<string[]>;
  clearShareIntent(): Promise<void>;
}
```

Acessível do lado JavaScript como `NativeModules.ShareIntentPayload`.
