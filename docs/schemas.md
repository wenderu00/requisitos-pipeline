# `schemas/schemas.json`

Fonte única de verdade para os schemas de saída do pipeline
`requisitos-pipeline`. Editado à mão.

Consumido por dois lugares independentes:

- `scripts/sync-schemas.mjs` regenera os blocos marcados com
  `<!-- SYNC:... -->` em `agents/*.md` e `README.md` a partir daqui.
- `scripts/hooks/validate-card.mjs` lê este arquivo em tempo de execução
  para validar o que foi escrito em disco depois de cada `Write`.

Nunca edite os blocos gerados diretamente nos arquivos `.md` — edite
`schemas.json` e rode `node scripts/sync-schemas.mjs`. Rode com `--check`
para só verificar divergência sem escrever nada.
