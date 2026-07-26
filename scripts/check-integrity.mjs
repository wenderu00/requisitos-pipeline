#!/usr/bin/env node

import { readFileSync, readdirSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { load as loadYaml } from "./vendor/js-yaml.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const TARGET_DIR = path.resolve(process.argv[2] || process.cwd());

const schemas = JSON.parse(
  readFileSync(path.join(ROOT, "schemas", "schemas.json"), "utf8")
);

const CARD_TYPES = ["user_story", "caso_de_uso", "regra_de_negocio", "requisito_nao_funcional"];

const CROSS_REF_TARGET_TYPE = {
  regras_relacionadas: "regra_de_negocio",
  rnfs_relacionados: "requisito_nao_funcional",
  casos_de_uso_relacionados: "caso_de_uso",
  user_stories_relacionadas: "user_story",
};

function listYamlFiles(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((f) => f.endsWith(".yaml"));
}

function readYaml(absPath) {
  try {
    return loadYaml(readFileSync(absPath, "utf8"));
  } catch {
    return null;
  }
}

function idNumber(id) {
  const m = String(id).match(/-(\d+)$/);
  return m ? m[1] : null;
}

// --- Load necessidades ---
const necessidadesDir = path.join(TARGET_DIR, "necessidades");
const necessidades = new Map(); // necessidade_id -> data
for (const f of listYamlFiles(necessidadesDir)) {
  if (!/^N-\d+\.yaml$/.test(f)) continue;
  const data = readYaml(path.join(necessidadesDir, f));
  if (data && data.necessidade_id) necessidades.set(data.necessidade_id, data);
}

// --- Load run logs (necessidade_id -> set of statuses seen across all runs) ---
const runsDir = path.join(necessidadesDir, "_execucoes");
const statusByNecessidade = new Map();
for (const f of listYamlFiles(runsDir)) {
  if (!/^RUN-\d+\.yaml$/.test(f)) continue;
  const data = readYaml(path.join(runsDir, f));
  if (!data || !Array.isArray(data.necessidades)) continue;
  for (const entry of data.necessidades) {
    if (!entry || !entry.necessidade_id) continue;
    if (!statusByNecessidade.has(entry.necessidade_id)) {
      statusByNecessidade.set(entry.necessidade_id, new Set());
    }
    statusByNecessidade.get(entry.necessidade_id).add(entry.status);
  }
}

// --- Load cards per type ---
const cardsByType = {}; // typeName -> Map(cardId -> data)
const cardFileExists = {}; // typeName -> Set(necessidade_id with a card on disk)
for (const typeName of CARD_TYPES) {
  const entry = schemas[typeName];
  const dir = path.join(TARGET_DIR, entry.output_dir);
  const map = new Map();
  const originsSeen = new Set();
  const idRe = new RegExp(`^${entry.id_prefix}(\\d+)\\.yaml$`);
  for (const f of listYamlFiles(dir)) {
    if (!idRe.test(f)) continue;
    const data = readYaml(path.join(dir, f));
    if (!data) continue;
    map.set(data[entry.id_field], data);
    if (data[entry.origin_field]) originsSeen.add(data[entry.origin_field]);
  }
  cardsByType[typeName] = map;
  cardFileExists[typeName] = originsSeen;
}

const errors = [];
const warnings = [];

// 1. Orphans: cartão cujo necessidade_origem não existe
for (const typeName of CARD_TYPES) {
  const entry = schemas[typeName];
  for (const [cardId, data] of cardsByType[typeName]) {
    const origem = data[entry.origin_field];
    if (origem && !necessidades.has(origem)) {
      errors.push(
        `Órfão: ${entry.output_dir}/${cardId}.yaml referencia necessidade_origem "${origem}", que não existe em necessidades/`
      );
    }
  }
}

// 2. Necessidades sem cartão nem falha registrada
const prefixByTipo = {
  user_story: schemas.user_story.id_prefix,
  caso_de_uso: schemas.caso_de_uso.id_prefix,
  regra_de_negocio: schemas.regra_de_negocio.id_prefix,
  requisito_nao_funcional: schemas.requisito_nao_funcional.id_prefix,
};
for (const [necId, data] of necessidades) {
  const tipo = data.tipo;
  if (!CARD_TYPES.includes(tipo)) continue;
  const hasCard = cardFileExists[tipo].has(necId);
  if (hasCard) continue;
  const statuses = statusByNecessidade.get(necId);
  const hasRegisteredFailure =
    statuses && (statuses.has("despachado_falha") || statuses.has("colisao_id_recuperada"));
  if (!hasRegisteredFailure) {
    errors.push(
      `Necessidade sem cartão: ${necId} (tipo ${tipo}) não tem cartão correspondente em nenhum RUN-*.yaml nem falha de despacho registrada`
    );
  }
}

// 3. substitui apontando para necessidade inexistente
for (const [necId, data] of necessidades) {
  if (data.substitui && !necessidades.has(data.substitui)) {
    errors.push(
      `Referência quebrada: ${necId} tem substitui: "${data.substitui}", que não existe em necessidades/`
    );
  }
}

// 4. Aviso: referências cruzadas apontando para IDs inexistentes (best-effort, não falha)
for (const typeName of CARD_TYPES) {
  const entry = schemas[typeName];
  for (const [cardId, data] of cardsByType[typeName]) {
    for (const fieldName of Object.keys(CROSS_REF_TARGET_TYPE)) {
      const refs = data[fieldName];
      if (!Array.isArray(refs)) continue;
      const targetType = CROSS_REF_TARGET_TYPE[fieldName];
      const targetMap = cardsByType[targetType];
      for (const ref of refs) {
        if (!targetMap.has(ref)) {
          warnings.push(
            `Referência cruzada não encontrada: ${entry.output_dir}/${cardId}.yaml -> ${fieldName}: "${ref}" (não existe em ${schemas[targetType].output_dir}/)`
          );
        }
      }
    }
  }
}

// --- Report ---
console.log(`Verificação de integridade em ${TARGET_DIR}`);
console.log(`Necessidades: ${necessidades.size}`);
for (const typeName of CARD_TYPES) {
  console.log(`  ${typeName}: ${cardsByType[typeName].size} cartão(ões)`);
}
console.log("");

if (errors.length === 0) {
  console.log("Nenhum erro de integridade encontrado.");
} else {
  console.log(`${errors.length} erro(s) de integridade:`);
  for (const e of errors) console.log(`  - ${e}`);
}

if (warnings.length > 0) {
  console.log("");
  console.log(`${warnings.length} aviso(s) (não bloqueiam, referências cruzadas são melhor esforço):`);
  for (const w of warnings) console.log(`  - ${w}`);
}

process.exit(errors.length === 0 ? 0 : 1);
