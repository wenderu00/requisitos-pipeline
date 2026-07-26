#!/usr/bin/env node

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { load as loadYaml } from "../vendor/js-yaml.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..", "..");

const schemas = JSON.parse(
  readFileSync(path.join(ROOT, "schemas", "schemas.json"), "utf8")
);

const CARD_TYPES = Object.keys(schemas).filter((k) => k !== "fragments");

const PLACEHOLDER_TOKENS = new Set([
  "tbd",
  "n/a",
  "na",
  "a definir",
  "não especificado",
  "nao especificado",
  "todo",
  "xxx",
]);

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function matchCardType(relPath) {
  for (const typeName of CARD_TYPES) {
    const entry = schemas[typeName];
    const re = new RegExp(
      `^${escapeRegExp(entry.output_dir)}/${escapeRegExp(entry.id_prefix)}\\d+\\.yaml$`
    );
    if (re.test(relPath)) return typeName;
  }
  return null;
}

function validateFields(fieldsSpec, dataObj, pathPrefix, errors, enumsMap) {
  for (const spec of fieldsSpec) {
    const val =
      dataObj && typeof dataObj === "object" ? dataObj[spec.name] : undefined;
    const fullName = pathPrefix ? `${pathPrefix}.${spec.name}` : spec.name;
    const isNull = val === null || val === undefined;

    if (isNull) {
      if (!spec.nullable) {
        errors.push(`${fullName}: campo obrigatório está ausente ou null`);
      }
      continue;
    }

    switch (spec.type) {
      case "string": {
        if (typeof val !== "string") {
          errors.push(`${fullName}: esperado string, veio ${typeof val}`);
          break;
        }
        if (spec.min_len && val.length < spec.min_len) {
          errors.push(
            `${fullName}: muito curto (tem ${val.length} caracteres, mínimo ${spec.min_len})`
          );
        }
        if (spec.pattern && !new RegExp(spec.pattern).test(val)) {
          errors.push(
            `${fullName}: valor "${val}" não bate com o padrão esperado (${spec.pattern})`
          );
        }
        if (spec.enum && !spec.enum.includes(val)) {
          errors.push(
            `${fullName}: valor "${val}" não é um dos permitidos (${spec.enum.join(", ")})`
          );
        }
        if (spec.enum_ref) {
          const allowed = enumsMap && enumsMap[spec.enum_ref];
          if (allowed && !allowed.includes(val)) {
            errors.push(
              `${fullName}: valor "${val}" não é um dos permitidos (${allowed.join(", ")})`
            );
          }
        }
        break;
      }
      case "number": {
        if (typeof val !== "number" || Number.isNaN(val)) {
          errors.push(`${fullName}: esperado number, veio ${typeof val}`);
          break;
        }
        if (spec.min !== undefined && val < spec.min) {
          errors.push(`${fullName}: valor ${val} abaixo do mínimo ${spec.min}`);
        }
        if (spec.max !== undefined && val > spec.max) {
          errors.push(`${fullName}: valor ${val} acima do máximo ${spec.max}`);
        }
        break;
      }
      case "boolean": {
        if (typeof val !== "boolean") {
          errors.push(`${fullName}: esperado boolean, veio ${typeof val}`);
        }
        break;
      }
      case "list": {
        if (!Array.isArray(val)) {
          errors.push(`${fullName}: esperado lista, veio ${typeof val}`);
          break;
        }
        if (spec.min_items !== undefined && val.length < spec.min_items) {
          errors.push(
            `${fullName}: precisa ter pelo menos ${spec.min_items} item(ns), tem ${val.length}`
          );
        }
        if (spec.item_fields) {
          val.forEach((item, i) =>
            validateFields(
              spec.item_fields,
              item,
              `${fullName}[${i}]`,
              errors,
              enumsMap
            )
          );
        }
        break;
      }
      case "object": {
        if (typeof val !== "object" || Array.isArray(val)) {
          errors.push(`${fullName}: esperado objeto, veio ${typeof val}`);
          break;
        }
        if (spec.fields) {
          validateFields(spec.fields, val, fullName, errors, enumsMap);
        }
        break;
      }
      default:
        break;
    }
  }
}

function checkIdMatchesFilename(entry, relPath, data, errors) {
  const basename = path.basename(relPath);
  const re = new RegExp(`^${escapeRegExp(entry.id_prefix)}(\\d+)\\.yaml$`);
  const m = basename.match(re);
  if (!m) return;
  const expectedId = `${entry.id_prefix}${m[1]}`;
  const actualId = data ? data[entry.id_field] : undefined;
  if (actualId !== expectedId) {
    errors.push(
      `${entry.id_field}: é "${actualId}", mas o nome do arquivo (${basename}) implica "${expectedId}"`
    );
  }
}

function findSparseFields(entry, data) {
  let exampleData = null;
  try {
    exampleData = loadYaml(entry.example_yaml);
  } catch {
    return [];
  }

  const sparse = [];
  for (const spec of entry.required_fields) {
    if (spec.type !== "string") continue;
    if (spec.enum || spec.enum_ref) continue;
    const val = data ? data[spec.name] : undefined;
    if (typeof val !== "string") continue;
    const trimmed = val.trim().toLowerCase();
    if (PLACEHOLDER_TOKENS.has(trimmed)) {
      sparse.push(spec.name);
      continue;
    }
    const exampleVal = exampleData ? exampleData[spec.name] : undefined;
    if (
      typeof exampleVal === "string" &&
      trimmed === exampleVal.trim().toLowerCase()
    ) {
      sparse.push(spec.name);
    }
  }
  return sparse;
}

function fail(messages) {
  process.stderr.write(messages.join("\n") + "\n");
  process.exit(2);
}

function approveWithContext(additionalContext) {
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "PostToolUse",
        additionalContext,
      },
    })
  );
  process.exit(0);
}

let raw;
try {
  raw = readFileSync(0, "utf8");
} catch {
  process.exit(0);
}

let input;
try {
  input = JSON.parse(raw);
} catch {
  process.exit(0);
}

if (input.hook_event_name !== "PostToolUse" || input.tool_name !== "Write") {
  process.exit(0);
}

const filePath = input.tool_input && input.tool_input.file_path;
const cwd = input.cwd;
if (!filePath || !cwd) process.exit(0);

const relPath = path.relative(cwd, filePath).split(path.sep).join("/");
const typeName = matchCardType(relPath);
if (!typeName) process.exit(0);

let content;
try {
  content = readFileSync(filePath, "utf8");
} catch {
  process.exit(0);
}

let data;
try {
  data = loadYaml(content);
} catch (err) {
  fail([
    `YAML inválido em ${relPath}:`,
    String(err.message || err),
    "",
    "Reescreva o arquivo com Write corrigindo o erro de sintaxe apontado acima " +
      "(provavelmente aspas, dois-pontos ou '#' não escapados vindos do texto de origem).",
  ]);
}

const entry = schemas[typeName];
const errors = [];
validateFields(entry.required_fields, data, "", errors, entry.enums);
checkIdMatchesFilename(entry, relPath, data, errors);

if (errors.length > 0) {
  fail([
    `Schema inválido em ${relPath} (tipo "${typeName}"):`,
    ...errors.map((e) => `  - ${e}`),
    "",
    "Reescreva o arquivo com Write corrigindo os campos listados acima.",
  ]);
}

const confianca = data && (data["confiança"] ?? data["confianca"]);
if (typeof confianca === "number" && confianca >= 0.8) {
  const sparse = findSparseFields(entry, data);
  if (sparse.length >= 2) {
    approveWithContext(
      `Aviso de calibração para ${relPath}: confiança=${confianca} mas os campos ` +
        `[${sparse.join(", ")}] estão vazios, com placeholder, ou idênticos ao exemplo do schema. ` +
        `Trate isso como um sinal de revisão manual mesmo com confiança alta.`
    );
  }
}

process.exit(0);
