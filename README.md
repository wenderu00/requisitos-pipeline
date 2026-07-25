# requisitos-pipeline

Pipeline de 6 subagentes que transforma texto livre (ex. transcript de uma
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
       extrai necessidades, grava necessidades/N-<id>.yaml
       despacha, uma necessidade por vez, logo após gravar cada N-<id>:
         user_story              -> agente-user-story        -> user-stories/US-<id>.yaml
                                       (chama auditor-invest internamente, até 3x)
         caso_de_uso              -> agente-caso-de-uso        -> casos-de-uso/UC-<id>.yaml
         regra_de_negocio         -> agente-regra-de-negocio   -> regras-de-negocio/RN-<id>.yaml
         requisito_nao_funcional  -> agente-requisito-nao-funcional -> requisitos-nao-funcionais/RNF-<id>.yaml
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

`auditor-invest` é estritamente interno: só é chamado por
`agente-user-story` (avaliador puro, sem `tools`, sem persistência própria).

## Convenção de diretórios de saída

| Diretório | Arquivo | Campo de origem |
|---|---|---|
| `necessidades/` | `N-<id>.yaml` | — (fonte da verdade bruta) |
| `user-stories/` | `US-<id>.yaml` | `necessidade_origem: N-<id>` |
| `casos-de-uso/` | `UC-<id>.yaml` | `necessidade_origem: N-<id>` |
| `regras-de-negocio/` | `RN-<id>.yaml` | `necessidade_origem: N-<id>` |
| `requisitos-nao-funcionais/` | `RNF-<id>.yaml` | `necessidade_origem: N-<id>` |

## Schema de `necessidades/N-<id>.yaml`

```yaml
necessidade_id: N-1
titulo: "Resumo curto da necessidade"
descricao: "Texto completo, no formato apropriado ao tipo"
origem: "Trecho ou referência do contexto de onde foi extraída"
tipo: user_story  # user_story | caso_de_uso | regra_de_negocio | requisito_nao_funcional
confiança: 0.87
alternativa_considerada: caso_de_uso  # só preenchido se confiança < 0.7, senão null
justificativa: "Por que esse tipo bateu melhor que a alternativa mais próxima"
```

Numeração de ID via `Glob` em `necessidades/N-*.yaml`: pega o maior número
existente, numera a partir de `maior + 1` (ou `N-1` se vazio). Nunca
sobrescreve `necessidades/N-<id>.yaml` de execuções anteriores.

## Schema resumido de cada cartão de saída

Campo comum a todos: `confiança` (0.00–1.00) + `justificativa` sempre
preenchida. Schema completo em cada `agents/agente-*.md` deste plugin.

- **`user-stories/US-<id>.yaml`**: `ator` / `acao` / `beneficio`,
  `criterios_aceite` (lista de `dado`/`quando`/`entao`), bloco
  `auditoria_invest` (`veredito`, `rodadas` 1–3, `feedback_pendente`).
- **`casos-de-uso/UC-<id>.yaml`**: `atores`, `fluxo_principal` (`passos` +
  `resultado`), `fluxos_alternativos`, `fluxos_excecao` (cada um com `nome`,
  `gatilho`, `passos`, `resultado`).
- **`regras-de-negocio/RN-<id>.yaml`**: `enunciado`, `condicao_aplicacao`,
  `valor_ou_formula` (`null` se a regra for qualitativa), `excecoes`.
- **`requisitos-nao-funcionais/RNF-<id>.yaml`**: `categoria`
  (`performance`/`seguranca`/`disponibilidade`/`usabilidade`/`escalabilidade`/`outro`),
  `metrica`, `valor_alvo`, `contexto_condicao` (`null` se não houver condição
  especial).

Os 4 cartões especializados são **sempre sobrescritos** de forma
determinística ao reprocessar a mesma necessidade — diferente de
`necessidades/N-<id>.yaml`, que nunca é sobrescrito por uma nova execução do
classificador.

## Profundidade de subagentes

Cadeia real: `classificador-requisitos` (nível 1) → `agente-*` (nível 2) →
`auditor-invest` (nível 3, só no caminho `user_story`, até 3 chamadas por
user story). Se você tiver `CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH` configurado
baixo, aumente para pelo menos 3.

## Tratamento de falha

O pipeline nunca trava: falha de despacho ou de auditoria é registrada e o
processamento segue para a próxima necessidade. `classificador-requisitos`
resume tudo no relatório final, incluindo necessidades com `confiança < 0.6`
sinalizadas para revisão manual.
