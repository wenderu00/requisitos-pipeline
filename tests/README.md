# Suíte de regressão de classificação

Ferramenta manual, opt-in — **não roda em CI** (este repo não tem CI, e cada
execução invoca o Claude Code real, custando tempo e chamadas de API). Rode
depois de editar as regras de extração/classificação/desempate em
`agents/classificador-requisitos.md` (seções 1-2), antes de considerar a
mudança de prompt pronta.

## Uso

```
node tests/eval/run.mjs                    # roda todos os fixtures
node tests/eval/run.mjs 05-tiebreak        # roda só fixtures cujo nome contém esse texto
```

Cada fixture cria um diretório de scratch isolado e git-ignorado em
`tests/eval/.runs/`, invoca `claude -p --plugin-dir <repo> --dangerously-skip-permissions`
carregando este plugin localmente (sem instalar), e compara os `tipo`s das
necessidades geradas contra `expected.yaml` do fixture. `--dangerously-skip-permissions`
só é usado porque o `cwd` de cada chamada é o diretório de scratch isolado
que o próprio harness cria — nunca o repositório real do usuário.

Scratch dirs de fixtures que passaram são removidos automaticamente; scratch
dirs de fixtures que falharam ficam para inspeção manual (o caminho aparece
no relatório final).

## Não-determinismo

Classificação é feita por um LLM — o mesmo texto pode, ocasionalmente,
classificar diferente entre execuções, especialmente nos fixtures de
desempate (`05-*`, `06-*`). Um fixture falhando perto de uma fronteira de
desempate é sinal para rodar de novo 2-3× antes de considerar isso uma
regressão real do prompt, não um build quebrado.

## Fixtures

Cada `tests/fixtures/<nome>/` tem `input.md` (transcript sintético) e
`expected.yaml`:

```yaml
tipos_esperados: [user_story]   # cada tipo precisa aparecer >=1x entre as necessidades geradas
minimo_necessidades: 1          # opcional
maximo_necessidades: 1          # opcional
segunda_execucao: false         # true nos fixtures 08/10/11 — roda o classificador 2x no mesmo scratch dir
require_duplicate_flag: false   # true só no fixture de deduplicação — exige possivel_duplicata_de preenchido após a 2ª execução
require_substitui_flag: false   # true só no fixture de reclassificação — exige substitui preenchido após a 2ª execução
require_cross_reference:        # opcional — só no fixture de referências cruzadas
  tipo: user_story               # tipo de cartão onde procurar o campo
  campo: regras_relacionadas     # campo que precisa vir com pelo menos 1 item
```

Necessidades de tipo inesperado são reportadas, não reprovam o fixture —
onde exatamente uma frase é dividida em uma ou duas necessidades é
legitimamente ambíguo.

Todo fixture (não só os que testam explicitamente índice/referências) tem
sua execução checada contra `necessidades/_indice/INDEX.yaml`: o número de
`entradas` precisa bater com o número de necessidades geradas no scratch
dir — é uma regressão barata para garantir que o índice central continua
cumulativo e não fica dessincronizado.

Casos cobertos: user story simples, caso de uso com múltiplos fluxos, regra
de negócio, requisito não funcional, dois casos de desempate (user story vs.
caso de uso; regra de negócio vs. user story), um caso adversarial de
escaping (aspas/dois-pontos/`#`/quebra de linha dentro de fala transcrita —
regressão do hook `validate-card.mjs`), um par de transcripts quase-idênticos
rodados em sequência (regressão da deduplicação), um caso sem requisito
extraível (espera zero necessidades), um caso de reclassificação explícita
pedida pelo usuário (regressão do campo `substitui`), e um caso de
referência cruzada explícita entre uma user story e uma regra de negócio
mencionada pelo nome (regressão dos campos `*_relacionados`/`*_relacionadas`).

`A2` (fila de pendências), `A3` (histórico de auditoria) e `B3` (auditor de
coerência) não têm fixture dedicado — dependem do julgamento do LLM auditor
(forçar `reprovado_apos_limite` ou uma contradição real de forma
determinística não é confiável). Se algum desses artefatos aparecer no
scratch dir de qualquer fixture (`necessidades/_pendencias/PEND-*.yaml`,
`historico_auditoria` não vazio em um cartão, ou um `RUN-*.yaml` com
`coerencia_verificada` preenchido), isso é aceito silenciosamente — não há
checagem estrutural adicional além da validação de schema já feita pelo hook
`validate-card.mjs` em tempo real durante a execução.
