# Pi Extensions

This directory hosts custom TypeScript extensions for the Pi coding agent. Every extension in this repository is published as part of a public, cross-machine setup package and must remain portable, dependency-clean, and safe across interactive and headless runs.

---

## Available Extensions

| Resource | Behavior | Dependencies |
| --- | --- | --- |
| [`copy-mode-ime/index.ts`](./copy-mode-ime/README.md) | Use English in copy mode; remember and restore the writing source for comments, exit, reload, and shutdown. | macOS, Pi 1.5.2 fullscreen TUI (development target), `@luan.sh/pi-copy-mode` 0.3.4, and `macism` or `im-select` on `PATH`. |

For a one-off session from the repository root, load `pi -e ./extensions/copy-mode-ime/index.ts` with copy-mode installed separately. The [companion README](./copy-mode-ime/README.md) covers all `PI_COPY_MODE_IME_*` variables, optional CLI overrides, resource disabling, and compatibility with upstream internal Registry IDs.

---

## Directory Layout

Pi discovers extension entry points declared in the root `package.json` (`./extensions/*.ts` and `./extensions/*/index.ts`):

```text
extensions/
├── README.md                 # Developer & usage documentation (this file)
├── AGENTS.md                 # Rules for AI coding agents editing extensions
├── <simple-ext>.ts           # Single-file extension (< ~200 lines, self-contained)
└── <complex-ext>/            # Multi-module extension directory
    ├── index.ts              # Entry point exporting default (pi: ExtensionAPI) => void
    ├── README.md             # Required when an extension needs OS/CLI setup or config
    └── ...                   # Internal modules (state, UI, helpers)
```

> **Note:** Do not place standalone extensions deeper than one directory level without an `index.ts` entry point; bare nested files (e.g., `extensions/group/foo.ts`) are ignored by `./extensions/*/index.ts`.

---

## Usage & Loading

### 1. Load via the Repository Package (Recommended)

Install this repository once as a local or Git Pi package:

```bash
# From a local checkout (loads in place; supports hot-reload)
pi install /path/to/pi_setup

# Or from a public Git repository
pi install git:github.com/<owner>/pi_setup
```

After editing any extension in a local checkout, run `/reload` inside Pi to hot-reload changes immediately.

### 2. Enable or Disable Individual Extensions

Consumers do not have to enable every extension in this repository. Use `pi config` interactively or filter resources in `~/.pi/agent/settings.json`:

```json
{
  "packages": [
    {
      "source": "/path/to/pi_setup",
      "extensions": [
        "extensions/*.ts",
        "extensions/*/index.ts",
        "-extensions/example-disabled.ts"
      ]
    }
  ]
}
```

### 3. Quick One-Off Testing

Test a single extension in isolation without modifying `settings.json`:

```bash
pi -e ./extensions/<extension-name>.ts
```

---

## Runtime & Environment Dependencies

### Host Requirements

- **Pi Coding Agent**: `>= 1.0.0`
- **Node.js**: `>= 20.0.0` (for local typechecking and hygiene scripts)

### Host-Provided Packages (`peerDependencies` Only)

Pi maps its core packages to its own runtime instances so extensions share registries, themes, and classes:

| Package | Purpose |
| --- | --- |
| `@earendil-works/pi-coding-agent` | `ExtensionAPI`, `ExtensionContext`, lifecycle events, helpers |
| `@earendil-works/pi-agent-core` | Agent message and tool execution types |
| `@earendil-works/pi-ai` | Model, provider, and `StringEnum` utilities |
| `@earendil-works/pi-tui` | TUI components, key matching (`matchesKey`), layout helpers |
| `typebox` | JSON Schema builders (`Type.Object`, `Type.String`, etc.) |

**Strict Rule:** Never add any of the five packages above to `dependencies` in `package.json`. Keep them exclusively in `peerDependencies` (`"*"`) and `devDependencies` (for local `tsc` typechecking). Installing physical runtime copies breaks Pi's ESM singleton mapping.

### External CLI & OS Dependency Policy

Extensions in a public repository must **never** assume a specific developer's workstation setup:

1. **Resolve binaries via `PATH` or environment variables**:
   - Never hardcode `/opt/homebrew/bin/...`, `/usr/local/bin/...`, or `/Users/<name>/...`.
   - Allow users to override binary paths via namespaced environment variables (e.g., `PI_IME_BIN`).
2. **Check platform and availability at runtime**:
   - Guard OS-specific logic with `process.platform` checks (`"darwin"`, `"linux"`, `"win32"`).
   - Probe external tools asynchronously or lazily when first needed; cache the result per session.
3. **Fail gracefully**:
   - If an optional external tool (such as `im-select`, `macism`, `tmux`, or `gh`) is missing, emit a single non-fatal `ctx.ui.notify(..., "warning")` (or stay inert) instead of throwing unhandled exceptions or blocking the session.
4. **Document prerequisites**:
   - Every extension that calls an external binary or reads an environment variable must document it in a module docblock (for single-file extensions) or `extensions/<name>/README.md` (for directory extensions).

---

## Extension Development Best Practices

### 1. Lifecycle & Resource Cleanup

- **No side effects in the factory function**: Pi may invoke the default export in CLI modes (such as `pi --list-models`) that never start an interactive session. Do **not** spawn child processes, open sockets, start timers, or start file watchers at module load or inside the top-level factory.
- **Start in `session_start`, clean up in `session_shutdown`**: Lazily initialize session-scoped resources in `session_start` (or when the command/tool is invoked) and register an **idempotent** `session_shutdown` handler that disposes timers, listeners, status entries, and child processes across `/reload`, fork, resume, and exit.
- **Use `agent_settled` for final idle state**: `agent_end` fires between automatic retries, compaction continuations, and queued follow-up messages; use `agent_settled` when waiting for the agent run to become truly idle.

### 2. TUI vs. Headless / RPC Mode Safety

- Pi runs in interactive TUI mode (`ctx.mode === "tui"`) as well as print, JSON, and RPC modes.
- Guard custom overlays (`ctx.ui.custom`), fullscreen screen decorators, and pointer hooks behind `ctx.mode === "tui"` checks, and provide either a clean fallback or a clear warning when invoked outside TUI mode.

### 3. Tool Schemas (TypeBox Constraints)

Pi validates tool parameters as pure JSON Schema. Follow these constraints when defining `parameters` with `typebox`:

- Import `Type` and `Static` directly from `"typebox"` (not re-exported `@earendil-works/pi-ai`).
- Do **not** rely on `Type.Refine()`, `Type.Codec()`, or custom `Format.Set()` validators—validate domain refinements explicitly inside `execute()`.
- Never use non-JSON types (`Type.BigInt()`, `Type.Undefined()`, `Type.Void()`) in tool schemas.

### 4. Namespace Everything

Prefix registered commands, tools, status bar keys (`ctx.ui.setStatus`), widgets (`ctx.ui.setWidget`), and `Symbol.for(...)` cross-extension keys with the extension's name (for example, `copy-mode-ime.active`) to avoid collisions with third-party packages.

### 5. Security & Secret Hygiene

- Extensions execute with full user OS permissions. Validate untrusted inputs and pass argument arrays to `execFile` / `spawn` (`shell: false`) instead of interpolating strings into shell commands.
- Never log, persist, or render environment secret values into transcripts, tool results, or status lines.

---

## Minimal Extension Template

```typescript
/**
 * Extension: example-guard
 * Platforms: macOS, Linux, Windows
 * External Dependencies: none
 * Environment Variables: EXAMPLE_GUARD_STRICT ("1" to block instead of confirm)
 */
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

const STATUS_KEY = "example-guard.status";

export default function exampleGuardExtension(pi: ExtensionAPI): void {
  let active = false;

  const cleanup = (): void => {
    active = false;
  };

  pi.on("session_start", (_event, ctx) => {
    active = true;
    if (ctx.mode === "tui") {
      ctx.ui.setStatus(STATUS_KEY, undefined);
    }
  });

  pi.on("session_shutdown", (_event, ctx) => {
    cleanup();
    if (ctx.mode === "tui") {
      ctx.ui.setStatus(STATUS_KEY, undefined);
    }
  });
}
```

---

## Local Verification

Before committing new or modified extensions, run from the repository root:

```bash
# Install devDependencies once for TypeScript definitions
npm install

# Run typechecking and public-repo hygiene checks
npm run typecheck
npm run check:hygiene
```
