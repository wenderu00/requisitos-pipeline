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

## Chaves de schema além do padrão `output_dir` + `id_prefix`

A maioria dos tipos (`necessidade`, `user_story`, `caso_de_uso`,
`regra_de_negocio`, `requisito_nao_funcional`) segue o padrão
`<output_dir>/<id_prefix><número>.yaml`, resolvido automaticamente por
`scripts/hooks/validate-card.mjs`. Dois tipos fogem desse padrão e usam
chaves alternativas, que o mesmo hook também entende:

- `filename_regex`: usado quando o nome do arquivo não é
  `<id_prefix><número>.yaml` (ex. `pendencia`, cujo arquivo é
  `PEND-<US|UC|RN|RNF>-<número>.yaml` — o prefixo varia por tipo de
  cartão, reaproveitando o número da necessidade de origem em vez de um
  contador próprio).
- `singleton_filename`: usado para arquivos únicos, sem número no nome
  (ex. `indice`, cujo arquivo é sempre `INDEX.yaml`).

Campos de lista também podem declarar `item_pattern` (regex aplicado a cada
item da lista) quando os itens são strings simples que precisam seguir um
formato — ex. os campos de referência cruzada (`regras_relacionadas` etc.),
validados como `^RN-\d+$` item a item, sem exigir `item_fields` (reservado
para itens que são objetos estruturados, como `criterios_aceite`).

Se você adicionar um novo tipo de artefato no futuro, prefira o padrão
`output_dir` + `id_prefix` sempre que possível — as duas chaves alternativas
existem porque `pendencia` e `indice` genuinamente não cabem nesse padrão,
não para virar a opção default.
