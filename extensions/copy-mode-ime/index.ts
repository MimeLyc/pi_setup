/**
 * macOS input source companion for @luan.sh/pi-copy-mode 0.3.4.
 * See README.md for CLI dependencies, configuration, and internal Registry compatibility.
 */
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { createBackend, readConfig } from "./backend.ts";
import { ImeController } from "./controller.ts";
import { observeRegistry, type RegistryObserver } from "./registry.ts";

const OWNER_KEY = Symbol.for("pi-setup/copy-mode-ime/owner/v1");

export default function copyModeIme(pi: ExtensionAPI): void {
  let controller: ImeController | undefined;
  let observer: RegistryObserver | undefined;
  let warn: ((message: string) => void) | undefined;
  let owner: symbol | undefined;
  let started = false;
  const scope = globalThis as Record<PropertyKey, unknown>;

  pi.on("session_start", (_event, ctx) => {
    if (started) return;
    started = true;
    if (ctx.mode !== "tui" || process.env.PI_COPY_MODE_IME_ENABLED === "0") return;
    let warned = false;
    warn = (message) => {
      if (warned) return;
      warned = true;
      try {
        ctx.ui.notify(`copy-mode-ime: ${message}`, "warning");
      } catch {
        // The UI can already be disposing during a failed shutdown restoration.
      }
    };
    try {
      if (scope[OWNER_KEY] !== undefined) return;
      owner = Symbol("copy-mode-ime owner");
      Object.defineProperty(scope, OWNER_KEY, { value: owner, writable: true, configurable: true });
    } catch {
      owner = undefined;
      warn("Cannot claim the companion runtime. Check duplicate extensions and /reload.");
      return;
    }
    if (process.platform !== "darwin") {
      warn("Only macOS is supported. Disable this extension with pi config or PI_COPY_MODE_IME_ENABLED=0.");
      return;
    }
    try {
      const config = readConfig(process.env);
      controller = new ImeController(createBackend(config), config, warn);
      observer = observeRegistry((state) => controller?.update(state), warn);
    } catch (error) {
      warn(`${error instanceof Error ? error.message : "Initialization failed."} Fix configuration and /reload.`);
    }
  });

  pi.on("resources_discover", () => {
    if (observer && !observer.isAttached()) {
      warn?.("No compatible copy-mode registry was found. Load @luan.sh/pi-copy-mode 0.3.4 and /reload; late registry publication will also be observed.");
    }
  });

  pi.on("session_shutdown", async () => {
    observer?.dispose();
    observer = undefined;
    try {
      await controller?.dispose();
    } finally {
      controller = undefined;
      if (owner !== undefined && scope[OWNER_KEY] === owner) Reflect.deleteProperty(scope, OWNER_KEY);
      owner = undefined;
    }
  });
}
