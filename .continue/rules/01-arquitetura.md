---
name: Arquitetura do projeto
alwaysApply: true
description: Estrutura de pastas, convenções de código e limites entre features do Transfer Files.
---

# Transfer Files — Arquitetura

App React Native (Expo) com arquitetura **feature-first**:

- Código novo vai em `src/features/<feature>/` ou `src/shared/`.
- Uma feature **nunca** importa de outra feature.
- `shared/` **nunca** importa de `features/`.
- Reutilize tipos de `shared/types`, utilitários de `shared/lib` e componentes de `shared/components` antes de criar algo novo.

## Convenções inegociáveis

- TypeScript estrito; `any` é proibido — use `unknown` + narrowing.
- Estilização apenas via NativeWind (`className`), com tokens de `tailwind.config.js`. Sem `StyleSheet.create` ou valores mágicos.
- Componentes de UI não contêm lógica de rede/filesystem — isso vive em `services/`, consumido via hooks.
- Lógica de negócio como função pura ou serviço injetável (dependências de rede/filesystem/relógio sempre injetadas, para permitir mocks em teste).
- Payloads de API sempre validados em runtime com os schemas Zod de `shared/types/api.ts`.
- Uploads: sanitização de nomes e escrita restrita ao sandbox — nunca relaxe isso.

Essas regras vêm da constituição do projeto (`constitution.md`) — veja a regra "Fontes de documentação" para onde encontrar a versão completa.
