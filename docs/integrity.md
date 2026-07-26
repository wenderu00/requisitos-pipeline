# `scripts/check-integrity.mjs`

Script standalone, sem LLM e sem dependências além do parser YAML
vendorizado (`scripts/vendor/js-yaml.mjs`), que verifica a integridade
referencial de um projeto que já usou o pipeline. Diferente de
`scripts/hooks/validate-card.mjs` (que valida um arquivo por vez, no
momento em que é gravado), este script lê o diretório inteiro de uma vez,
depois do fato — pensado para rodar sob demanda, não a cada `Write`.

## Uso

```
node scripts/check-integrity.mjs [diretório]
```

`diretório` é opcional (default: diretório atual) — o diretório do projeto
que contém `necessidades/`, `user-stories/`, etc. (não o diretório deste
plugin).

## O que verifica (erros — `exit(1)`)

- **Cartões órfãos**: um `user-stories/US-<id>.yaml` (ou equivalente nos
  outros 3 tipos) cujo `necessidade_origem` não existe em `necessidades/`.
- **Necessidades sem cartão**: uma `necessidades/N-<id>.yaml` cujo `tipo`
  não tem um cartão correspondente em disco, e que também não tem uma
  falha de despacho (`status: despachado_falha` ou
  `colisao_id_recuperada`) registrada em nenhum `RUN-*.yaml` — ou seja, uma
  necessidade que deveria ter virado um cartão e não virou, sem
  explicação.
- **Referências `substitui` quebradas**: uma necessidade com
  `substitui: N-<x>` apontando para um `N-<x>` que não existe.

## O que verifica (avisos — não bloqueiam)

- **Referências cruzadas apontando para IDs inexistentes** (ex.
  `regras_relacionadas: ["RN-99"]` quando `RN-99` não existe). Esses
  campos são preenchidos por melhor esforço pelos agentes especializados
  (ver `README.md`, seção "Schema resumido de cada cartão de saída") — um
  ID inexistente não é necessariamente um bug do pipeline (pode ser uma
  referência a um artefato que ainda não foi processado nesta leva), então
  vira aviso, não erro.

## O que este script *não* verifica

- Schema/formato de cada arquivo individual (isso é `validate-card.mjs`,
  que já roda em tempo real a cada `Write`).
- Contradição ou sobreposição de *conteúdo* entre artefatos — isso é
  responsabilidade do agente `auditor-coerencia` (chamado automaticamente
  pelo `classificador-requisitos` ao final de cada execução), não deste
  script.

## Suíte de testes

`tests/integrity/check-integrity.test.mjs` usa `node:test` com árvores de
diretório sintéticas (criadas e destruídas em um diretório temporário) —
não chama o Claude Code, roda em milissegundos. É a primeira suíte deste
repositório capaz de rodar em CI (a suíte em `tests/eval/` depende do CLI
real do Claude Code e não roda em CI, ver `tests/README.md`).

```
node --test tests/integrity/
```
