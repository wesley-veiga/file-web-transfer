# ADR 001 — Escolha da Biblioteca de Servidor HTTP Embarcado

**Status:** Proposed (validação empírica pendente)
**Data:** 2026-07-18
**Autores:** Transfer Files Project

---

## 1. Contexto

O Transfer Files precisa de um **servidor HTTP embarcado** que rode nativamente em um dispositivo mobile (React Native / Expo) para:

1. Servir uma interface web estática (página HTML/CSS/JS autocontida)
2. Implementar rotas de API (GET/POST) para:
   - Listagem de arquivos (`GET /api/files`)
   - Upload multipart de arquivos com streaming (`POST /api/upload`)
   - Download de arquivos com streaming (`GET /api/files/:id/download`)
   - Polling de eventos (`GET /api/events`)
   - Informações da sessão (`GET /api/session`)

### Requisitos Críticos

1. **Upload de arquivos grandes (≥ 1 GB) com streaming:** nunca carregar o arquivo inteiro em memória; processar por chunks
2. **Suporte multipart/form-data:** parser robusto de requests multipart
3. **Compatibilidade dual:** funcionar em **Android (API 34+)** e **iOS** (versão mínima definida pelo Expo)
4. **Rede local apenas:** operação sem internet; suporte para Wi-Fi local e hotspot local (Local Only Hotspot no Android)
5. **Desempenho:** iniciar em < 2 segundos; não bloquear a thread JavaScript
6. **Manutenção ativa:** biblioteca com suporte contínuo e comunidade (risco crítico no prazo de um spike de 1 dia)

---

## 2. Alternativas Avaliadas

### 2.1 `react-native-http-bridge-refurbished`

#### O que é
- Bifurcação/restauração da biblioteca `react-native-http-bridge` original, que foi descontinuada há anos
- Módulo nativo que expõe um servidor HTTP simples, escrito em Swift (iOS) e Java (Android)
- Permite registrar "rotas" simples via JavaScript e responder a requests

#### Prós
- **Streaming de upload nativo:** o módulo nativo processa o corpo do request chunk-by-chunk; a camada JS recebe eventos de chunk, nunca o corpo inteiro
- **Suporte multipart:** o iOS e Android implementam parsing de multipart nativamente via URLSession/HttpServer
- **Latência baixa:** I/O nativo não passa pela bridge de React Native; streaming é eficiente
- **Compatibilidade estabelecida:** funciona em Expo com dev build (permissão de módulos nativos customizados)
- **Simplicidade conceitual:** abstração clara entre "app envia request" → "handler JS responde"

#### Contras / Riscos Conhecidos
- **Manutenção incerta:** `react-native-http-bridge-refurbished` é uma bifurcação comunitária, não oficial. O repositório original está inativo; não há garantia de que a bifurcação receberá updates críticos ou correções de segurança
- **Bugs de streaming em dispositivos antigos:** alguns relatos anedóticos (2022–2023) mencionam que em Android < 10 o handling de streams grandes pode ter memory leaks ou corromper dados; a bifurcação pode não ter backports de correções
- **Suporte multipart não completo em edge cases:** edge cases de RFC 2388 (multipart boundaries malformados, charset incomum) podem não ser cobertos; não está claro se a lib trata upload de arquivo com `Content-Length` ausente
- **API trívia com WebSocket:** a lib também expõe um servidor WebSocket; parte desnecessária que aumenta a superfície de bugs
- **Sem TLS/HTTPS nativo:** rede local não exige TLS, mas a ausência dificulta futura adição de segurança (v1.1)
- **Documentação escassa:** a bifurcação herda documentação da lib original, que é minimal; exemplos de multipart/streaming são raros na comunidade
- **Versão da lib e compatibilidade com New Architecture:** React Native New Architecture (JSI) está sendo adotado; não é claro se a lib foi testada com New Architecture ou se terá suporte em futuro próximo

#### Prova de Conceito (antes desta spike)
- Nenhuma. A comunidade não publicou benchmarks recentes (2024+) sobre throughput de upload 1GB em Android 14 / iOS 17+

### 2.2 Implementação Própria sobre TCP Socket

#### O que é
- Usar `react-native-tcp-socket` (lib comunitária mantida) ou módulo nativo customizado para criar um socket TCP na porta 8080
- Implementar parser HTTP 1.1 manualmente em JavaScript (parsear request line, headers, body)
- Implementar parser multipart manualmente (parsear boundaries, chunks, Content-Disposition, etc.)

#### Prós
- **Controle total:** o parsing é feito em código JS, inspecionável e debugável
- **Compatibilidade sem surpresas:** não depender de bifurcação comunitária de lib descontinuada
- **Flexibilidade:** adicionar recursos (WebSocket, HTTPS, custom handlers) é apenas estender o parser
- **Sem overhead nativo:** parsing em JS puro é mais simples de debugar e mockar em testes

#### Contras / Riscos Conhecidos
- **Implementação complexa:** parsear HTTP 1.1 com streaming multipart corretamente é **complexo e propenso a bugs**:
  - RFC 7230 (HTTP 1.1) cobre edge cases: conexões persistentes, Transfer-Encoding: chunked, Content-Length vs. chunked (mutualmente exclusivas)
  - RFC 2388 (multipart/form-data) é ambíguo em alguns pontos; implementações variam (ex.: linha vazia antes/depois de boundary)
  - Handling de conexão aberta: o parser precisa detectar quando o cliente encerrou o request (via Content-Length ou chunked) sem descartar a parte de dados subsequente
- **Performance:** parser em JS é **significativamente mais lento** que parser nativo; em upload de 1GB, o overhead de processamento em JS pode ser notável
- **Memória intermediária:** mesmo com streaming, precisamos bufferizar headers (Content-Disposition, nome de arquivo, etc.); se o header for grande (nomes de arquivo muito longos), pode causar problemas
- **Timeout e keep-alive:** HTTP 1.1 permite conexões persistentes; implementar keep-alive, timeout, pipeline corretamente é complexo
- **Thread JS:** React Native tem uma única thread JS; I/O nativo (socket.read) precisa ser não-bloqueante (promessas/callbacks); qualquer stall no parser bloqueia a UI
- **Custo de desenvolvimento:** de 3 a 7 dias para implementar um parser multipart robusto + testes abrangentes (não cabe no timebox de 1 dia do spike)
- **Segurança:** parser implementado internamente é mais propenso a vulnerabilidades (ex.: Billion Laughs attack em parsing XML-like, aqui em multipart; path traversal se sanitização estiver errada)

#### Prova de Conceito (antes desta spike)
- Nenhuma. Nenhum projeto público React Native usa essa abordagem; maioria opta por lib pronta ou servidor backend separado

### 2.3 Alternativas Descartadas (breve)

**`expo-http-server` (conceitual):**
- Não existe oficialmente em `expo/*`. Expo não fornece uma lib de servidor embarcado; foco é em cliente HTTP.

**`@react-native-community/http-server-bridge` ou similares:**
- Buscas em npm (2024–2025) retornam poucos resultados; libs com nomes similares estão descontinuadas ou nunca foram publicadas.

**Módulo nativo customizado (Swift/Java puro):**
- Fora do escopo de um spike de 1 dia; exigiria estrutura de build complicada e duas implementações (iOS + Android). A alternativa `react-native-http-bridge-refurbished` já fornece isso pronto (ainda que com incertezas de manutenção).

---

## 3. Análise Comparativa

| Critério | `react-native-http-bridge-refurbished` | TCP Socket + Implementação Própria |
|---|---|---|
| **Streaming de upload 1GB** | Nativo (rápido, não bufferiza); suportado em princípio | Possível, mas overhead JS; risco de stall |
| **Multipart parsing** | Implementado em iOS/Android nativo | Implementação manual em JS; complexo |
| **Tempo até produção** | ~3 dias: integração, testes, PoC em device | 7+ dias: implementação + testes + PoC |
| **Manutenção a longo prazo** | Risco: bifurcação comunitária inativa | Risco: código proprietary, sem comunidade |
| **Compatibilidade Expo** | Confirmado (usa dev build) | Confirmado (tcp-socket tem suporte) |
| **Suporte Android 14+** | Previsto (API nativa 1.1); não testado | Previsto (sockets não mudaram) |
| **Suporte iOS** | Previsto (URLSession nativa); não testado | Confirmado (TCP funciona em iOS) |
| **Performance (overhead)** | Baixo (nativo) | Médio-Alto (JS) |
| **Debugabilidade** | Média (código nativo opaco) | Alta (código JS transparente) |
| **Risco de bugs críticos** | Médio (bifurcação inativa) | Alto (implementação complexa) |

---

## 4. Decisão Preliminar

### Recomendação: **Usar `react-native-http-bridge-refurbished` como primeira escolha**

**Justificativa:**
1. Cumpre requisito crítico de streaming nativo; não há alternativa simples que o faça tão eficientemente em JS
2. Tempo até produção é aceitável dentro do sprint (3 dias: integração + testes + PoC básico)
3. Bifurcação comunitária é risco moderado, mas aceitável se PoC funciona bem em Android 14 / iOS reais
4. Parser nativo reduz superfície de bugs críticos (segurança, performance)

### Contingência: **Fallback para TCP Socket + lib pronta**

Se PoC com `react-native-http-bridge-refurbished` revelar problemas críticos (stream corrompe dados, memory leak, incompatibilidade com Expo dev build), pivot para:
- Usar `react-native-tcp-socket` (mantida, ~1k stars) como transporte
- Implementar parser HTTP/multipart **simplificado**: suportar apenas multipart com Content-Length (bloquear uploads com chunked), Content-Disposition com nomes ASCII (não UTF-8 complexo)
- Custo: adiciona 4 dias, mas aceitável se alternativa primária falhar

---

## 4.1 ANOTAÇÃO CRÍTICA DO REVISOR (2026-07-18)

⚠️ **Questão sobre a recomendação primária: a justificativa é suficiente dado os riscos documentados?**

A análise acima documenta adequadamente os riscos de `react-native-http-bridge-refurbished`, mas a recomendação de fazê-lo a **primeira escolha** é questionável pelos seguintes pontos:

1. **Estado de manutenção — achado empírico**: verificação de npm registra que `react-native-http-bridge-refurbished` teve seu último release em **janeiro de 2024** (v1.3.2), há 2.5 anos. Já `react-native-tcp-socket` teve atualização em **janeiro de 2026** (v6.4.1), bem mais recente. A alternativa "contingência" está **mais ativamente mantida** que a recomendação primária.

2. **Risco de dead-end da PoC**: se a PoC com HTTP Bridge falhar (memory leak, incompatibilidade New Architecture, etc.), a equipe perde ~3 dias e volta ao início, já que "contingência" exige 7+ dias. A inversão (começar com TCP socket, contingência é HTTP Bridge) não sofreria esse problema — pior caso, adiciona latência, não reduz a chance de sucesso.

3. **New Architecture (não quantificado)**: O ADR admite que "não é claro se a lib foi testada com New Architecture". Essa incerteza é grave — Expo está adotando New Architecture. Uma lib que pode não ser compatível é risco **estratégico** de longo prazo, não tático.

4. **Proposta alternativa para consideração**: Recomenda-se revisar a decisão após a PoC ser executada em AMBAS alternativas (não só a primária), ou revertê-la para "TCP socket + simplificado como primeira escolha" com "HTTP Bridge como contingência", dado que TCP socket está mais ativo no npm e o custo de fallback seria mais baixo.

---

---

## 5. Impacto nas Tarefas Subsequentes

- **T-203 (Serviço do servidor HTTP):** wrapper em `ServerService` que inicia a lib escolhida, abstrai a interface e permite injetar. Testes com mock da lib, não do servidor real.
- **T-401+ (API HTTP):** roteador simples sobre a lib; schemas Zod para validação runtime de payloads.
- **T-403 (upload POST):** camada de sanitização + anti-duplicata + streaming acima da lib; a lib entrega chunks, serviço valida e salva.

---

## 6. Validação Pendente ⚠️

**IMPORTANTE:** Esta spike foi executada como **pesquisa de mesa** (revisão de documentação, código público, issues de comunidade, conhecimento de domínio). **Nenhuma validação empírica em dispositivo real foi realizada.**

Para tornar esta decisão **definitiva**, o time DEVE realizar o seguinte **antes de prosseguir para T-203 e além:**

### 6.1 Prova de Conceito Medida (PoC)

#### Android 14 (obrigatório)

1. **Setup:** Device real ou emulador robusto (Pixel 6+ ou similar) com Android 14+.
2. **Implementação mínima:** criar app Expo dev build com `react-native-http-bridge-refurbished`; servir rota `POST /api/upload` que recebe arquivo multipart e escreve em `DocumentsDirectory`.
3. **Upload de teste:** gerar arquivo binário com:
   - **1 GB de tamanho** (ou máximo suportado se limite inferior, ex: 500 MB; documentar)
   - **Dados aleatórios** (não zeros compressíveis) para simular arquivo real
   - **Multipart/form-data** com campo `file`, nenhum outro campo
4. **Medições:**
   - **Throughput (MB/s):** transferência total / tempo total; esperar > 10 MB/s (razoável para USB/rede local)
   - **Pico de memória (MB):** usar DevTools Android ou app.memory profiler; esperar < 200 MB pico (não linear com tamanho de arquivo)
   - **CPU:** 20–60% durante transfer (não máximo sustentado)
   - **Comportamento com rede instável:** simular queda de conexão no meio; esperar graceful error handling, sem crash
5. **Sucesso:** arquivo salvo com checksum válido; memória não vazou; sem crash.
6. **Documentar:** resultado (passa/falha) + métricas em `docs/poc-uploads.md`.

#### iOS (obrigatório)

1. **Setup:** Device real (iPhone XS+) ou simulador macOS.
2. **Mesmo PoC:** app Expo, upload de 1 GB.
3. **Medições:** idem Android.
4. **Documentar:** resultado + métricas em `docs/poc-uploads.md`.

#### Fallback para TCP Socket (se PoC falha)

Se PoC revelar problema crítico (stream corrompe, memory leak, incompatibilidade Expo):
1. Repetir PoC com `react-native-tcp-socket` + parser HTTP simplificado.
2. Mesmas medições.
3. Documentar decisão de mudança + justificativa em `docs/adr/001-servidor-http.md` (emenda).

### 6.2 Critério de Aceitação (PoC)

- ✅ Arquivo de 1 GB transferido com sucesso (checksum válido)
- ✅ Pico de memória < 200 MB em ambas as plataformas
- ✅ Throughput > 10 MB/s (indicador de não-bloqueio)
- ✅ Sem crash durante ou após a transferência
- ✅ Queda de conexão resulta em erro tratado, não crash

### 6.3 Próximos Passos Imediatos

1. **Antes de T-203:** criar branch de PoC (`feat/t-202-poc-http-upload`) a partir desta spike
2. **PoC Android:** 1–2 dias (se houver device/emulador disponível)
3. **PoC iOS:** 1–2 dias
4. **Análise de resultados + decisão final:** 0,5 dia
5. **Amenda deste ADR:** documento atualizado com resultado + métrica, status muda de "Proposed" para "Accepted" ou "Rejected"

---

## 7. Referências e Fontes

### Documentação Primária
- **react-native-http-bridge-refurbished:** https://github.com/Doko-Demo-Doa/react-native-http-bridge-refurbished (GitHub, último commit 2023; bifurcação de react-native-http-bridge descontinuada em ~2018; última publicação npm v1.3.2 em 2024-01-24)
- **react-native-tcp-socket:** https://github.com/Rapsssito/react-native-tcp-socket (~1k stars; v6.4.1, última atualização npm em 2026-01-16)
- **RFC 7230 (HTTP 1.1):** https://tools.ietf.org/html/rfc7230
- **RFC 2388 (multipart/form-data):** https://tools.ietf.org/html/rfc2388

### Conhecimento de Domínio
- Experiência prévia com servidores embarcados em mobile (Node.js em mobile via módulos nativos, complexidade de streaming)
- Análise de issues abertas em libs de servidor HTTP (2024–2025): foco em bugs de memory leak em upload grande
- Avaliação de manutenção comunitária (frequência de releases, responsividade a issues, tamanho da comunidade)

**Nota de Data:** Este ADR foi escrito em 2026-07-18. Informações sobre bibliotecas refletem estado público até 2026-07 e conhecimento de corte até fevereiro de 2025.

---

## 8. Histórico de Emendas

- **2026-07-18 (v1.0):** ADR inicial, pesquisa de mesa, validação pendente explícita
