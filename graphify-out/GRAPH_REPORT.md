# Graph Report - .  (2026-07-26)

## Corpus Check
- Corpus is ~33,646 words - fits in a single context window. You may not need a graph.

## Summary
- 174 nodes · 266 edges · 16 communities (14 shown, 2 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 6 edges (avg confidence: 0.78)
- Token cost: 0 input · 163,412 output

## Community Hubs (Navigation)
- Requirement Pipeline Orchestration
- Vendored js-yaml Library
- Integrity Checker Script
- Validate-Card Hook
- Eval Test Runner
- Schema Sync Script
- Claim-ID Hook
- Necessidade Schema Definitions
- Plugin Marketplace Metadata
- Plugin Manifest Metadata
- Tiebreak & Reclassification Fixtures
- Business Rule Fixtures
- Integrity Test Suite
- Escaping Transcript Fixture
- Duplicate User Story Fixture
- Non-Requirement Fixture

## God Nodes (most connected - your core abstractions)
1. `requireJsYaml()` - 23 edges
2. `requireType()` - 17 edges
3. `classificador-requisitos (subagente)` - 13 edges
4. `requisitos-pipeline (pipeline de 7 subagentes)` - 12 edges
5. `require_default()` - 11 edges
6. `scripts/hooks/validate-card.mjs (hook PostToolUse)` - 9 edges
7. `schemas/schemas.json` - 9 edges
8. `requireJson()` - 8 edges
9. `auditor-qualidade (subagente)` - 8 edges
10. `requireFailsafe()` - 7 edges

## Surprising Connections (you probably didn't know these)
- `requisitos-pipeline (pipeline de 7 subagentes)` --references--> `schemas/schemas.json`  [EXTRACTED]
  README.md → docs/schemas.md
- `requisitos-pipeline (pipeline de 7 subagentes)` --references--> `Suíte de regressão de classificação (tests/eval)`  [EXTRACTED]
  README.md → tests/README.md
- `Schema de necessidades/N-<id>.yaml` --references--> `schemas/schemas.json`  [EXTRACTED]
  README.md → docs/schemas.md
- `Índice central necessidades/_indice/INDEX.yaml` --rationale_for--> `classificador-requisitos (subagente)`  [EXTRACTED]
  README.md → agents/classificador-requisitos.md
- `Log persistente de execução RUN-<id>.yaml` --rationale_for--> `classificador-requisitos (subagente)`  [EXTRACTED]
  README.md → agents/classificador-requisitos.md

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Cadeia de despacho do pipeline de 7 subagentes (classificador -> 4 especializados -> auditor-qualidade / auditor-coerencia)** — agents_classificador_requisitos_agente, agents_agente_user_story_agente, agents_agente_caso_de_uso_agente, agents_agente_regra_de_negocio_agente, agents_agente_requisito_nao_funcional_agente, agents_auditor_qualidade_agente, agents_auditor_coerencia_agente [EXTRACTED 1.00]
- **Fragmentos SYNC compartilhados (escaping_rules, historico_auditoria, fila_pendencias, auditoria_loop, auditoria_resumo_final) entre classificador e os 4 agentes especializados** — agents_classificador_requisitos_agente, agents_agente_user_story_agente, agents_agente_caso_de_uso_agente, agents_agente_regra_de_negocio_agente, agents_agente_requisito_nao_funcional_agente [EXTRACTED 1.00]
- **Fixtures da suíte de regressão cobrindo os 4 tipos de necessidade** — tests_readme_eval_suite, tests_fixtures_01_user_story_simples_input_transcript, tests_fixtures_02_caso_de_uso_multiplos_fluxos_input_transcript, tests_fixtures_03_regra_de_negocio_input_transcript, tests_fixtures_04_rnf_performance_input_transcript [EXTRACTED 1.00]
- **Padrão de desempate na classificação de requisitos (múltiplos fluxos/atores favorecem caso_de_uso)** — tests_fixtures_05_tiebreak_user_story_vs_caso_de_uso_input_cancelamento_pedido, tests_fixtures_10_reclassificacao_input_status_entrega_uc, tests_fixtures_06_tiebreak_regra_vs_user_story_input_aprovacao_gerente_pedido [INFERRED 0.75]

## Communities (16 total, 2 thin omitted)

### Community 0 - "Requirement Pipeline Orchestration"
Cohesion: 0.14
Nodes (28): agente-caso-de-uso (subagente), agente-regra-de-negocio (subagente), agente-requisito-nao-funcional (subagente), agente-user-story (subagente), auditor-coerencia (subagente), auditor-qualidade (subagente), Critérios INVEST (user_story), classificador-requisitos (subagente) (+20 more)

### Community 1 - "Vendored js-yaml Library"
Cohesion: 0.24
Nodes (26): require_default(), require_null(), requireBinary(), requireBool(), requireCommon(), requireCore(), requireDumper(), requireException() (+18 more)

### Community 2 - "Integrity Checker Script"
Cohesion: 0.11
Nodes (15): CARD_TYPES, cardFileExists, cardsByType, CROSS_REF_TARGET_TYPE, __dirname, errors, necessidades, necessidadesDir (+7 more)

### Community 3 - "Validate-Card Hook"
Cohesion: 0.14
Nodes (11): CARD_TYPES, checkIdMatchesFilename(), __dirname, errors, escapeRegExp(), matchCardType(), PLACEHOLDER_TOKENS, relPath (+3 more)

### Community 4 - "Eval Test Runner"
Cohesion: 0.19
Nodes (12): __dirname, fixtures, FIXTURES_DIR, readCards(), readIndice(), readNecessidades(), results, ROOT (+4 more)

### Community 5 - "Schema Sync Script"
Cohesion: 0.19
Nodes (12): CHECK_ONLY, __dirname, INLINE_FRAGMENTS, renderFragmentBlock(), renderMarker(), renderSchemaBlock(), results, ROOT (+4 more)

### Community 6 - "Claim-ID Hook"
Cohesion: 0.22
Nodes (4): CLAIM_PATTERNS, claimSpec, relPath, result

### Community 7 - "Necessidade Schema Definitions"
Cohesion: 0.29
Nodes (8): Schema caso_de_uso (casos-de-uso/UC-<id>.yaml), Schema regra_de_negocio (regras-de-negocio/RN-<id>.yaml), Schema requisito_nao_funcional (requisitos-nao-funcionais/RNF-<id>.yaml), Schema user_story (user-stories/US-<id>.yaml), Schema necessidade (necessidades/N-<id>.yaml, no classificador), schemas/schemas.json, scripts/sync-schemas.mjs, Schema de necessidades/N-<id>.yaml

### Community 8 - "Plugin Marketplace Metadata"
Cohesion: 0.25
Nodes (7): description, name, owner, email, name, plugins, $schema

### Community 9 - "Plugin Manifest Metadata"
Cohesion: 0.25
Nodes (7): author, email, name, description, name, $schema, version

### Community 10 - "Tiebreak & Reclassification Fixtures"
Cohesion: 0.50
Nodes (5): Critério de teste: tiebreak User Story vs Caso de Uso (esperado: caso_de_uso), Cancelamento condicional de pedido (múltiplos fluxos: imediato vs devolução), Critério de teste: reclassificação de N-1 (esperado: user_story + caso_de_uso após correção), N-1 (execução 2, classificação corrigida): acompanhar status da entrega, como caso de uso com múltiplos atores e fluxo de exceção, N-1 (execução 1, classificação inicial incorreta): acompanhar status da entrega em uma tela, como user story

### Community 11 - "Business Rule Fixtures"
Cohesion: 0.50
Nodes (5): Critério de teste: tiebreak Regra de Negócio vs User Story (esperado: regra_de_negocio), Aprovação de gerente para pedidos acima de R$500 (independente de canal/ator), Critério de teste: referências cruzadas entre regra_de_negocio e user_story, Regra do Limite de Desconto Máximo (desconto total não pode passar de 20%), User story: cliente quer aplicar cupom de desconto no checkout respeitando a Regra do Limite de Desconto Máximo

### Community 13 - "Escaping Transcript Fixture"
Cohesion: 0.67
Nodes (3): Critério de teste: escaping de aspas e dois-pontos em transcript (esperado: user_story), Trecho de entrevista do cliente sobre mensagem de erro de pagamento recusado, User story: cliente quer ver mensagem de erro clara quando pagamento for recusado no checkout

### Community 14 - "Duplicate User Story Fixture"
Cohesion: 1.00
Nodes (3): Critério de teste: detecção de duplicata quase idêntica (esperado: user_story + flag de duplicata), User story (execução 1): recuperar senha recebendo link por e-mail, User story (execução 2): redefinir senha recebendo e-mail com link de redefinição

## Knowledge Gaps
- **70 isolated node(s):** `$schema`, `name`, `description`, `name`, `email` (+65 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **2 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `schemas/schemas.json` connect `Necessidade Schema Definitions` to `Requirement Pipeline Orchestration`?**
  _High betweenness centrality (0.015) - this node is a cross-community bridge._
- **Why does `requisitos-pipeline (pipeline de 7 subagentes)` connect `Requirement Pipeline Orchestration` to `Necessidade Schema Definitions`?**
  _High betweenness centrality (0.011) - this node is a cross-community bridge._
- **What connects `$schema`, `name`, `description` to the rest of the system?**
  _70 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Requirement Pipeline Orchestration` be split into smaller, more focused modules?**
  _Cohesion score 0.13756613756613756 - nodes in this community are weakly interconnected._
- **Should `Integrity Checker Script` be split into smaller, more focused modules?**
  _Cohesion score 0.10526315789473684 - nodes in this community are weakly interconnected._
- **Should `Validate-Card Hook` be split into smaller, more focused modules?**
  _Cohesion score 0.14166666666666666 - nodes in this community are weakly interconnected._