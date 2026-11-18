import { execFileSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const packageDir = join(root, "packages", "copy-mode-ime");
const templatePath = join(packageDir, "package.template.json");
const outputDir = join(root, "dist");
const npmCli = process.env.npm_execpath;
const args = process.argv.slice(2);
if (!npmCli || args.some((arg) => arg !== "--dry-run")) {
  throw new Error("Use npm run pack:copy-mode-ime [-- --dry-run].");
}

/** @type {{ files: string[] }} */
const manifest = JSON.parse(readFileSync(templatePath, "utf8"));
const stage = mkdtempSync(join(tmpdir(), "pi-copy-mode-ime-pack-"));
try {
  copyFileSync(templatePath, join(stage, "package.json"));
  copyFileSync(join(packageDir, "README.md"), join(stage, "README.md"));
  for (const path of ["LICENSE", ...manifest.files]) {
    const destination = join(stage, path);
    mkdirSync(dirname(destination), { recursive: true });
    copyFileSync(join(root, path), destination);
  }

  if (!args.includes("--dry-run")) mkdirSync(outputDir, { recursive: true });
  execFileSync(process.execPath, [npmCli, "pack", "--ignore-scripts", "--pack-destination", outputDir, ...args], {
    cwd: stage,
    stdio: "inherit",
  });
} finally {
  rmSync(stage, { recursive: true, force: true });
}
