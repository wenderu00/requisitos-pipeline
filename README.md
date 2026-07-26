# requisitos-pipeline

Pipeline de 7 subagentes que transforma texto livre (ex. transcript de uma
sessão do skill `grill-me`, ou qualquer texto colado na conversa) em
requisitos estruturados e versionados como YAML — user stories, casos de
uso, regras de negócio e requisitos não funcionais.

## Instalação

Repositório privado — clone via SSH (a máquina precisa ter acesso SSH
configurado a este repo; clone via HTTPS falha por falta de credencial):

```
claude plugin marketplace add git@github.com:wenderu00/requisitos-pipeline.git
claude plugin install requisitos-pipeline@requisitos-pipeline
```

Se o nome `requisitos-pipeline` já estiver em uso por outra instalação
(scope diferente ou skills-dir), a instalada por este comando tem
precedência — a outra fica marcada como "Not loaded" até um dos dois ser
removido ou renomeado.

## Fluxo ponta a ponta

```
texto livre (transcript, ex. saída do skill grill-me)
  -> classificador-requisitos
       carrega necessidades/_indice/INDEX.yaml (visão barata do que já existe)
       extrai necessidades, grava necessidades/N-<id>.yaml
       despacha, uma necessidade por vez, logo após gravar cada N-<id>:
         user_story              -> agente-user-story        -> user-stories/US-<id>.yaml
         caso_de_uso              -> agente-caso-de-uso        -> casos-de-uso/UC-<id>.yaml
         regra_de_negocio         -> agente-regra-de-negocio   -> regras-de-negocio/RN-<id>.yaml
         requisito_nao_funcional  -> agente-requisito-nao-funcional -> requisitos-nao-funcionais/RNF-<id>.yaml
       (os 4 acima leem o índice para visão mínima de outros artefatos e
       referências cruzadas, e chamam auditor-qualidade internamente, até 3x
       cada, com critérios de qualidade específicos do seu tipo)
       atualiza necessidades/_indice/INDEX.yaml a cada necessidade despachada
       ao final: chama auditor-coerencia uma vez (automático, best-effort)
       comparando os cartões já materializados entre si
```

Todos os diretórios de saída (`necessidades/`, `user-stories/`,
`casos-de-uso/`, `regras-de-negocio/`, `requisitos-nao-funcionais/`) são
criados no diretório de trabalho de quem usa o plugin — são artefatos do
projeto do usuário, não fazem parte do pacote deste plugin.

## Como usar

Ponto de entrada único: peça para chamar o agente `classificador-requisitos`
com o texto colado no prompt (ex. "classifique os requisitos deste
transcript: ..."). Ele já despacha os agentes especializados sozinho —
**não chame `agente-user-story`, `agente-caso-de-uso`,
`agente-regra-de-negocio` ou `agente-requisito-nao-funcional` diretamente
numa execução nova.** Chamar um especializado direto pula classificação e
numeração, e pode gerar um cartão cujo `necessidade_origem` nem existe em
`necessidades/`.

**Exceção**: reprocessamento de recovery. Se `classificador-requisitos`
reportar falha de despacho para uma `necessidade_id` específica, é seguro
chamar o agente especializado do tipo correspondente diretamente, passando
`necessidades/N-<id>.yaml` — os agentes especializados sobrescrevem o cartão
de forma determinística.

`auditor-qualidade` é estritamente interno: só é chamado pelos 4 agentes
especializados, um por vez (avaliador puro, sem `tools`, sem persistência
própria), com critérios de qualidade diferentes por tipo de cartão.

`auditor-coerencia` também é estritamente interno: só é chamado pelo
`classificador-requisitos`, uma única vez ao final de cada execução
(automático, best-effort — nunca trava o fluxo). Ele lê os cartões já
materializados (não só o rascunho corrente) e reporta possíveis
contradições, duplicidades ou sobreposições entre artefatos, inclusive de
tipos diferentes.

## Convenção de diretórios de saída

| Diretório | Arquivo | Campo de origem |
|---|---|---|
| `necessidades/` | `N-<id>.yaml` | — (fonte da verdade bruta) |
| `user-stories/` | `US-<id>.yaml` | `necessidade_origem: N-<id>` |
| `casos-de-uso/` | `UC-<id>.yaml` | `necessidade_origem: N-<id>` |
| `regras-de-negocio/` | `RN-<id>.yaml` | `necessidade_origem: N-<id>` |
| `requisitos-nao-funcionais/` | `RNF-<id>.yaml` | `necessidade_origem: N-<id>` |
| `necessidades/_execucoes/` | `RUN-<id>.yaml` | — (log da própria execução, não deriva de uma necessidade) |
| `necessidades/_indice/` | `INDEX.yaml` | — (índice cumulativo entre execuções, arquivo único) |
| `necessidades/_pendencias/` | `PEND-<US\|UC\|RN\|RNF>-<id>.yaml` | reaproveita o número da necessidade de origem (fila de revisão para cartões `reprovado_apos_limite`) |

## Schema de `necessidades/N-<id>.yaml`

<!-- SYNC:schema:necessidade:START -->
```yaml
necessidade_id: N-118
titulo: "Resumo curto da necessidade"
descricao: "Texto completo, no formato apropriado ao tipo (ex. 'Como <ator>, quero <ação>, para <benefício>' para user story)"
origem: "Trecho ou referência do contexto de onde foi extraída"
tipo: user_story
confiança: 0.87
alternativa_considerada: caso_de_uso
justificativa: "Ação simples e atômica, sem múltiplos fluxos de interação com outros atores"
possivel_duplicata_de: null
motivo_duplicata: null
substitui: null
```
<!-- SYNC:schema:necessidade:END -->

Numeração de ID via `Glob` em `necessidades/N-*.yaml`: pega o maior número
existente, numera a partir de `maior + 1` (ou `N-1` se vazio). Nunca
sobrescreve `necessidades/N-<id>.yaml` de execuções anteriores.

## Schema resumido de cada cartão de saída

Campo comum a todos: `confiança` (0.00–1.00) + `justificativa` sempre
preenchida. Schema completo em cada `agents/agente-*.md` deste plugin.

Os 4 cartões especializados também levam:
- Um bloco comum `auditoria_qualidade` (`veredito`, `rodadas` 1–3,
  `feedback_pendente`, `motivo_falha_auditor`) — critérios avaliados variam
  por tipo, ver `agents/auditor-qualidade.md`.
- `historico_auditoria` (lista, cap de 5 entradas mais recentes) —
  preserva o `auditoria_qualidade` de versões anteriores do cartão quando
  ele é reprocessado, em vez de simplesmente sobrescrever o veredito
  anterior sem deixar rastro.
- Três campos de referência cruzada para os outros três tipos (ex.
  `regras_relacionadas`, `rnfs_relacionados`, `casos_de_uso_relacionados`
  em `user_story`) — listas de IDs, `[]` por padrão, preenchidas só quando
  o texto da necessidade menciona explicitamente outro artefato já
  materializado.

- **`user-stories/US-<id>.yaml`**: `ator` / `acao` / `beneficio`,
  `criterios_aceite` (lista de `dado`/`quando`/`entao`).
- **`casos-de-uso/UC-<id>.yaml`**: `atores`, `fluxo_principal` (`passos` +
  `resultado`), `fluxos_alternativos`, `fluxos_excecao` (cada um com `nome`,
  `gatilho`, `passos`, `resultado`).
- **`regras-de-negocio/RN-<id>.yaml`**: `enunciado`, `condicao_aplicacao`,
  `valor_ou_formula` (`null` se a regra for qualitativa), `excecoes`.
- **`requisitos-nao-funcionais/RNF-<id>.yaml`**: `categoria`
  (<!-- SYNC:fragment:rnf_categorias_bullet:START -->`performance`/`seguranca`/`disponibilidade`/`usabilidade`/`escalabilidade`/`outro`<!-- SYNC:fragment:rnf_categorias_bullet:END -->),
  `metrica`, `valor_alvo`, `contexto_condicao` (`null` se não houver condição
  especial).

Os 4 cartões especializados são **sempre sobrescritos** de forma
determinística ao reprocessar a mesma necessidade — diferente de
`necessidades/N-<id>.yaml`, que nunca é sobrescrito por uma nova execução do
classificador.

## Índice central

`necessidades/_indice/INDEX.yaml` é um arquivo único, cumulativo entre
execuções (diferente de `RUN-<n>.yaml`, que é só da execução corrente),
mantido pelo `classificador-requisitos`: uma entrada por necessidade, com
`necessidade_id`, `titulo`, `tipo`, `cartao_gerado`, `status_auditoria` e
`substituida_por`. É a fonte barata (só títulos/IDs, não conteúdo completo)
que os agentes especializados consultam para visão mínima de outros
artefatos (critério `independente`/`duplicidade_semantica` do
`auditor-qualidade`) e para preencher as referências cruzadas.

## Fila de pendências de revisão

Quando um cartão sai `reprovado_apos_limite` (esgotou as 3 chamadas ao
`auditor-qualidade` sem aprovar), o agente especializado grava também
`necessidades/_pendencias/PEND-<US|UC|RN|RNF>-<id>.yaml` — uma fila real
para revisão humana, com `resolvido: false`. Se o cartão for reprocessado
depois e aprovar, o mesmo arquivo é atualizado para `resolvido: true`
(nunca apagado, preserva o histórico de que já passou por reprovação).

## Reclassificação de necessidades

`necessidades/N-<id>.yaml` nunca é reescrito, nem para corrigir uma
classificação errada. Se o usuário pedir explicitamente para corrigir o
`tipo` de uma necessidade já existente, o classificador cria uma nova
necessidade com `substitui: N-<antigo>` preenchido, despacha normalmente
pelo tipo correto, e marca no índice central que a antiga foi
`substituida_por` a nova. O classificador nunca infere isso sozinho a
partir da deduplicação automática — exige pedido explícito do usuário.

## Profundidade de subagentes

Cadeia real: `classificador-requisitos` (nível 1) → `agente-*` (nível 2) →
`auditor-qualidade` (nível 3, chamado pelos 4 tipos de cartão, até 3
chamadas por cartão). `auditor-coerencia` é um ramo irmão mais raso
(nível 1 → nível 2, chamado direto pelo classificador), não empilhado sobre
o ramo de auditoria de qualidade — não aumenta a profundidade máxima. Se
você tiver `CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH` configurado baixo, aumente
para pelo menos 3 — se estiver baixo demais, a falha aparece distinta no
resumo final do agente especializado
(`motivo_falha_auditor: falha_configuracao_profundidade`) para não ser
confundida com um problema de conteúdo do cartão.

## Guardrails determinísticos (hooks)

Este plugin não é mais 100% prompt engineering: `hooks/hooks.json` registra
dois hooks Node.js (sem dependências de `npm install` — os scripts são
`.mjs` puros, com um parser YAML vendorizado em `scripts/vendor/`) —
`scripts/hooks/claim-id.mjs` (reivindicação atômica de ID antes do `Write`)
e `scripts/hooks/validate-card.mjs` (validação de schema/YAML depois do
`Write`, mais a heurística de calibração de confiança). Detalhes e
racional em [`docs/hooks.md`](docs/hooks.md).

O schema de cada tipo de arquivo (`necessidade`, `user_story`, `caso_de_uso`,
`regra_de_negocio`, `requisito_nao_funcional`, `execucao`) vive em
`schemas/schemas.json`, a fonte única de verdade consumida tanto pelo
validador quanto por `scripts/sync-schemas.mjs`. Detalhes em
[`docs/schemas.md`](docs/schemas.md).

## Log persistente de execução

`classificador-requisitos` grava e mantém atualizado, ao longo de toda a
execução (não só no final), um arquivo
`necessidades/_execucoes/RUN-<n>.yaml` com o progresso do processamento —
`execucao_id`, `resumo_origem`, `concluido`, e uma entrada por necessidade
processada (`necessidade_id`, `tipo`, `confianca`, `status`, `subagente`,
`cartao_gerado`, `motivo_falha`, `aviso_calibracao`, `aviso_configuracao`).
`concluido: true` e o bloco `resumo` só são gravados no final.

Isso existe porque o resumo impresso no chat só existe enquanto a conversa
não for compactada — e o Claude Code compacta conversas longas
automaticamente. Gravar o mesmo progresso como um artefato normal em disco,
atualizado necessidade por necessidade, é o que permite recuperar o que já
foi processado mesmo que a conversa seja compactada no meio da execução (uma
alternativa — um hook `PreCompact` tentando reconstruir esse estado a partir
do transcript da conversa — foi descartada por não ter como reconstruir
outcomes estruturados por necessidade de forma confiável).

## Suíte de regressão de classificação

`tests/eval/` tem uma suíte manual (não roda em CI) que invoca o Claude Code
real contra 11 fixtures para checar se as regras de classificação/desempate,
o índice central, a reclassificação e as referências cruzadas continuam
funcionando depois de uma mudança de prompt. Ver `tests/README.md` para uso
(`node tests/eval/run.mjs`).

## Verificação de integridade

`scripts/check-integrity.mjs <diretório>` é um script standalone (sem LLM,
sem dependências) que verifica um projeto que já usou o pipeline: cartões
órfãos (`necessidade_origem` que não existe), necessidades sem cartão nem
falha de despacho registrada, e referências (`substitui`, referências
cruzadas) quebradas. `tests/integrity/` tem uma suíte sintética própria
(`node --test tests/integrity/`), sem chamar o Claude Code — a primeira
suíte deste repo capaz de rodar em CI. Detalhes em
[`docs/integrity.md`](docs/integrity.md).

## Desenvolvimento

### Estrutura do repositório

```
agents/          cartões dos 7 subagentes (classificador, 4 especializados, 2 auditores)
hooks/           hooks.json (registro dos guardrails determinísticos)
schemas/         schemas.json — fonte única de verdade dos schemas de saída
scripts/         scripts .mjs standalone
  hooks/         claim-id.mjs (PreToolUse) e validate-card.mjs (PostToolUse)
  vendor/        parser YAML vendorizado (js-yaml.mjs), sem dependência externa
  check-integrity.mjs, sync-schemas.mjs
docs/            detalhamento de hooks, schemas e verificação de integridade
tests/
  eval/          suíte de regressão de classificação (invoca o Claude Code real)
  integrity/     suíte sintética de check-integrity.mjs (roda em CI)
  fixtures/      pares input.md/expected.yaml usados por tests/eval
.claude-plugin/  manifesto do plugin e do marketplace pessoal
```

Os diretórios `necessidades/`, `user-stories/`, `casos-de-uso/`,
`regras-de-negocio/`, `requisitos-nao-funcionais/` (ver "Convenção de
diretórios de saída" acima) **não fazem parte deste repositório** — são
artefatos gravados no projeto de quem usa o plugin.

### Requisitos

Node.js ≥ 18 (`tests/integrity/` usa `node:test`, nativo, sem framework de
teste externo). Zero dependências — não há `package.json`, não roda
`npm install`; todos os scripts são `.mjs` puros, inclusive o parser YAML
vendorizado em `scripts/vendor/js-yaml.mjs`.

### Editando schemas

Nunca edite os blocos `<!-- SYNC:...:START/END -->` diretamente nos
arquivos `.md` — edite só `schemas/schemas.json` e rode:

```
node scripts/sync-schemas.mjs          # regenera os blocos em agents/*.md e README.md
node scripts/sync-schemas.mjs --check  # só verifica divergência, não escreve nada
```

Detalhes de chaves de schema (`filename_regex`, `singleton_filename`,
`item_pattern`) em [`docs/schemas.md`](docs/schemas.md).

### Rodando os testes (este repo não tem CI)

Checklist antes de considerar uma mudança pronta:

```
node scripts/sync-schemas.mjs --check   # schemas.json e blocos SYNC não divergiram
node --test tests/integrity/            # suíte sintética, rápida, sem LLM
node tests/eval/run.mjs                 # regressão de classificação — só depois de mexer
                                         # nas regras de agents/classificador-requisitos.md;
                                         # invoca o Claude Code real, custa chamadas de API
```

Uso detalhado de cada suíte em [`tests/README.md`](tests/README.md) e
[`docs/integrity.md`](docs/integrity.md).

### Explorando o código com graphify

Este repositório tem um grafo de conhecimento navegável gerado pelo skill
`graphify` em `graphify-out/` (god nodes, comunidades, relações entre
arquivos), já integrado ao `CLAUDE.md` deste projeto. Em vez de grep bruto,
prefira:

```
graphify query "<pergunta>"
graphify path "<A>" "<B>"
graphify explain "<conceito>"
```

Depois de qualquer mudança de código, rode `graphify update .` para manter
o grafo atualizado (só AST, sem custo de API).

### Criando um plugin novo

Quer criar um plugin Claude Code do zero seguindo os mesmos padrões deste
repo (pipeline de subagentes, schema como fonte única de verdade, hooks
determinísticos), ou registrar um segundo plugin neste
`marketplace.json`? Veja [`CONTRIBUTING.md`](CONTRIBUTING.md).

## Tratamento de falha

O pipeline nunca trava: falha de despacho ou de auditoria é registrada e o
processamento segue para a próxima necessidade. `classificador-requisitos`
resume tudo no relatório final, incluindo necessidades com `confiança < 0.6`
sinalizadas para revisão manual.

Falha de auditoria de qualidade tem dois motivos distintos, e o resumo final
de cada agente especializado sinaliza qual é: **falha de configuração**
(`motivo_falha_auditor: falha_configuracao_profundidade` — o ambiente tem
`CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH` baixo demais, não é um problema do
cartão) versus **falha de conteúdo** (veredito `reprovado_apos_limite`, ou
`motivo_falha_auditor: falha_auditor_outro`/`resposta_invalida` — este sim
pede revisão manual do texto do cartão).
