# Repository Guidelines

This is a **public** repository for maintaining portable [Pi](https://pi.dev) coding-agent setup templates, extensions, skills, prompt templates, and themes. Every file committed here is intended to be safe, reusable, and reproducible across different machines and operating systems.

## Public Repository Mandates (Non-Negotiable)

1. **No Machine-Bound Content (Portability First)**:
   - Never commit hardcoded user home paths (`/Users/<name>`, `/home/<name>`, `C:\\Users\\<name>`), machine hostnames, usernames, or workstation-specific directories. Resolve paths dynamically via `os.homedir()`, `$HOME`, or relative package paths.
   - Never hardcode local network/proxy assumptions (e.g., `http://127.0.0.1:7890`) or fixed package-manager prefixes (`/opt/homebrew/bin`, `/usr/local/bin`). Look up external CLIs via `PATH` with optional environment variable overrides.
   - Guard OS-specific behavior (`darwin`, `linux`, `win32`) and optional external tools at runtime, degrading gracefully with clear warnings rather than crashing.
2. **Zero Secrets, PII, or Live Runtime State**:
   - Never commit API keys, OAuth tokens, bearer credentials, cookies, private keys, internal/corporate URLs, private IP addresses, or personal identifiers.
   - Reference credentials exclusively by environment variable name (e.g., `"$OPENAI_API_KEY"`) or documented placeholders in `.env.example`.
   - Never commit live `~/.pi/agent/` runtime artifacts (`auth.json`, `sessions/*.jsonl`, `backups/`, `.cmux*`, `*.local.*`, or raw `settings.json` containing personal state). Store sanitized templates under `config/` as `*.example.json`.
3. **Open-Source Tool Setup Standards**:
   - **Non-Destructive Adoption**: Prefer declarative Pi package installation (`pi install`) and resource filtering over scripts that overwrite a user's existing `~/.pi/agent/` files. Any sync/install helper must support `--dry-run` and create backups before mutating user files.
   - **Host Dependency Isolation**: Declare Pi host-provided packages (`@earendil-works/pi-coding-agent`, `@earendil-works/pi-agent-core`, `@earendil-works/pi-ai`, `@earendil-works/pi-tui`, `typebox`) only in `peerDependencies` (`"*"`) and `devDependencies`—never in runtime `dependencies`.
   - **Minimal Supply-Chain Footprint**: Prefer Node.js built-in modules over third-party runtime npm packages, as Pi extensions execute with full user OS permissions.
   - **License & Upstream Attribution**: Keep repository-authored code MIT-compatible and preserve original copyright, license headers, and source URLs whenever adapting third-party skills, prompts, themes, or extensions.
   - **English Documentation**: Keep all public documentation, inline comments, configuration templates, and commit messages in English.

## Project Structure & Module Organization

- `extensions/`: custom Pi TypeScript extensions (`extensions/<name>.ts` or `extensions/<name>/index.ts`). Follow `extensions/AGENTS.md` and `extensions/README.md`.
- `skills/`: reusable Pi skills (`skills/<skill-name>/SKILL.md` plus optional `scripts/` and `references/`).
- `prompts/`: reusable Markdown prompt templates (`prompts/*.md`).
- `themes/`: custom Pi TUI themes (`themes/*.json`).
- `config/`: sanitized, portable Pi configuration and keybinding templates (`*.example.json`).
- `scripts/`: portable developer and CI verification scripts (one task per script, e.g., `scripts/check-hygiene.mjs`).
- `docs/`: design notes, specs (`docs/specs/`), and codebase knowledge (`docs/knowledge/`).

## Build, Test, and Development Commands

- `npm install`: install development-only TypeScript definitions for local IDE and `tsc` checks.
- `npm run check`: run repository hygiene verification (scans for secrets, forbidden files, and hardcoded machine paths).
- `npm run check:hygiene`: run `node ./scripts/check-hygiene.mjs` directly (zero npm install required).
- `npm run typecheck`: run `tsc --noEmit` across `extensions/` and `scripts/`.
- `pi -e ./extensions/<name>.ts`: test an individual extension in an isolated Pi session.

## Coding Style & Naming Conventions

- Indentation: 2 spaces across TypeScript, JavaScript, JSON, YAML, and Markdown (enforced via `.editorconfig`).
- Naming: `kebab-case` for extension, skill, prompt, and theme filenames/directories; `camelCase` for TypeScript functions/variables; `PascalCase` for types/interfaces/classes; `SCREAMING_SNAKE_CASE` for module constants and env var names.
- Process execution: invoke external commands with `execFile` / `spawn` (`shell: false`) using explicit argument arrays.

## Testing Guidelines

- Run `npm run check:hygiene` before every commit to guarantee zero leaked secrets or machine-bound paths.
- Run `npm run typecheck` whenever modifying TypeScript extensions or Node scripts.
- Keep automated tests deterministic (no live network requests, no unmocked machine-specific paths or external credentials).

## Commit & Pull Request Guidelines

- Use Conventional Commits in English (e.g., `feat(extensions): add copy-mode ime switcher`, `docs: clarify extension dependency rules`).
- PRs and commits must include: intent/summary, verification steps (`npm run check:hygiene` and `npm run typecheck`), and explicit documentation of any new environment variables or optional external CLI dependencies.

## Security & Configuration Tips

- Never commit secrets; use environment variable references and keep local overrides in untracked `*.local.*` or `.env` files (ignored via `.gitignore`).
- Document all supported environment variables, OS constraints, and safe defaults in `README.md` or the corresponding module `README.md`.

## Agent Behavior

- Never ask the user questions; decide and proceed.
- If the current directory is a git repo, always check the latest commit and working tree changes to judge progress (e.g., `git log -1`, `git show -1`, `git status`, `git diff`).
- If you decide a change requires updating `README.md`, make the `README.md` updates in English.
- When you need library/API documentation, code generation patterns, or setup/configuration steps, use Context7 MCP first (do not wait for the user to explicitly ask).
- Before finishing any task in this repository, run `npm run check:hygiene` to verify that no secrets, PII, or machine-bound paths were introduced.
- Read `extensions/AGENTS.md` before creating or modifying files under `extensions/`.

# Requirement Rules

If you are asked to design new requirements, treat it as a large and complex task and follow these rules:

- The task requirements live in `docs/specs/<spec_dir>/requirements.md`; read it carefully before working.
- Break large tasks into smaller sub-tasks (and adjust the breakdown as you learn more).
- For each sub-task, write a detailed work plan in `docs/specs/<spec_dir>/plan.md`.
- If a sub-task becomes complex after deeper investigation, further break it down in the work plan.

Track development progress in `docs/specs/<spec_dir>/impl_details/task_progress.md` so you don’t lose sight of overall goals.

During codebase exploration, organize what you learn in `docs/knowledge/*.md`:

- Record facts, details, and code locations (file paths, symbols, behaviors); avoid high-level summaries.
- Before starting work, try to read from existing knowledge first.

If you complete all task items in `docs/specs/<spec_dir>/impl_details/task_progress.md`, start a new task:

- Carefully review current changes (`git diff` and the staging area), compare them with the work plan, and verify that all critical components in the design have been implemented.
- Identify engineering improvements (code quality, performance, readability, modularity, test coverage, correctness) and record them in `docs/specs/<spec_dir>/plan.md`.

Finally, never ask me any questions. You decide everything by yourself. You can always explore the code base and read from existing knowledge to resolve your doubts.
