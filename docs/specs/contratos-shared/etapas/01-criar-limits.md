# 01 — Criar os limites de campo compartilhados

**Status:** concluída · **Atualizada em:** 2026-11-09
**Depende de:** nenhuma

## Execução
**Modelo:** [ ] haiku · [x] sonnet · [ ] opus
**Esforço:** [ ] low · [x] medium · [ ] high
**Pausar ao final da etapa:** [x] não · [ ] sim

## O que esta etapa entrega
`packages/shared` passa a ter um único lugar (`limits.ts`) com o limite máximo de caracteres de cada campo do domínio, contado em code points, pronto para ser usado tanto pelos schemas Zod das próximas etapas quanto por labels de formulário na tela.

## Critérios de aceite
- [x] C1 — Existe um limite exportado para cada campo: `name` (120), `nickname` (60), `universe` (60), `main_power` (80), `avatar_url` (2048), `mission.title` (120).

## Cenários de teste
- **C1.a** — Dado o módulo `limits.ts`, quando se lê o valor exportado para `name`, então o valor é `120`.
- **C1.b** — Dado o módulo `limits.ts`, quando se lê o valor exportado para `nickname`, `universe`, `main_power`, `avatar_url` e `mission.title`, então os valores são, respectivamente, `60`, `60`, `80`, `2048` e `120`.

## Fora desta etapa
- A contagem por code points (e não por bytes/UTF-16) é regra dos schemas Zod que usam estes limites, não deste módulo: `limits.ts` só guarda os números. Coberta pelos cenários C4.a/C4.b da etapa 05 e C2.a/C2.b da etapa 06.

## Registro da implementação

**O que foi alterado**
- `packages/shared` passa a exportar `limits`, o objeto único com o tamanho máximo de cada campo (`name`, `nickname`, `universe`, `main_power`, `avatar_url` e `mission.title`), para ser reaproveitado pelos schemas Zod e pelos labels de formulário da tela nas próximas etapas.

**Convenção confirmada:** `tsconfig.base.json` usa `NodeNext`/`NodeNext` (decisão do scaffold, combina com `"type": "module"` em todos os pacotes e com a resolução ESM real do Node em runtime). Por isso, todo import relativo precisa da extensão explícita `.js` (mesmo apontando para um arquivo `.ts`), inclusive em testes. O import de `limits.test.ts` foi ajustado de `"./limits"` para `"./limits.js"`; nenhuma outra mudança de configuração foi necessária.

**Testes:** `packages/shared/src/limits.test.ts` — cenários C1.a e C1.b.

**Sugestões da revisão**
- `packages/shared/package.json:12-13` — `zod` foi adicionado nesta etapa mas não é usado por nenhum arquivo dela (só pelas etapas 04/05/06); considerar mover a dependência para a etapa que a usar de fato.
- `packages/shared/src/index.ts` — `limits` ainda não é reexportado pelo barrel (`index.ts`); confirmar que uma das etapas 04-06 expõe isso, senão quem importar `@hero-factory/shared` precisa de import de caminho profundo.
