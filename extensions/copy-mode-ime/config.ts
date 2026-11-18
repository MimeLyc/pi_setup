import { openSync, readSync, closeSync, fstatSync, constants } from "node:fs";
import { homedir } from "node:os";
import { resolve } from "node:path";

export type SourcePolicy = "restore-entry" | "restore-writing" | "keep" | string;
export const HOOK_NAMES = ["copyModeEnter", "commentEnter", "commentExit", "copyModeExit", "sessionShutdown"] as const;
export type HookName = typeof HOOK_NAMES[number];
export type SourceHooks = Record<HookName, SourcePolicy>;

export interface ImeConfig {
  navigationSource: string;
  binary?: string;
  timeoutMs: number;
  hooks?: SourceHooks;
  restoreFallbackSource?: string;
}

const SOURCE_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,255}$/;
const POLICIES = new Set(["restore-entry", "restore-writing", "keep"]);
const MAX_CONFIG_BYTES = 16384;

export function defaultHooks(navigationSource: string): SourceHooks {
  return {
    copyModeEnter: navigationSource,
    commentEnter: "restore-writing",
    commentExit: navigationSource,
    copyModeExit: "restore-writing",
    sessionShutdown: "restore-writing",
  };
}

function object(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function isSourceId(value: unknown): value is string {
  return typeof value === "string" && SOURCE_ID.test(value) && !POLICIES.has(value);
}

function readHookFile(path: string, navigationSource: string): Pick<ImeConfig, "hooks" | "restoreFallbackSource"> {
  // Bound the actual read, including files that grow or have no meaningful stat size.
  const buffer = Buffer.alloc(MAX_CONFIG_BYTES + 1);
  let descriptor: number | undefined;
  let length = 0;
  try {
    const expanded = path.startsWith("~/") ? resolve(homedir(), path.replace(/^~\/+/, "")) : resolve(path);
    descriptor = openSync(expanded, constants.O_RDONLY | constants.O_NONBLOCK);
    if (!fstatSync(descriptor).isFile()) throw new Error("Not a regular file");
    while (length < buffer.length) {
      const count = readSync(descriptor, buffer, length, buffer.length - length, null);
      if (!count) break;
      length += count;
    }
  } catch {
    throw new Error("Cannot read PI_COPY_MODE_IME_CONFIG_FILE. Check the path and file permissions.");
  } finally {
    if (descriptor !== undefined) {
      try { closeSync(descriptor); } catch { /* Never expose a filesystem error. */ }
    }
  }
  if (length > MAX_CONFIG_BYTES) {
    throw new Error("PI_COPY_MODE_IME_CONFIG_FILE exceeds the 16384-byte limit. Use a smaller JSON configuration.");
  }
  let value: unknown;
  try {
    value = JSON.parse(buffer.subarray(0, length).toString("utf8"));
  } catch {
    throw new Error("PI_COPY_MODE_IME_CONFIG_FILE must contain valid JSON. Check its syntax.");
  }
  if (!object(value) || Object.keys(value).some((key) => key !== "hooks" && key !== "restoreFallbackSource") ||
    !object(value.hooks) || Object.keys(value.hooks).some((key) => !(HOOK_NAMES as readonly string[]).includes(key)) ||
    Object.values(value.hooks).some((policy) => typeof policy !== "string" || (!POLICIES.has(policy) && !isSourceId(policy))) ||
    (value.restoreFallbackSource !== undefined && !isSourceId(value.restoreFallbackSource))) {
    throw new Error("Invalid PI_COPY_MODE_IME_CONFIG_FILE schema. Use supported hook names and source IDs or restore-entry, restore-writing, keep policies; check the example configuration.");
  }
  return {
    hooks: { ...defaultHooks(navigationSource), ...value.hooks },
    restoreFallbackSource: value.restoreFallbackSource as string | undefined,
  };
}

/** Read once at session_start; never include configuration values in errors. */
export function readConfig(env: NodeJS.ProcessEnv): ImeConfig {
  const navigationSource = env.PI_COPY_MODE_IME_NAV_SOURCE?.trim() || "com.apple.keylayout.ABC";
  if (!isSourceId(navigationSource)) {
    throw new Error("PI_COPY_MODE_IME_NAV_SOURCE must be a macOS input source ID.");
  }
  const timeout = env.PI_COPY_MODE_IME_TIMEOUT_MS?.trim();
  const timeoutMs = timeout ? Number(timeout) : 1500;
  if (!Number.isInteger(timeoutMs) || timeoutMs < 100 || timeoutMs > 10000) {
    throw new Error("PI_COPY_MODE_IME_TIMEOUT_MS must be an integer from 100 to 10000.");
  }
  const config: ImeConfig = {
    navigationSource,
    binary: env.PI_COPY_MODE_IME_BIN?.trim() || undefined,
    timeoutMs,
  };
  if (env.PI_COPY_MODE_IME_CONFIG_FILE !== undefined) {
    const path = env.PI_COPY_MODE_IME_CONFIG_FILE.trim();
    if (!path) throw new Error("PI_COPY_MODE_IME_CONFIG_FILE must name a JSON file. Unset it to use legacy defaults.");
    Object.assign(config, readHookFile(path, navigationSource));
  }
  return config;
}
