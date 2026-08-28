---
name: Fontes de documentação
alwaysApply: true
description: Onde consultar a spec, as tarefas, a constituição e a documentação externa do Expo antes de gerar código.
---

# Documentação a consultar

## Documentação interna (fonte da verdade deste repositório)

- `tarefas.md` — lista de tarefas (ex.: `T-203`), dependências e critério "Pronto quando". Sempre releia a tarefa e suas dependências antes de implementar, testar ou validar.
- `transferir.md` — spec do produto: histórias de usuário, contratos de API, critérios de aceite. O comportamento implementado precisa corresponder exatamente ao que está aqui.
- `constitution.md` — princípios não negociáveis do projeto (tipagem, estilização, boundaries de arquitetura, testes, fluxo git). Qualquer sugestão de código deve respeitar esses princípios.

Cite esses arquivos (com trecho relevante) ao explicar por que uma implementação segue — ou se desvia de — a spec.

## Documentação externa

- **Expo mudou de versão.** Antes de sugerir qualquer API do Expo, consulte a documentação versionada exata em https://docs.expo.dev/versions/v57.0.0/ — não confie em conhecimento genérico/desatualizado sobre Expo.
- React Native: https://reactnative.dev/docs/getting-started
- Zod (validação de payloads): https://zod.dev
- NativeWind (estilização): https://www.nativewind.dev/
