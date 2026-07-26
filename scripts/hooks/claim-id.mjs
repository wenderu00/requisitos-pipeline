#!/usr/bin/env node

import {
  openSync,
  closeSync,
  existsSync,
  mkdirSync,
  readFileSync,
  constants,
} from "node:fs";
import path from "node:path";

const CLAIM_PATTERNS = [
  { re: /^necessidades\/N-\d+\.yaml$/, neverOverwrite: true },
  { re: /^necessidades\/_execucoes\/RUN-\d+\.yaml$/, neverOverwrite: false },
];

function allow() {
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: "allow",
      },
    })
  );
  process.exit(0);
}

function deny(reason) {
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: "deny",
        permissionDecisionReason: reason,
      },
    })
  );
  process.exit(0);
}

function passthrough() {
  process.exit(0);
}

function tryClaim(absPath, neverOverwrite, retryOnMissingDir = true) {
  if (existsSync(absPath)) {
    return neverOverwrite
      ? { claimed: false, code: "EEXIST" }
      : { claimed: true };
  }

  const lockPath = `${absPath}.lock`;
  try {
    const fd = openSync(
      lockPath,
      constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY
    );
    closeSync(fd);
  } catch (err) {
    if (err.code === "EEXIST") {
      return { claimed: false, code: "EEXIST" };
    }
    if (err.code === "ENOENT" && retryOnMissingDir) {
      mkdirSync(path.dirname(absPath), { recursive: true });
      return tryClaim(absPath, neverOverwrite, false);
    }
    return { claimed: false, code: err.code, error: err };
  }

  return { claimed: true };
}

let raw;
try {
  raw = readFileSync(0, "utf8");
} catch {
  passthrough();
}

let input;
try {
  input = JSON.parse(raw);
} catch {
  passthrough();
}

if (input.hook_event_name !== "PreToolUse" || input.tool_name !== "Write") {
  passthrough();
}

const filePath = input.tool_input && input.tool_input.file_path;
const cwd = input.cwd;
if (!filePath || !cwd) passthrough();

const relPath = path.relative(cwd, filePath).split(path.sep).join("/");
const claimSpec = CLAIM_PATTERNS.find((p) => p.re.test(relPath));
if (!claimSpec) passthrough();

const result = tryClaim(filePath, claimSpec.neverOverwrite);

if (result.claimed) {
  allow();
} else if (result.code === "EEXIST") {
  deny(
    `${relPath} já existe (colisão de ID — possivelmente execução concorrente ou reprocessamento). ` +
      `Refaça o Glob correspondente, recalcule o próximo ID livre e tente o Write novamente com o novo número.`
  );
} else {
  passthrough();
}
