---
name: criar-pr
description: Cria o Pull Request de uma branch de tarefa (feat/t-xxx) para a branch develop do repositório wesley-veiga/file-web-transfer, com título Conventional Commits, corpo padronizado e checklist de validação. Usar quando implementação e testes de uma tarefa estiverem commitados na branch da tarefa.
---

# Criar PR de tarefa

Cria o Pull Request de uma tarefa do `tarefas.md` seguindo o fluxo da constituição (§5 — Versionamento e branches).

**Repositório:** `git@github.com:wesley-veiga/file-web-transfer.git` · **Base de todo PR de tarefa:** `develop`

## Pré-checagens (abortar com explicação se alguma falhar)

1. Branch atual segue o padrão `feat/t-xxx-*` (ou `fix/`, `chore/`, `docs/`, `test/`) — nunca criar PR a partir de `main` ou `develop`.
2. Working tree limpa (`git status`) — nada por commitar.
3. Verificações locais verdes: `npx tsc --noEmit`, `npm run lint`, `npm test -- --coverage` (pular as etapas que ainda não existirem no projeto, ex.: antes da T-003).
4. A tarefa correspondente existe em `tarefas.md`; extrair ID e título dela.

## Passos

1. `git push -u origin <branch>`.
2. Criar o PR com `gh pr create --base develop` usando:
   - **Título:** `<tipo>(<escopo>): T-XXX — <título da tarefa>` (ex.: `feat(server): T-203 — Serviço do servidor HTTP`).
   - **Corpo:** o template abaixo, preenchido.
3. Reportar a URL do PR e lembrar o próximo passo: rodar o agente `validador` sobre o PR (`validar T-XXX`). O merge (squash) só acontece após veredito APROVADA.

## Template do corpo do PR

```markdown
## Tarefa
T-XXX — <título> ([tarefas.md](../blob/develop/tarefas.md))

## Referências da spec
<HUs, endpoints e critérios de aceite de transferir.md cobertos por este PR>

## O que foi feito
- <resumo objetivo das mudanças>

## Como testar
- <passos para verificar localmente>

## Checklist (constituição)
- [ ] `tsc --noEmit` limpo
- [ ] `npm run lint` limpo
- [ ] Testes verdes com cobertura ≥ 90% (services/lib/store) e ≥ 80% global
- [ ] Toda função exportada nova tem teste
- [ ] Sem `any`, sem `console.log`, boundaries respeitados
- [ ] Commits apenas nesta branch, em Conventional Commits

## Validação
- [ ] ⏳ Aguardando veredito **APROVADA** do agente `validador` (registrado como review neste PR)

🤖 Generated with [Claude Code](https://claude.com/claude-code)
```

## Regras

- Um PR por tarefa; se a branch acumular trabalho de duas tarefas, abortar e pedir separação.
- Nunca usar `--base main` para PR de tarefa; `develop → main` é exclusivo de release e feito pelo usuário.
- Se `gh` não estiver autenticado (`gh auth status` falha), instruir o usuário a rodar `gh auth login` e parar.
