#!/usr/bin/env node

import { readFileSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { load as loadYaml } from "../../scripts/vendor/js-yaml.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..", "..");
const FIXTURES_DIR = path.join(ROOT, "tests", "fixtures");
const RUNS_DIR = path.join(ROOT, "tests", "eval", ".runs");
const schemas = JSON.parse(readFileSync(path.join(ROOT, "schemas", "schemas.json"), "utf8"));

const SEGUNDA_EXECUCAO_MARKER = "---SEGUNDA-EXECUCAO---";
const CLI_TIMEOUT_MS = 6 * 60 * 1000;

const filterArg = process.argv[2];

function listFixtures() {
  return readdirSync(FIXTURES_DIR, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .filter((name) => !filterArg || name.includes(filterArg))
    .sort();
}

function readNecessidades(scratchDir) {
  const dir = path.join(scratchDir, "necessidades");
  let files;
  try {
    files = readdirSync(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  const result = [];
  for (const entry of files) {
    if (!entry.isFile() || !/^N-\d+\.yaml$/.test(entry.name)) continue;
    const raw = readFileSync(path.join(dir, entry.name), "utf8");
    try {
      const data = loadYaml(raw);
      if (data) result.push(data);
    } catch (err) {
      console.log(`    ! ${entry.name} não parseou como YAML: ${err.message.split("\n")[0]}`);
    }
  }
  return result;
}

function readIndice(scratchDir) {
  const filePath = path.join(scratchDir, "necessidades", "_indice", "INDEX.yaml");
  try {
    const data = loadYaml(readFileSync(filePath, "utf8"));
    return data && Array.isArray(data.entradas) ? data : { entradas: [] };
  } catch {
    return { entradas: [] };
  }
}

function readCards(scratchDir, tipoName) {
  const entry = schemas[tipoName];
  const dir = path.join(scratchDir, entry.output_dir);
  let files;
  try {
    files = readdirSync(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  const idRe = new RegExp(`^${entry.id_prefix}\\d+\\.yaml$`);
  const result = [];
  for (const f of files) {
    if (!f.isFile() || !idRe.test(f.name)) continue;
    try {
      const data = loadYaml(readFileSync(path.join(dir, f.name), "utf8"));
      if (data) result.push(data);
    } catch {
      // arquivo malformado é reportado pelo hook de validação, não pela suíte de classificação
    }
  }
  return result;
}

function runClassifier(scratchDir, transcriptText) {
  mkdirSync(scratchDir, { recursive: true });
  const prompt = `Use o agente classificador-requisitos para classificar os requisitos deste transcript:\n\n${transcriptText}`;
  const result = spawnSync(
    "claude",
    [
      "-p",
      "--plugin-dir",
      ROOT,
      "--dangerously-skip-permissions",
      "--output-format",
      "json",
      prompt,
    ],
    {
      cwd: scratchDir,
      env: { ...process.env, CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH: "3" },
      encoding: "utf8",
      timeout: CLI_TIMEOUT_MS,
      maxBuffer: 100 * 1024 * 1024,
    }
  );
  return result;
}

function runFixture(name) {
  const dir = path.join(FIXTURES_DIR, name);
  const inputText = readFileSync(path.join(dir, "input.md"), "utf8");
  const expected = loadYaml(readFileSync(path.join(dir, "expected.yaml"), "utf8"));

  const scratchDir = path.join(RUNS_DIR, `${name}-${process.pid}-${Date.now()}`);

  console.log(`\n=== ${name} ===`);

  const parts = expected.segunda_execucao
    ? inputText.split(SEGUNDA_EXECUCAO_MARKER).map((s) => s.trim())
    : [inputText.trim()];

  for (let i = 0; i < parts.length; i++) {
    const label = parts.length > 1 ? ` (execução ${i + 1}/${parts.length})` : "";
    console.log(`  rodando classificador-requisitos${label}...`);
    const result = runClassifier(scratchDir, parts[i]);
    if (result.error) {
      return { name, pass: false, reason: `erro ao invocar claude CLI: ${result.error.message}` };
    }
    if (result.status !== 0 && result.signal) {
      return { name, pass: false, reason: `claude CLI foi encerrado por timeout/sinal (${result.signal}) — considere aumentar CLI_TIMEOUT_MS` };
    }
    try {
      const out = JSON.parse(result.stdout);
      const custo = typeof out.total_cost_usd === "number" ? `US$ ${out.total_cost_usd.toFixed(4)}` : "?";
      const tempo = typeof out.duration_ms === "number" ? `${(out.duration_ms / 1000).toFixed(1)}s` : "?";
      console.log(`  custo: ${custo} · tempo: ${tempo}`);
    } catch {
      // saída não-JSON (ex. erro do CLI): sem métrica, a checagem abaixo segue normal
    }
  }

  const necessidades = readNecessidades(scratchDir);
  const tiposEncontrados = necessidades.map((n) => n.tipo).filter(Boolean);

  const tiposEsperados = expected.tipos_esperados || [];
  const faltando = tiposEsperados.filter((t) => !tiposEncontrados.includes(t));
  const extras = [...new Set(tiposEncontrados.filter((t) => !tiposEsperados.includes(t)))];

  const problemas = [];

  if (faltando.length > 0) {
    problemas.push(`tipo(s) esperado(s) não apareceu(ram): ${faltando.join(", ")}`);
  }
  if (typeof expected.minimo_necessidades === "number" && necessidades.length < expected.minimo_necessidades) {
    problemas.push(`gerou ${necessidades.length} necessidade(s), esperava pelo menos ${expected.minimo_necessidades}`);
  }
  if (typeof expected.maximo_necessidades === "number" && necessidades.length > expected.maximo_necessidades) {
    problemas.push(`gerou ${necessidades.length} necessidade(s), esperava no máximo ${expected.maximo_necessidades}`);
  }
  if (expected.require_duplicate_flag) {
    const temDuplicataSinalizada = necessidades.some((n) => n.possivel_duplicata_de);
    if (!temDuplicataSinalizada) {
      problemas.push("nenhuma necessidade foi sinalizada com possivel_duplicata_de (esperado após a 2ª execução)");
    }
  }

  const indice = readIndice(scratchDir);
  if (necessidades.length > 0 && indice.entradas.length !== necessidades.length) {
    problemas.push(
      `índice central (INDEX.yaml) tem ${indice.entradas.length} entrada(s), esperado ${necessidades.length} (uma por necessidade)`
    );
  }

  if (expected.require_substitui_flag) {
    const temSubstitui = necessidades.some((n) => n.substitui);
    if (!temSubstitui) {
      problemas.push("nenhuma necessidade tem substitui preenchido (esperada reclassificação explícita)");
    }
  }

  if (expected.require_cross_reference) {
    const { tipo, campo } = expected.require_cross_reference;
    const cards = readCards(scratchDir, tipo);
    const temReferencia = cards.some((c) => Array.isArray(c[campo]) && c[campo].length > 0);
    if (!temReferencia) {
      problemas.push(`nenhum cartão do tipo "${tipo}" tem "${campo}" preenchido (esperada referência cruzada)`);
    }
  }

  console.log(`  necessidades geradas: ${necessidades.length} (tipos: ${tiposEncontrados.join(", ") || "nenhum"})`);
  if (extras.length > 0) {
    console.log(`  (info) tipo(s) além do esperado: ${extras.join(", ")} — não reprova, split de necessidades é ambíguo por natureza`);
  }

  return {
    name,
    pass: problemas.length === 0,
    reason: problemas.join("; "),
    scratchDir,
  };
}

mkdirSync(RUNS_DIR, { recursive: true });

const fixtures = listFixtures();
if (fixtures.length === 0) {
  console.error(`Nenhum fixture encontrado${filterArg ? ` para o filtro "${filterArg}"` : ""}.`);
  process.exit(1);
}

console.log(`Rodando ${fixtures.length} fixture(s) — cada um invoca o Claude Code CLI de verdade, isso custa tempo e chamadas de API reais.`);

const results = fixtures.map(runFixture);

console.log("\n=== Resultado ===");
let anyFail = false;
for (const r of results) {
  if (r.pass) {
    console.log(`PASS  ${r.name}`);
  } else {
    anyFail = true;
    console.log(`FAIL  ${r.name} — ${r.reason}`);
    console.log(`      (scratch dir preservado para inspeção: ${r.scratchDir})`);
  }
}
console.log(`\n${results.filter((r) => r.pass).length}/${results.length} fixtures passaram.`);

if (!anyFail) {
  for (const r of results) {
    if (r.scratchDir) rmSync(r.scratchDir, { recursive: true, force: true });
  }
}

process.exit(anyFail ? 1 : 0);
