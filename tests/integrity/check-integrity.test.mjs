#!/usr/bin/env node

import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCRIPT = path.join(__dirname, "..", "..", "scripts", "check-integrity.mjs");

function makeTree(files) {
  const dir = mkdtempSync(path.join(os.tmpdir(), "check-integrity-test-"));
  for (const [relPath, content] of Object.entries(files)) {
    const absPath = path.join(dir, relPath);
    mkdirSync(path.dirname(absPath), { recursive: true });
    writeFileSync(absPath, content, "utf8");
  }
  return dir;
}

function run(dir) {
  const res = spawnSync("node", [SCRIPT, dir], { encoding: "utf8" });
  return { status: res.status, stdout: res.stdout, stderr: res.stderr };
}

test("árvore limpa: uma necessidade, um cartão, sem problemas", () => {
  const dir = makeTree({
    "necessidades/N-1.yaml": 'necessidade_id: N-1\ntipo: user_story\nsubstitui: null\n',
    "user-stories/US-1.yaml":
      'user_story_id: US-1\nnecessidade_origem: N-1\nregras_relacionadas: []\nrnfs_relacionados: []\ncasos_de_uso_relacionados: []\n',
  });
  const { status, stdout } = run(dir);
  assert.equal(status, 0);
  assert.match(stdout, /Nenhum erro de integridade encontrado/);
  rmSync(dir, { recursive: true, force: true });
});

test("cartão órfão: necessidade_origem não existe", () => {
  const dir = makeTree({
    "necessidades/N-1.yaml": 'necessidade_id: N-1\ntipo: user_story\n',
    "user-stories/US-1.yaml": 'user_story_id: US-1\nnecessidade_origem: N-1\n',
    "user-stories/US-2.yaml": 'user_story_id: US-2\nnecessidade_origem: N-99\n',
  });
  const { status, stdout } = run(dir);
  assert.equal(status, 1);
  assert.match(stdout, /Órfão.*US-2\.yaml.*N-99/s);
  rmSync(dir, { recursive: true, force: true });
});

test("necessidade sem cartão e sem falha registrada: erro", () => {
  const dir = makeTree({
    "necessidades/N-1.yaml": 'necessidade_id: N-1\ntipo: user_story\n',
  });
  const { status, stdout } = run(dir);
  assert.equal(status, 1);
  assert.match(stdout, /Necessidade sem cartão: N-1/);
  rmSync(dir, { recursive: true, force: true });
});

test("necessidade sem cartão mas com falha de despacho registrada: sem erro", () => {
  const dir = makeTree({
    "necessidades/N-1.yaml": 'necessidade_id: N-1\ntipo: user_story\n',
    "necessidades/_execucoes/RUN-1.yaml":
      "execucao_id: RUN-1\nconcluido: true\nnecessidades:\n  - necessidade_id: N-1\n    status: despachado_falha\n",
  });
  const { status, stdout } = run(dir);
  assert.equal(status, 0);
  assert.match(stdout, /Nenhum erro de integridade encontrado/);
  rmSync(dir, { recursive: true, force: true });
});

test("substitui apontando para necessidade inexistente: erro", () => {
  const dir = makeTree({
    "necessidades/N-2.yaml": 'necessidade_id: N-2\ntipo: user_story\nsubstitui: N-1\n',
    "user-stories/US-2.yaml": 'user_story_id: US-2\nnecessidade_origem: N-2\n',
  });
  const { status, stdout } = run(dir);
  assert.equal(status, 1);
  assert.match(stdout, /Referência quebrada: N-2 tem substitui: "N-1"/);
  rmSync(dir, { recursive: true, force: true });
});

test("referência cruzada para ID inexistente: aviso, não erro", () => {
  const dir = makeTree({
    "necessidades/N-1.yaml": 'necessidade_id: N-1\ntipo: user_story\n',
    "user-stories/US-1.yaml":
      'user_story_id: US-1\nnecessidade_origem: N-1\nregras_relacionadas: ["RN-99"]\n',
  });
  const { status, stdout } = run(dir);
  assert.equal(status, 0);
  assert.match(stdout, /aviso/);
  assert.match(stdout, /RN-99/);
  rmSync(dir, { recursive: true, force: true });
});
