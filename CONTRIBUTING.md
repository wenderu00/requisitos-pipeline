# Contribuindo — como criar novos plugins

Este documento é o ponto de entrada para quem quer **criar ou estender**
algo a partir deste repositório: um plugin Claude Code novo do zero
(seguindo os mesmos padrões arquiteturais usados aqui), ou um segundo
plugin registrado neste mesmo `marketplace.json`.

Se você só quer **usar** o `requisitos-pipeline`, veja o [README](README.md).
Este arquivo não repete o que já está documentado em profundidade em:

- [`docs/hooks.md`](docs/hooks.md) — racional dos guardrails determinísticos.
- [`docs/schemas.md`](docs/schemas.md) — chaves de `schemas/schemas.json`.
- [`docs/integrity.md`](docs/integrity.md) — verificação de integridade.
- [`tests/README.md`](tests/README.md) — as duas suítes de teste.

Onde fizer sentido, este guia aponta para esses documentos em vez de
reexplicar o conteúdo.

## 1. Anatomia mínima de um plugin Claude Code

Todo plugin precisa de um `.claude-plugin/plugin.json`. O deste repo:

```json
{
  "$schema": "https://anthropic.com/claude-code/plugin.schema.json",
  "name": "requisitos-pipeline",
  "version": "0.1.0",
  "description": "...",
  "author": { "name": "...", "email": "..." }
}
```

Campos: `$schema`, `name`, `version` (semver), `description`, `author.{name,email}`.
Não há campos para declarar agentes ou hooks — eles são descobertos
automaticamente por convenção de diretório:

- `agents/*.md` → subagentes disponíveis.
- `hooks/hooks.json` → guardrails determinísticos (se existir).

Ou seja, criar um plugin novo é, no mínimo, criar esse `plugin.json` e um
diretório `agents/` com pelo menos um arquivo `.md`.

## 2. Padrão de arquitetura: pipeline de subagentes

Este repo é um estudo de caso de um padrão replicável para plugins que
processam algo em múltiplas etapas especializadas. Os elementos centrais:

### Frontmatter mínimo de um agente

```yaml
---
name: nome-do-agente
description: Frase densa e autossuficiente — é o que o dispatcher usa para decidir quando chamar este agente.
tools: Read, Write, Agent(outro-agente-a, outro-agente-b)
---
```

`model` é opcional, mas neste repo todo agente declara um: sem ele, o
agente herda o modelo da sessão (muitas vezes o mais caro). O classificador e
os especializados usam `sonnet`; o `auditor-coerencia`, que só compara
cartões, usa `haiku`. Escolha o modelo mais barato que dê conta do papel.

### Restringindo o call-graph com `tools: Agent(...)`

A lista entre parênteses depois de `Agent` é uma allowlist de quem este
agente pode despachar. É assim que o pipeline impõe sua própria topologia:

| Papel | Exemplo neste repo | `tools` |
|---|---|---|
| Orquestrador | `classificador-requisitos` | `Read, Write, Glob, Agent(agente-user-story, agente-caso-de-uso, agente-regra-de-negocio, agente-requisito-nao-funcional, auditor-coerencia)` |
| Especialista | `agente-user-story` | `Read, Write` |
| Avaliador | `auditor-coerencia` | `Read, Glob` (só lê, não grava nada) |

Ao desenhar um pipeline novo, decida explicitamente esses três papéis antes
de escrever qualquer prompt: quem orquestra, quem processa, quem só avalia
e devolve veredito sem gravar nada.

### Esqueleto recorrente de um agente especialista

Os 4 agentes especialistas deste repo (`agents/agente-user-story.md`,
`agente-caso-de-uso.md`, `agente-regra-de-negocio.md`,
`agente-requisito-nao-funcional.md`) seguem a mesma sequência de seções —
use `agents/agente-user-story.md` como referência concreta em vez de
reproduzi-la aqui:

1. Contrato de autonomia (não pausa para pedir esclarecimento; incerteza
   vira `confiança` baixa + `justificativa`).
2. Entrada em lote (uma lista de itens do mesmo tipo, com conteúdo bruto ou
   caminho de arquivo) + type-guard por item (se o tipo não é o esperado,
   pula aquele item sem gravar).
3. Contexto leve de outros artefatos (lê um índice barato — títulos/IDs, não
   conteúdo completo — antes de processar).
4. Processamento específico do domínio.
5. Autoavaliação com **cap de rodadas** contra uma rubrica do tipo, escrita
   no próprio prompt (sem subagente avaliador: cada subagente a mais é um
   spawn frio e caro).
6. Determinação determinística do ID de saída.
7. Gravação (`Write`) — a fonte bruta de entrada nunca é sobrescrita; o
   cartão derivado sempre é, de forma determinística, ao reprocessar.
8. Recibo final estruturado (YAML), que o orquestrador consome sem reler
   os arquivos gravados.

Essa forma de "entrada → contexto barato → processar → auditar com cap →
gravar → resumir" é o que vale generalizar para qualquer pipeline novo de
múltiplos estágios, não o conteúdo específico de requisitos.

## 3. Fonte única de verdade para schemas

Se seu plugin novo grava múltiplos tipos de arquivo estruturado (YAML/JSON),
centralize o schema de cada tipo em um único arquivo
(`schemas/schemas.json` é o modelo aqui) e gere blocos de exemplo dentro dos
prompts dos agentes e do README a partir dele — nunca edite esses blocos à
mão. Este repo faz isso com marcadores
`<!-- SYNC:schema:<tipo>:START/END -->` /
`<!-- SYNC:fragment:<id>:START/END -->` regenerados por
`scripts/sync-schemas.mjs` (com `--check` para detectar divergência sem
escrever). Detalhes completos das chaves suportadas em
[`docs/schemas.md`](docs/schemas.md) — vale a leitura antes de desenhar o
schema de um plugin novo, inclusive as extensões não óbvias
(`filename_regex`, `singleton_filename`, `item_pattern`) para quando um tipo
de arquivo não segue o padrão simples `output_dir` + `id_prefix`.

## 4. Guardrails determinísticos via hooks — quando usar

Prompt engineering sozinho não garante duas coisas que múltiplas execuções
concorrentes ou reprocessamento podem quebrar: reivindicação atômica de ID
(duas execuções calculando o mesmo "próximo número" via `Glob`) e validação
de schema pós-escrita. Este repo resolve isso com dois hooks Node.js puros
(sem `npm install`, parser YAML vendorizado em `scripts/vendor/`):
`PreToolUse` em `Write` (`scripts/hooks/claim-id.mjs`) e `PostToolUse` em
`Write` (`scripts/hooks/validate-card.mjs`). Racional completo, inclusive
por que o claim usa um arquivo `.lock` sidecar em vez de tocar o arquivo
alvo diretamente, em [`docs/hooks.md`](docs/hooks.md).

Regra prática: se seu plugin novo tem qualquer noção de "numeração
sequencial gravada em disco" ou "schema que precisa ser respeitado mesmo se
o agente alucinar", vale a pena introduzir hooks equivalentes desde cedo —
são baratos (não chamam LLM) e determinísticos.

## 5. Testes em duas camadas

Replique a separação usada aqui:

- **Suíte sintética, sem LLM, rápida, roda em CI** — modelo:
  `tests/integrity/` (`node --test`, nativo, sem framework externo).
  Testa scripts standalone que não dependem de uma resposta de modelo.
- **Suíte de regressão que invoca a CLI real, cara, não roda em CI** —
  modelo: `tests/eval/run.mjs` contra fixtures em `tests/fixtures/`. Só
  rode manualmente depois de mudar regras de prompt/classificação.

Uso detalhado de ambas em [`tests/README.md`](tests/README.md) e
[`docs/integrity.md`](docs/integrity.md).

## 6. Checklist para criar um plugin novo do zero

1. `.claude-plugin/plugin.json` (nome, versão, descrição, autor).
2. `agents/` — defina primeiro os papéis (orquestrador / especialista /
   avaliador) e o call-graph via `tools: Agent(...)` antes de escrever
   prompts longos.
3. `schemas/` (se o plugin grava arquivos estruturados) — schema como fonte
   única de verdade, com script de sync se os agentes/README precisarem de
   exemplos embutidos.
4. `hooks/hooks.json` (se precisar de reivindicação atômica de ID ou
   validação pós-escrita).
5. `tests/` — separar suíte sintética (CI) de suíte que invoca a CLI real
   (manual).
6. `README.md` — fluxo ponta a ponta, convenção de diretórios de saída,
   como usar, ponto de entrada único.
7. Registrar no marketplace (ver seção 7 abaixo).

## 7. Como adicionar um segundo plugin a este `marketplace.json`

Hoje `.claude-plugin/marketplace.json` hospeda exatamente um plugin,
auto-referenciado:

```json
{
  "$schema": "https://anthropic.com/claude-code/marketplace.schema.json",
  "name": "requisitos-pipeline",
  "description": "Marketplace pessoal do plugin requisitos-pipeline",
  "owner": { "name": "...", "email": "..." },
  "plugins": [
    {
      "name": "requisitos-pipeline",
      "description": "...",
      "source": "./",
      "author": { "name": "...", "email": "..." }
    }
  ]
}
```

`plugins` é um array — adicionar uma segunda entrada é o suficiente para
transformar isto em um marketplace de verdade com múltiplos plugins. Duas
formas de apontar `source` para o plugin novo:

**Mesmo repositório, em um subdiretório** — o subdiretório precisa ter seu
próprio `.claude-plugin/plugin.json`:

```json
{
  "name": "meu-plugin-novo",
  "description": "...",
  "source": "./plugins/meu-plugin-novo",
  "author": { "name": "...", "email": "..." }
}
```

**Repositório separado** — use um objeto de `source` em vez de string, com
`sha` fixado para reprodutibilidade (padrão confirmado no marketplace
oficial da Anthropic):

```json
{
  "name": "meu-plugin-novo",
  "description": "...",
  "source": {
    "source": "git-subdir",
    "url": "git@github.com:usuario/meu-plugin-novo.git",
    "path": "plugins/meu-plugin-novo",
    "ref": "main",
    "sha": "<commit-sha-pinado>"
  },
  "author": { "name": "...", "email": "..." }
}
```

Notas:

- **Versionamento** vive só em cada `plugin.json` (`version`, semver) — o
  `marketplace.json` não tem campo de versão próprio, é só um ponteiro de
  registro para cada plugin.
- **`category`** é um campo opcional (presente no marketplace oficial da
  Anthropic, ausente hoje neste repo) — vale adicionar por plugin quando
  houver mais de dois ou três, para facilitar navegação.
- Depois de adicionar a entrada, teste localmente com o mesmo fluxo já
  documentado no [README](README.md#instalação): `claude plugin marketplace
  add <url-ou-caminho-deste-repo>` seguido de
  `claude plugin install meu-plugin-novo@requisitos-pipeline`.

## 8. Onde continuar

- Para usar o pipeline existente: [README.md](README.md).
- Para detalhes de hooks, schemas e verificação de integridade:
  [`docs/hooks.md`](docs/hooks.md), [`docs/schemas.md`](docs/schemas.md),
  [`docs/integrity.md`](docs/integrity.md).
- Para explorar o código com o grafo de conhecimento já gerado:
  seção "Explorando o código com graphify" no [README](README.md).
