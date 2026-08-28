---
name: Fluxo git das tarefas
alwaysApply: true
description: Convenção de branches, commits e PRs usada por implementador, testador e validador.
---

# Fluxo git (constituição §5)

- Toda tarefa vive numa branch própria criada a partir de `develop`: `feat/t-xxx-<descricao-curta>` (ou `fix/`, `chore/`, `docs/` conforme o tipo da tarefa).
- Commits em Conventional Commits, com escopo da feature (ex.: `feat(server): adiciona máquina de estados do servidor`).
- Commits de uma tarefa vão **exclusivamente** para a branch dessa tarefa — nunca em `main`, `develop` ou branch de outra tarefa.
- PRs sempre apontam para `develop`, nunca para `main`.
- Nenhum commit deve tocar arquivos fora do escopo da tarefa sem justificativa explícita no PR.
- O merge (squash) só acontece depois que a tarefa for aprovada pelo validador, e é feito pelo usuário — não pelo agente.
