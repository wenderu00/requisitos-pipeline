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
         caso_de_uso              -> agente-caso-de-uso        -> casos-de-uso/UC-<id>.yaml
         regra_de_negocio         -> agente-regra-de-negocio   -> regras-de-negocio/RN-<id>.yaml
         requisito_nao_funcional  -> agente-requisito-nao-funcional -> requisitos-nao-funcionais/RNF-<id>.yaml
       (os 4 acima chamam auditor-qualidade internamente, até 3x cada, com
       critérios de qualidade específicos do seu tipo)
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

## Convenção de diretórios de saída

| Diretório | Arquivo | Campo de origem |
|---|---|---|
| `necessidades/` | `N-<id>.yaml` | — (fonte da verdade bruta) |
| `user-stories/` | `US-<id>.yaml` | `necessidade_origem: N-<id>` |
| `casos-de-uso/` | `UC-<id>.yaml` | `necessidade_origem: N-<id>` |
| `regras-de-negocio/` | `RN-<id>.yaml` | `necessidade_origem: N-<id>` |
| `requisitos-nao-funcionais/` | `RNF-<id>.yaml` | `necessidade_origem: N-<id>` |
| `necessidades/_execucoes/` | `RUN-<id>.yaml` | — (log da própria execução, não deriva de uma necessidade) |

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
```
<!-- SYNC:schema:necessidade:END -->

Numeração de ID via `Glob` em `necessidades/N-*.yaml`: pega o maior número
existente, numera a partir de `maior + 1` (ou `N-1` se vazio). Nunca
sobrescreve `necessidades/N-<id>.yaml` de execuções anteriores.

## Schema resumido de cada cartão de saída

Campo comum a todos: `confiança` (0.00–1.00) + `justificativa` sempre
preenchida. Schema completo em cada `agents/agente-*.md` deste plugin.

Os 4 cartões especializados também levam um bloco comum
`auditoria_qualidade` (`veredito`, `rodadas` 1–3, `feedback_pendente`,
`motivo_falha_auditor`) — critérios avaliados variam por tipo, ver
`agents/auditor-qualidade.md`.

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

## Profundidade de subagentes

Cadeia real: `classificador-requisitos` (nível 1) → `agente-*` (nível 2) →
`auditor-qualidade` (nível 3, chamado pelos 4 tipos de cartão, até 3
chamadas por cartão). Se você tiver `CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH`
configurado baixo, aumente para pelo menos 3 — se estiver baixo demais, a
falha aparece distinta no resumo final do agente especializado
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

`tests/` tem uma suíte manual (não roda em CI) que invoca o Claude Code real
contra 9 fixtures para checar se as regras de classificação/desempate ainda
produzem os tipos esperados depois de uma mudança de prompt. Ver
`tests/README.md` para uso (`node tests/eval/run.mjs`).

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
