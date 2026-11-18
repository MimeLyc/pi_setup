# Extension Engineering Rules (`extensions/`)

Follow these rules whenever creating, reviewing, or modifying Pi extensions in `extensions/`:

## Structure & Packaging

- Use `extensions/<kebab-name>.ts` for single-file extensions and `extensions/<kebab-name>/index.ts` for multi-file extensions.
- Never place host-provided packages (`@earendil-works/pi-coding-agent`, `@earendil-works/pi-agent-core`, `@earendil-works/pi-ai`, `@earendil-works/pi-tui`, `typebox`) in `dependencies`. Keep them in root `peerDependencies` (`"*"`) and `devDependencies` only.
- Prefer Node.js built-ins (`node:child_process`, `node:fs`, `node:os`, `node:path`) over adding third-party runtime npm packages.

## Portability & Dependency Safety

- Never hardcode user home paths (`/Users/...`, `/home/...`, `C:\\Users\\...`), Homebrew prefixes (`/opt/homebrew/bin/...`), local proxies, or machine hostnames.
- Resolve external binaries via `PATH` or an optional environment variable override (e.g., `process.env.PI_<EXT>_BIN`), check `process.platform`, and degrade gracefully with a warning when an external CLI is absent.
- Use `execFile` / `spawn` without a shell (`shell: false`) when invoking external binaries.
- Document supported platforms, required/optional external CLIs, and environment variables in a top-of-file docblock or `extensions/<name>/README.md`.

## Lifecycle, TUI, and Schema Correctness

- Do not start processes, timers, sockets, or watchers inside the top-level extension factory; defer initialization to `session_start` or on-demand handlers, and clean up idempotently in `session_shutdown`.
- Guard interactive TUI features (`ctx.ui.custom`, overlays, screen decorators) with `ctx.mode === "tui"` checks.
- Import `Type` from `"typebox"`; avoid `Type.Refine()`, `Type.Codec()`, `Type.BigInt()`, `Type.Undefined()`, and `Type.Void()` in tool parameter schemas (enforce custom refinements inside `execute()`).
- Use `agent_settled` rather than `agent_end` when reacting to final run completion.

## Verification

- Run `npm run check:hygiene` (and `npm run typecheck` when `node_modules` is installed) from the repository root before finishing changes.
