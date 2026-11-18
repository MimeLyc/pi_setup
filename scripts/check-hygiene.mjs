#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { readFileSync, statSync } from "node:fs";
import { basename, extname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const selfRelPath = "scripts/check-hygiene.mjs";

const ALLOWED_PATH_PLACEHOLDERS = new Set([
  "<name>",
  "<user>",
  "<username>",
  "...",
  "user",
  "username",
  "example",
  "your-user",
  "yourname",
  "runner",
]);

/** @type {Array<{ test: (path: string) => boolean; reason: string }>} */
const FORBIDDEN_FILE_PATTERNS = [
  { test: (p) => basename(p) === "auth.json", reason: "Pi auth credentials file" },
  { test: (p) => /^\.env(\.|$)/.test(basename(p)) && basename(p) !== ".env.example", reason: "Environment secret file" },
  { test: (p) => /\.local\.(json|ya?ml|toml|md|ts|js)$/i.test(p), reason: "Machine-local override file" },
  { test: (p) => /\.(pem|key|p12|pfx)$/i.test(p), reason: "Private key / certificate material" },
  { test: (p) => /\.jsonl$/i.test(p), reason: "Session transcript / JSONL log" },
];

/** @type {Array<{ name: string; regex: RegExp; allow?: (match: RegExpExecArray, file: string) => boolean }>} */
const CONTENT_RULES = [
  {
    name: "Hardcoded macOS user home path (/Users/<name>)",
    regex: /\/Users\/([A-Za-z0-9._-]+|\<[^>/]+\>)/g,
    allow: (m) => ALLOWED_PATH_PLACEHOLDERS.has((m[1] ?? "").toLowerCase()),
  },
  {
    name: "Hardcoded Linux user home path (/home/<name>)",
    regex: /\/home\/([A-Za-z0-9._-]+|\<[^>/]+\>)/g,
    allow: (m) => ALLOWED_PATH_PLACEHOLDERS.has((m[1] ?? "").toLowerCase()),
  },
  {
    name: "Hardcoded Windows user home path (C:\\Users\\<name>)",
    regex: /[A-Za-z]:\\Users\\([A-Za-z0-9._-]+|\<[^>\\]+\>)/g,
    allow: (m) => ALLOWED_PATH_PLACEHOLDERS.has((m[1] ?? "").toLowerCase()),
  },
  {
    name: "Hardcoded local proxy setting in JSON config",
    regex: /"(?:httpProxy|httpsProxy)"\s*:\s*"https?:\/\/(?:127\.0\.0\.1|localhost):\d+/g,
    allow: (_m, file) => extname(file) !== ".json",
  },
  {
    name: "API secret key (Anthropic / OpenAI / OpenRouter)",
    regex: /\bsk-(?:ant|proj|or-v1)-[A-Za-z0-9_-]{16,}\b/g,
  },
  {
    name: "GitHub personal access or OAuth token",
    regex: /\b(?:ghp_[A-Za-z0-9]{30,}|gho_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,})\b/g,
  },
  {
    name: "AWS access key ID",
    regex: /\bAKIA[0-9A-Z]{16}\b/g,
  },
  {
    name: "Slack token",
    regex: /\bxox[baprs]-[0-9A-Za-z-]{16,}\b/g,
  },
  {
    name: "PEM private key block",
    regex: /-----BEGIN [A-Z0-9 ]*PRIVATE KEY-----/g,
  },
];

function listCandidateFiles() {
  const out = execFileSync(
    "git",
    ["ls-files", "-z", "--cached", "--others", "--exclude-standard"],
    { cwd: repoRoot, encoding: "utf8" },
  );
  return out
    .split("\0")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

const violations = [];
const files = listCandidateFiles();
let scannedCount = 0;

for (const relPath of files) {
  for (const forbidden of FORBIDDEN_FILE_PATTERNS) {
    if (forbidden.test(relPath)) {
      violations.push(`${relPath}: forbidden file (${forbidden.reason})`);
    }
  }

  if (relPath === selfRelPath) continue;

  const fullPath = resolve(repoRoot, relPath);
  let stats;
  try {
    stats = statSync(fullPath);
  } catch {
    continue;
  }
  if (!stats.isFile() || stats.size === 0 || stats.size > 1_048_576) continue;

  const buffer = readFileSync(fullPath);
  if (buffer.includes(0)) continue; // Skip binary files.

  scannedCount += 1;
  const lines = buffer.toString("utf8").split(/\r?\n/);

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? "";
    for (const rule of CONTENT_RULES) {
      rule.regex.lastIndex = 0;
      let match = rule.regex.exec(line);
      while (match !== null) {
        if (!rule.allow || !rule.allow(match, relPath)) {
          violations.push(`${relPath}:${index + 1}: ${rule.name} -> ${match[0]}`);
        }
        match = rule.regex.exec(line);
      }
    }
  }
}

if (violations.length > 0) {
  console.error("[FAIL] Public repository hygiene check failed:");
  for (const v of violations) {
    console.error(`  - ${v}`);
  }
  process.exit(1);
}

console.log(`[OK] Hygiene check passed (${scannedCount} text files scanned).`);
