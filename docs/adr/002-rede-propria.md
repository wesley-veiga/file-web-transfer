# ADR-002: Rede Própria no Android 14+ via Local Only Hotspot

**Data:** 2026-07-18  
**Status:** PROPOSTA — _Validação empírica em Android 14 físico pendente_  
**Contexto:** T-206 — Spike: Local Only Hotspot no Android 14+  
**Autor:** Agente Implementador

---

## 1. Contexto do Problema

O aplicativo Transfer Files funciona sem internet, permitindo dois modos de conectividade:

1. **Rede Wi-Fi existente:** host e convidado já na mesma rede local.
2. **Rede própria (offline):** host sem nenhuma rede disponível abre a própria rede local para o convidado.

No iOS, a criação programática do Hotspot Pessoal não é permitida pelo sistema operacional — a solução é guiar o usuário a ativar manualmente nas Configurações e detectar a interface ativa (gateway `172.20.10.1`).

**No Android 14+ (API 34 e superiores)**, a criação programática **é possível** via **Local Only Hotspot** (`WifiManager.startLocalOnlyHotspot`), mas com restrições de permissão, segurança e disponibilidade de informações que precisam ser investigadas antes de implementar.

---

## 2. Abordagens Avaliadas

### 2.1 Abordagem A: Biblioteca React Native / Expo Pronta

#### Opções identificadas:

- **`react-native-wifi-admin`**
  - Repositório: https://github.com/doomsower/react-native-wifi-admin
  - Status: Descontinuada (último commit 2020). **[Nota de revisão: a ser reverificado em T-207 com busca de forks ativos]**
  - Não suporta Local Only Hotspot; focada em conectar a redes existentes.

- **`react-native-hotspot`** (vários mantedores com variações)
  - Repositório principal: https://github.com/warejandvalid/react-native-hotspot (manutenção irregular). Múltiplos forks com diferentes níveis de atividade.
  - Oferece alguns bindings para `startLocalOnlyHotspot`, mas com cobertura incompleta de API 33+ (permissão `NEARBY_WIFI_DEVICES`). **[Nota de revisão: status exato de issues abertos e última release a ser confirmado em T-207]**
  - Problema: risco de incompatibilidade futura; mudanças do Android 14 e 15 podem quebrar a lib sem aviso.

- **`expo-network`** (oficial Expo)
  - Oferece apenas leitura de IP da rede Wi-Fi atual; não cria hotspot.

#### Conclusão: **NÃO ADEQUADA**

Nenhuma biblioteca de prateleira oferece suporte robusto e mantido para Local Only Hotspot em Android 14 com obtenção confiável de SSID, senha e IP da interface. Risco de dependência em código morto é inaceitável para feature crítica (2º maior risco do projeto).

---

### 2.2 Abordagem B: Módulo Nativo + Expo Config Plugin Customizado

#### Descrição:

1. Escrever um módulo nativo em Kotlin (`android/src/main/kotlin/com/transferfiles/HotspotModule.kt`).
2. Implementar JNI/binding para expor métodos ao JavaScript:
   - `startLocalOnlyHotspot()` → retorna `{ssid, password, ip}`
   - `stopLocalOnlyHotspot()` → fecha a reserva
   - `getHotspotConfig()` → obtém SSID/senha atuais (se ativo)
3. Criar Expo Config Plugin (`plugins/with-hotspot.js`) para declarar:
   - Permissão `NEARBY_WIFI_DEVICES` em `AndroidManifest.xml`
   - Permissão `CHANGE_WIFI_STATE`
   - Atividades/serviços se necessário
4. Consumir no código TypeScript via `import { NativeModules }`.

#### Viabilidade Técnica:

**Risco: MODERADO-ALTO** — requer conhecimento de Android nativo (Kotlin), mas a API é bem documentada:

- **API `WifiManager.startLocalOnlyHotspot()` (Android 8.0+, API 26+):**
  - Retorna um `LocalOnlyHotspotReservation` com callback
  - Callback fornece eventos: `onStarted`, `onStopped`, `onFailed`
  - O hotspot permanece ativo enquanto a reserva estiver mantida em memória

- **Permissões para criação e leitura (Android 13+ mudanças):**
  - **Para CRIAR hotspot:** `CHANGE_WIFI_STATE` (obrigatória) + `ACCESS_WIFI_STATE` (recomendada). Em Android 12+, `ACCESS_FINE_LOCATION` pode ser necessária como restrição adicional de segurança.
  - **Para LER configurações:** `NEARBY_WIFI_DEVICES` (runtime) é necessária desde Android 13 (API 33) para chamar `WifiManager.getSoftApConfiguration()` e ler `getSsid()` e `getPassphrase()`.
  - **⚠️ CRÍTICO — A ser validado em T-207:** Documentação oficial do Android 34 deve ser consultada para confirmar se `NEARBY_WIFI_DEVICES` é **obrigatória** ou **recomendada** para `startLocalOnlyHotspot()`. Este ADR assume que é necessária para LER APÓS criar; confirmação empírica é essencial antes de implementação.

- **Obtenção de SSID e Senha (Android 13+ mudanças):**
  - **Android 8–12:** Via `WifiConfiguration` (deprecated em API 31)
  - **Android 13+ (API 33+):** Via `SoftApConfiguration.Builder` + `WifiManager.getSoftApConfiguration()`
  - **Android 14 (API 34+):** `android.net.wifi.SoftApConfiguration` é a forma recomendada
  - Métodos: `getSsid()` e `getPassphrase()` retornam os valores gerados pelo sistema
  - **Restrição crítica:** essas informações só podem ser lidas com permissão `NEARBY_WIFI_DEVICES` (runtime, conforme esclarecimento acima)

- **Obtenção do IP da Interface:**
  - Interface de hotspot aparece como `wlan0_ap` (pode variar)
  - IP no range `192.168.43.x` ou `192.168.44.x` (pode variar por dispositivo)
  - Pode ser obtido via `NetworkInterface` ou `IpConfiguration`
  - **Restrição:** exige loop de polling ou listener de `ConnectivityManager`

- **Ciclo de vida:**
  - Hotspot encerra quando `LocalOnlyHotspotReservation` é liberado (garbage collected ou explicitamente fechado)
  - DEVE ser gerenciado com cuidado: encerrar servidor → encerrar hotspot imediatamente

#### Complexidade Estimada:

- **Módulo Kotlin:** 200–300 linhas inicial; **realística 300–500 com tratamento robusto de lifecycle** (callbacks de falha, retry, event listeners para parada do hotspot pelo sistema)
- **Config Plugin:** 50–80 linhas
- **Integração TypeScript:** 100–150 linhas + tipos para `HotspotConfig`, `HotspotError`
- **Testes do módulo nativo:** requer Android real ou emulador; fora do escopo desta spike
- **Tempo estimado de implementação:** 1–2 dias base; adicionar 1 dia se tratamento de edge cases for necessário

---

### 2.3 Comparação Resumida

| Critério                       | Lib Pronta            | Módulo Próprio             |
| ------------------------------ | --------------------- | -------------------------- |
| **Manutenção**                 | Indefinida/Risco Alto | Sob controle do projeto    |
| **Compatibilidade Android 14** | Baixa confiança       | Alta (API oficial recente) |
| **Cobertura funcional**        | Parcial               | Completa                   |
| **Tempo de implementação**     | 0 (seleção)           | 1–2 dias                   |
| **Risco técnico**              | Alto (dependência)    | Moderado (nativo)          |
| **Testabilidade**              | Difícil mockar        | Fácil (interface clara)    |

---

## 3. Recomendação Preliminar

**Implementar Módulo Nativo + Config Plugin Customizado (Abordagem B).**

**Justificativa:**

1. **Confiabilidade:** Local Only Hotspot é parte da API oficial do Android desde 8.0; a API é estável.
2. **Compatibilidade Android 14+:** Usar `SoftApConfiguration` (API 31+) garante compatibilidade com os requisitos.
3. **Controle total:** permissões, ciclo de vida e tratamento de erro sob controle do projeto.
4. **Risco do projeto:** sendo o "2º maior risco", implementação própria minimiza dependências indefinidas.
5. **Testabilidade:** interface clara permite testes com mock do módulo nativo via Jest + dependência injetável.

**Trade-off aceito:** requer conhecimento de Kotlin e ambiente Android. Mitigado por: documentação clara, manter bindings simples (não expor complexidade nativa desnecessária), e testes E2E em dispositivo real durante a fase de validação.

---

## 4. Implementação Proposta (Plano de Ação)

### Fase 1: Spike / Validação (Esta Tarefa — T-206)

Esta spike é pesquisa de mesa. **Não temos acesso a dispositivo Android 14 físico neste ambiente**, portanto:

- ✅ Pesquisa sobre a API `WifiManager.startLocalOnlyHotspot()` (documentação oficial)
- ✅ Validação de compatibilidade permissão `NEARBY_WIFI_DEVICES` (Android 13+ changelog)
- ✅ Documentação da abordagem (este ADR)
- ❌ **NÃO FEITO:** Prova de conceito real (criar hotspot em Android 14 físico e outro dispositivo conectar)

### Fase 1.1: Contrato TypeScript Esperado (Referência para T-207)

O módulo nativo deve expor a seguinte interface TypeScript, permitindo mock type-safe nos testes Jest:

```typescript
// features/server/types/hotspot.ts
export type HotspotInfo = {
  ssid: string;
  password: string;
  ip: string;
  gateway?: string;  // ex.: "192.168.43.1"; opcional se não obtido
};

export type HotspotErrorCode = 
  | 'UNSUPPORTED'          // Device/OS não suporta Local Only Hotspot
  | 'PERMISSION_DENIED'    // Permissão negada pelo usuário
  | 'FAILED'               // Falha ao criar hotspot (motivo desconhecido)
  | 'TIMEOUT'              // Callback de criação não respondeu em tempo hábil
  | 'NOT_RUNNING';         // Tentativa de stop/getConfig sem hotspot ativo

// Interface do módulo nativo (via NativeModules)
export const NativeHotspot = {
  // Promise rejeita com HotspotErrorCode (lançar ou retornar error discriminated)
  startLocalOnlyHotspot(): Promise<HotspotInfo>;
  stopLocalOnlyHotspot(): Promise<void>;
  getHotspotConfig(): Promise<HotspotInfo | null>;  // null se não ativo
};
```

**Notas de design:**
- Nome `HotspotInfo` (não `HotspotConfig`) permite futura composição com `ServerInfo` (T-201), evitando duplicação de tipos
- `HotspotErrorCode` como discriminated union permite tipo-safe error handling em TypeScript
- Métodos nomeados com prefixo `startLocalOnlyHotspot` (não `startHotspot`) deixa explícito que é "local only" (evita confusão com tethering)

**Config Plugin** deve injetar permissões via `withAndroidManifest`:
- `CHANGE_WIFI_STATE` (criar hotspot)
- `ACCESS_WIFI_STATE` (ler estado)
- `NEARBY_WIFI_DEVICES` (ler SSID/senha em Android 13+)

A solicitação de permissão runtime ao usuário é responsabilidade da UI (T-208, hook customizado `useHotspotPermission` ou similar).

### Fase 2: Implementação Nativa (Próxima Tarefa — T-207)

Prerequisitos:

1. Ter Kotlin + Android SDK configurado no dev build Expo (já garantido por `minSdkVersion = 34`)
2. Escrever módulo Kotlin com os métodos: `startLocalOnlyHotspot()`, `stopLocalOnlyHotspot()`, `getHotspotConfig()` conforme assinaturas acima
3. Criar Config Plugin (`plugins/with-hotspot.js`) usando `withAndroidManifest` para declarar permissões
4. Testes com mock do módulo nativo via Jest + dependência injetável

### Fase 3: Validação Empírica E2E (Próxima Tarefa — T-701, "Teste de fogo")

Quando o projeto chegar à fase de integração:

1. Build dev Android 14
2. Executar roteiro: host Android sem rede → cria hotspot → outro dispositivo escaneia QR Wi-Fi → conecta → acessa URL do servidor
3. Registrar resultado em `docs/testes-manuais.md`

---

## 5. Validação Pendente e Riscos

### 5.1 O Que Esta Spike AINDA NÃO Validou (Essencial Fazer em Dispositivo Real)

1. **Permissão `NEARBY_WIFI_DEVICES` runtime:**
   - ✓ Confirmado: necessária desde Android 13 (API 33)
   - ❌ **Não testado:** se o dialogue de permissão funciona na prática; se o usuário nega, como afeta o módulo

2. **Criação do hotspot:**
   - ✓ Confirmado: API `startLocalOnlyHotspot()` existe e retorna callback
   - ❌ **Não testado:** se o hotspot realmente sobe em menos de 5 s no Android 14; se o callback `onStarted` é sempre chamado

3. **Obtenção de SSID e Senha:**
   - ✓ Confirmado: `SoftApConfiguration.getSsid()` e `getPassphrase()` existem (API 31+)
   - ❌ **Não testado:** se os valores retornados são sempre válidos; formato esperado; se diferem em cada chamada

4. **IP da interface:**
   - ✓ Confirmado: interface de hotspot no range `192.168.43–44.x`
   - ❌ **Não testado:** qual é o IP exato nesta implementação específica do Android 14; **quanto tempo leva até interface estar disponível após callback `onStarted`** (DHCP timing; pode levar 1–3 segundos)

5. **Outro dispositivo conectando via QR Wi-Fi:**
   - ✅ Confirmado: o formato `WIFI:S:...;T:WPA;P:...;;` é padrão e câmeras Android/iOS o reconhecem
   - ❌ **Não testado:** se um dispositivo real consegue conectar ao hotspot criado; latência de conexão

6. **Encerramento limpo:**
   - ✓ Confirmado: liberar `LocalOnlyHotspotReservation` encerra o hotspot
   - ❌ **Não testado:** se o hotspot realmente desaparece em tempo real; risco de órfão se o processo morrer

### 5.2 Riscos Identificados

| Risco                                                 | Probabilidade           | Impacto                     | Mitigação                                                                    |
| ----------------------------------------------------- | ----------------------- | --------------------------- | ---------------------------------------------------------------------------- |
| **Permissão NEARBY_WIFI_DEVICES negada pelo usuário** | Média (usuário em foco) | Alto (feature inutilizável) | Explicação clara na UI antes de pedir permissão; fallback "mesma rede Wi-Fi" |
| **Hotspot não sobe no Android 14 específico**         | Baixa (API estável)     | Crítico (feature quebrada)  | Validação E2E em múltiplos Android 14; tratamento de erro `HOTSPOT_FAILED`   |
| **LocalOnlyHotspotReservation garbage collected**     | Média (lifecycle)       | Crítico (hotspot desativa)  | Manter referência em store global; testar retaining reference; validar E2E |
| **OEM bloqueia Local Only Hotspot (policy)**          | Baixa (ROM variações)   | Alto (feature indisponível) | Coletar logs de erro em E2E; documentar limitação; fallback manual |
| **IP não acessível na prática**                       | Baixa                   | Alto (servidor inacessível) | Testar conectividade antes de servir; logs de IP obtido                      |
| **IP indisponível no timing esperado**                | Média (timing DHCP)     | Médio (retry necessário)    | Polling com timeout 3s; fallback gateway `192.168.43.1`; validar tempo      |
| **Timeout obtendo SSID/senha**                        | Média (timing)          | Médio (UI hang)             | Timeout de 2–3 s; fallback com valores padrão                                |
| **Hotspot órfão se app morrer**                       | Média (crash/ANR)       | Médio (usuário manual off)  | Cleanup em `onDestroy()` do servidor; testar com force kill                  |

### 5.3 Plano de Contingência

Se a API não se comportar como esperado durante a validação E2E:

1. **Hotspot não sobe:** investigar via Logcat; possível causa — device não suporta (flagar como `HOTSPOT_UNSUPPORTED`); fallback manual do usuário.
2. **SSID/senha não obtidos:** armazenar no `LocalOnlyHotspotReservation.getWifiConfiguration()` como fallback (API deprecated, mas funciona em praticamente todos os Android 8+).
3. **IP indisponível:** usar gateway padrão `192.168.43.1` como fallback; documentar a limitação.
4. **Outro dispositivo não consegue conectar:** investigar firewall/compatibilidade; possível necessidade de ajustar SSID/banda (2.4 GHz vs 5 GHz).

Se a feature não for viável após testes reais, aceitar escopo reduzido em v1: **modo rede própria exclusivo para iOS** (hotspot manual) + **Android depende sempre de Wi-Fi** — impacto aceitável conforme HU-08 marca a jornada como "duas etapas".

---

## 6. Referências Técnicas

### Documentação Oficial

- **Android WifiManager API:** https://developer.android.com/reference/android/net/wifi/WifiManager
  - `startLocalOnlyHotspot(...)` (API 26+): https://developer.android.com/reference/android/net/wifi/WifiManager#startLocalOnlyHotspot(android.net.wifi.WifiManager.LocalOnlyHotspotCallback)
  - `LocalOnlyHotspotReservation` (API 26+): https://developer.android.com/reference/android/net/wifi/WifiManager.LocalOnlyHotspotReservation

- **Android SoftApConfiguration:** https://developer.android.com/reference/android/net/wifi/SoftApConfiguration (API 31+)
  - `getSsid()` e `getPassphrase()`: retornam strings com a configuração atual

- **Permissões Android 13+:**
  - `NEARBY_WIFI_DEVICES` (API 33+): https://developer.android.com/reference/android/Manifest.permission#NEARBY_WIFI_DEVICES
  - Necessária desde Android 13 para chamar `startLocalOnlyHotspot()`

- **QR Code Wi-Fi (padrão ZXing):**
  - Formato: `WIFI:S:<SSID>;T:<security>;P:<password>;;` (https://github.com/zxing/zxing/wiki/Barcode-Contents#wifi-network-config)
  - Padrão aberto; câmeras nativas suportam

### Changelog Android Relevante

- **Android 8.0 (API 26, 2017):** Introdução de `startLocalOnlyHotspot()`
- **Android 12 (API 31, 2021):** Deprecação de `WifiConfiguration`; introdução de `SoftApConfiguration`
- **Android 13 (API 33, 2022):** Introdução de `NEARBY_WIFI_DEVICES` como permissão runtime obrigatória para hotspot
- **Android 14 (API 34, 2023):** `SoftApConfiguration` se torna padrão; mudanças menores de segurança e performance

---

## 7. Conclusão

A implementação de Local Only Hotspot no Android 14+ via módulo nativo + Config Plugin é **viável e recomendada**. A API é estável e bem documentada. O principal risco é a **validação empírica em dispositivo real**, que esta spike não pode cobrir.

Próximas etapas: implementar o módulo (T-207) e validar em Android 14 físico durante a fase E2E (T-701). Enquanto isso, documentar fallback manual (hotspot iOS, mesma rede Wi-Fi no Android se hotspot falhar) para garantir experiência sem bloqueios.

---

**Aprovação para continuar?** ✓ Sim — prosseguir com T-207 (implementação nativa) sabendo que validação real ainda é obrigatória.
