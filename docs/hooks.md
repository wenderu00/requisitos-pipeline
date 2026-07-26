# Hooks determinísticos

`hooks/hooks.json` registra dois scripts Node.js, sem dependências de
`npm install` (só `node`, mais o parser YAML vendorizado em
`scripts/vendor/`).

## `scripts/hooks/claim-id.mjs` (`PreToolUse`, matcher `Write`)

Resolve a race condition de numeração de IDs: `classificador-requisitos`
calcula o próximo `N-<id>`/`RUN-<id>` via `Glob` uma vez e incrementa em
memória, sem recheque atômico antes de cada `Write`. Duas execuções
concorrentes do pipeline podem calcular o mesmo "próximo ID" e colidir.

A reivindicação usa um arquivo `.lock` **separado** do arquivo-alvo
(`<file_path>.lock`), nunca o próprio `<file_path>`. Criar o arquivo-alvo
antecipadamente (mesmo vazio) quebraria o `Write` real: a ferramenta
`Write` do Claude Code recusa sobrescrever um arquivo que já existe em
disco sem tê-lo lido antes nesta conversa, e o agente nunca lê um arquivo
que ele mesmo acha que está criando pela primeira vez. Usar um `.lock` ao
lado evita essa colisão por completo — o arquivo-alvo continua inexistente
até o `Write` real criá-lo.

Os dois caminhos protegidos têm semânticas diferentes de reescrita:

- `necessidades/N-<id>.yaml`: nunca deve ser reescrito por ninguém, nem
  pela própria execução que o criou — se o alvo já existe de verdade,
  negar sempre.
- `necessidades/_execucoes/RUN-<id>.yaml`: a própria execução dona do ID
  reescreve esse arquivo várias vezes ao longo do processamento (uma vez
  por necessidade, mais uma vez no resumo final). Se o alvo já existe de
  verdade, isso é sinal de que o ID já foi legitimamente criado antes (por
  esta mesma execução, quase sempre — uma segunda execução concorrente
  nunca chegaria a recalcular via `Glob` um ID cujo arquivo real já
  existe), então deve ser permitido. A colisão de verdade entre duas
  execuções concorrentes só pode acontecer antes do arquivo real existir —
  e é exatamente aí que o `.lock` intervém.

Limitação conhecida: `O_CREAT|O_EXCL` é atômico em filesystems locais
POSIX; sistemas de arquivo em rede mais antigos podem ter garantias mais
fracas.

## `scripts/hooks/validate-card.mjs` (`PostToolUse`, matcher `Write`)

Sem este hook, nada garantia que o YAML gerado por um LLM fosse
sintaticamente válido nem aderente ao schema declarado em cada
`agents/*.md` — dependia inteiramente do modelo lembrar do formato certo.
Lê o arquivo do disco (não o conteúdo que o `Write` recebeu, para validar o
que foi realmente persistido), faz parse com um parser YAML real
(vendorizado em `scripts/vendor/js-yaml.mjs`) e valida contra
`schemas/schemas.json`.

`exit(2)` em `PostToolUse` não desfaz o `Write` (o arquivo já foi escrito),
mas mostra o stderr para o agente como um erro a corrigir — na prática,
força o agente a reescrever o arquivo antes de seguir em frente.

Também implementa a heurística de calibração: sinaliza (sem bloquear)
cartões com confiança alta mas campos obrigatórios "rasos" (vazios,
placeholder, ou idênticos ao exemplo do schema) — um sinal de que a
confiança declarada pode não refletir o conteúdo real do cartão.
