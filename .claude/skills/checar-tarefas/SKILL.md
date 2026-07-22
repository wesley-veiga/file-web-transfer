---
name: checar-tarefas
description: Audita tarefas.md em busca de tarefas concluídas (implementadas, testadas, aprovadas pelo validador e mescladas em develop) cujo checkbox ainda está `[ ]`, e abre um PR de housekeeping por tarefa encontrada para marcá-las `[x]`. Usar periodicamente ou depois de mesclar PRs de tarefas, para manter tarefas.md em dia com a realidade do repositório.
---

# Checar tarefas concluídas sem marcar

Varre `tarefas.md` procurando tarefas com checkbox `[ ]` que na verdade já foram implementadas, testadas, aprovadas pelo `validador` e mescladas em `develop` — um tipo de deriva que já aconteceu mais de uma vez neste projeto (T-201 e T-204 ficaram sem marcar mesmo depois de mescladas). Para cada tarefa confirmada como concluída, abre um PR de housekeeping isolado que só marca o checkbox, seguindo o padrão já estabelecido (`chore(tarefas): marca T-XXX como concluída`, ver PRs #16, #20, #22, #24).

**Nunca marca uma tarefa sozinho sem evidência de merge real.** Na dúvida, reporta como "possivelmente concluída, mas não confirmada" em vez de marcar.

## Passos

1. `git status` — se houver mudanças não commitadas, parar e avisar (não fazer stash/descarte sozinho).
2. `git checkout develop && git pull --ff-only` para partir da develop atualizada.
3. Extrair todas as linhas de tarefa: `grep -n "^\- \[" tarefas.md`. Separar as que estão `[ ]`.
4. Para cada tarefa `[ ]` (ex.: `T-XXX`), procurar evidência de que já foi mesclada em `develop`:
   - `git log develop --oneline --grep="T-XXX"` — commits de squash-merge preservam o título do PR (ex.: `feat(server): T-204 — ... (#23)`), então isso pega tanto o PR de feature quanto qualquer PR de housekeeping anterior que a tenha citado.
   - Se aparecer um commit de feature/fix (não só um commit de housekeeping que cita a tarefa como dependência de outra), é sinal forte de que a tarefa foi implementada.
   - Confirmar cruzando com os arquivos/artefatos que a descrição da tarefa em `tarefas.md` menciona (ex.: se a tarefa fala de um serviço `XService`, checar se o arquivo existe em `develop`).
5. **Caso especial — tarefas de spike/pesquisa** (ex.: T-202, T-206, e qualquer tarefa cujo "Pronto quando" exija PoC/validação empírica em hardware real): mesmo que exista um ADR mesclado documentando a decisão, **não marcar** se o próprio ADR disser algo como "PoC pendente" ou "Validação Pendente". Essas tarefas ficam propositalmente `[ ]` até a validação real acontecer (convenção já estabelecida no projeto, ver `docs/adr/001-servidor-http.md` e `docs/adr/002-...`). Reportar essas como "spike com pesquisa de mesa concluída, PoC ainda pendente" — não marcar, não abrir PR.
6. Para cada tarefa confirmada como genuinamente concluída (código mesclado, não é spike pendente):
   - `git checkout -b chore/marca-t-xxx-concluida` a partir de `develop` atualizada.
   - Editar `tarefas.md`, trocando só aquele `- [ ]` por `- [x]` (um commit por tarefa — não bundlar várias tarefas no mesmo PR/commit).
   - Commit: `chore(tarefas): marca T-XXX como concluída`, corpo citando o PR que implementou (número e título) e, se houve, o veredito do validador.
   - `git push -u origin chore/marca-t-xxx-concluida`
   - `gh pr create --base develop --title "chore(tarefas): marca T-XXX como concluída" --body "..."` citando o PR original.
   - `gh pr checks <n> --watch` até dar `pass`.
   - Voltar para `develop` (`git checkout develop`) antes de processar a próxima tarefa, para a próxima branch partir de um estado limpo.
7. Ao final, reportar em uma lista: tarefas marcadas (com link de cada PR aberto), tarefas de spike identificadas como pendentes (não mexidas), e qualquer tarefa `[ ]` ambígua onde não foi possível confirmar merge (não marcada, fica para revisão manual).

## Regras

- Nunca usar `gh pr merge` — o merge é sempre manual, feito pelo usuário. Só abrir os PRs e reportar as URLs.
- Um PR por tarefa, nunca um PR bundlando várias tarefas.
- Nunca marcar uma tarefa `[x]` sem evidência de commit mesclado em `develop` referenciando o ID dela.
- Nunca desmarcar (`[x]` → `[ ]`) nada — esta skill só corrige falsos-negativos (concluído mas não marcado), nunca o contrário. Se encontrar uma tarefa `[x]` que parece não implementada, reportar como observação, não alterar.
- Se `gh` não estiver autenticado (`gh auth status` falha), instruir o usuário a rodar `gh auth login` e parar.
