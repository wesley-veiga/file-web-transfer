---
name: atualizar-prs
description: Atualiza PRs abertos de tarefa (feat/fix/chore/docs de T-xxx) que ficaram desatualizados em relação a develop, evitando conflitos de merge quando várias tarefas rodam em paralelo. Usar sempre depois de mesclar qualquer PR em develop, ou periodicamente enquanto houver mais de um PR de tarefa aberto ao mesmo tempo.
---

# Atualizar PRs desatualizados

Quando várias tarefas do `tarefas.md` são implementadas em paralelo (branches irmãs `[P]` da mesma fase), cada PR nasce a partir do `develop` do momento. Assim que **qualquer um** deles é mesclado, todos os outros PRs abertos ficam um commit atrás — o risco de conflito cresce a cada merge subsequente. Esta skill existe para manter isso sob controle sem depender de lembrar manualmente.

**Nunca faz squash/merge de PR de tarefa** — isso continua exigindo veredito **APROVADA** do agente `validador` e é feito pelo orquestrador/usuário separadamente. Esta skill só mantém os PRs **atualizáveis**, não os aprova nem os mescla.

## Passos

1. `git fetch origin` e `git checkout develop && git pull --ff-only`.
2. `gh pr list --state open --json number,title,headRefName,baseRefName,mergeable,mergeStateStatus` — listar todos os PRs abertos com base `develop`.
3. Para cada PR cujo `mergeStateStatus` seja `BEHIND` ou `mergeable` seja `CONFLICTING`:
   - `git fetch origin <headRefName> && git checkout <headRefName>`.
   - `git merge origin/develop` (merge simples, não rebase — a branch pode já ter sido usada por um agente `testador`/`validador` em outra sessão; rebase reescreveria commits que talvez já tenham sido lidos/referenciados em review).
   - Se o merge for automático (sem conflito): rodar `npx tsc --noEmit && npm run lint && npm test -- --coverage` para confirmar que a branch ainda passa depois do merge; `git push`.
   - Se houver conflito: **não resolver sozinho o conteúdo de produção** — isso é trabalho do `implementador` da tarefa (pode exigir uma decisão sobre qual versão de um tipo/serviço compartilhado prevalece). Reportar o PR e os arquivos em conflito; delegar a resolução a um agente `implementador` com o contexto específico do conflito, ou parar e perguntar ao usuário se a tarefa é pequena o suficiente para ele decidir na hora.
4. Voltar para `develop` (`git checkout develop`) antes de processar o próximo PR, para começar cada checagem de um estado limpo.
5. Reportar ao final: PRs que estavam atualizados (nada feito), PRs atualizados com sucesso (push feito), PRs com conflito real (delegados/pendentes), e qualquer PR cuja branch não seguia o padrão `feat/fix/chore/docs/t-xxx` (reportar, não mexer).

## Regras

- Um agente por branch por vez — nunca rodar esta skill em paralelo com um `implementador`/`testador` que ainda esteja com commits pendentes na mesma branch.
- Se `gh` não estiver autenticado (`gh auth status` falha), instruir o usuário a rodar `gh auth login` e parar.
- Merge de `develop` para dentro da branch da tarefa é sempre aceitável (histórico da branch de tarefa é descartável, ninguém mais depende dela); o inverso — merge da branch de tarefa para `develop` — nunca acontece aqui, é sempre via PR + squash.
