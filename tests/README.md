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
segunda_execucao: false         # true só no fixture de deduplicação — roda o classificador 2x no mesmo scratch dir
require_duplicate_flag: false   # true só no fixture de deduplicação — exige possivel_duplicata_de preenchido após a 2ª execução
```

Necessidades de tipo inesperado são reportadas, não reprovam o fixture —
onde exatamente uma frase é dividida em uma ou duas necessidades é
legitimamente ambíguo.

Casos cobertos: user story simples, caso de uso com múltiplos fluxos, regra
de negócio, requisito não funcional, dois casos de desempate (user story vs.
caso de uso; regra de negócio vs. user story), um caso adversarial de
escaping (aspas/dois-pontos/`#`/quebra de linha dentro de fala transcrita —
regressão do hook `validate-card.mjs`), um par de transcripts quase-idênticos
rodados em sequência (regressão da deduplicação), e um caso sem requisito
extraível (espera zero necessidades).
