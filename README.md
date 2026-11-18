# pi_setup

Portable configuration templates, custom extensions, skills, prompt templates, and themes for the [Pi](https://pi.dev) coding agent.

This repository is structured as a standard **Pi Package** so its extensions, skills, prompts, and themes can be installed declaratively via `pi install`—with selective opt-in/opt-out filtering and zero destructive overwrites of your local `~/.pi/agent/` state.

---

## Core Principles

Because this is a public tool-setup repository, all contributions and configurations adhere to five strict rules:

1. **Environment Portability (Zero Machine Coupling)**
   - No hardcoded home directories (`/Users/<name>`, `/home/<name>`, `C:\\Users\\<name>`), hostnames, fixed Homebrew/system paths, or local proxy ports.
   - OS-specific features and external CLIs are detected dynamically via `PATH` and `process.platform`, with environment variable overrides and graceful degradation when unavailable.
2. **Zero Secrets, Zero PII, Zero Session State**
   - No API keys, OAuth tokens, private endpoints, personal identifiers, `auth.json`, or `.jsonl` transcripts are ever committed.
   - Credentials are referenced strictly by environment variable name (e.g., `"$OPENAI_API_KEY"`).
3. **Non-Destructive, Selective Adoption**
   - Resources load cleanly through Pi's package manager rather than overwriting `~/.pi/agent/settings.json` or `keybindings.json`. Users can enable or disable individual extensions or skills via `pi config` or `settings.json` filters.
4. **Host Dependency Isolation & Minimal Supply Chain**
   - Pi host packages (`@earendil-works/*`, `typebox`) live exclusively in `peerDependencies` so Pi maps them to its own runtime singletons. Runtime code prefers Node.js built-ins over external npm dependencies.
5. **Clear Licensing & Upstream Attribution**
   - Original work is licensed under MIT (`LICENSE`). Any adapted third-party resources retain their upstream license notices and source links.

---

## Repository Structure

```text
pi_setup/
├── package.json          # Pi package manifest (entry points, peerDependencies, check scripts)
├── tsconfig.json         # Strict TypeScript configuration for extensions & scripts
├── AGENTS.md             # Repository-wide rules and workflow guidelines for AI agents
├── LICENSE               # MIT License
├── extensions/           # Custom Pi TypeScript extensions
│   ├── README.md         # Extension usage, environment dependencies, and best practices
│   └── AGENTS.md         # Agent-specific engineering rules for extensions/
├── skills/               # Reusable Agent Skills (skills/<name>/SKILL.md)
├── prompts/              # Reusable Markdown prompt templates (prompts/*.md)
├── themes/               # Custom Pi TUI color themes (themes/*.json)
├── config/               # Sanitized, portable settings & keybinding reference templates
│   └── README.md         # Guidelines for maintaining machine-independent config templates
├── scripts/              # Developer & CI utilities
│   └── check-hygiene.mjs # Automated scanner for secrets, forbidden files, and hardcoded paths
└── docs/                 # Architecture notes, specs (docs/specs/), and knowledge base (docs/knowledge/)
```

| Directory | Purpose | Loaded Automatically by `pi install`? |
| --- | --- | --- |
| `extensions/` | Custom Pi lifecycle hooks, TUI enhancements, commands, and tools (`*.ts`, `*/index.ts`) | Yes (configurable via filters) |
| `skills/` | Task-focused instruction bundles (`<skill>/SKILL.md`) | Yes (configurable via filters) |
| `prompts/` | Slash-invocable Markdown prompt templates (`*.md`) | Yes (configurable via filters) |
| `themes/` | JSON color themes for Pi's TUI (`*.json`) | Yes (selectable via `/theme`) |
| `config/` | Sanitized `*.example.json` reference snippets for `settings.json` / `keybindings.json` | No (manual reference / merge) |
| `scripts/` | Local and CI verification scripts (e.g., hygiene and portability checks) | No |
| `docs/` | Design specifications and technical notes | No |

---

## Quick Start

### Install as a Pi Package

Install from a Git remote or directly from a local clone:

```bash
# From GitHub (once published)
pi install git:github.com/<owner>/pi_setup

# Or from a local checkout (loads in place and supports /reload)
pi install /path/to/pi_setup
```

### Select Only What You Need

Use `pi config` interactively, or narrow loaded resources in `~/.pi/agent/settings.json`:

```json
{
  "packages": [
    {
      "source": "git:github.com/<owner>/pi_setup",
      "extensions": ["extensions/*.ts", "extensions/*/index.ts"],
      "skills": ["skills/*"],
      "prompts": [],
      "themes": []
    }
  ]
}
```

### Use Configuration Templates

Browse `config/` for portable `settings.example.json` or `keybindings.example.json` snippets and merge only the keys you want into `~/.pi/agent/`. Keep machine-local overrides (such as local HTTP proxies or workstation paths) in your personal `~/.pi/agent/settings.json`, never in this repository.

---

## Available Extensions

| Extension | Purpose | Runtime dependencies |
| --- | --- | --- |
| [`copy-mode-ime`](./extensions/copy-mode-ime/README.md) | Remember the writing input source, use English for copy-mode navigation, and restore writing input for comments and exit. | macOS, Pi fullscreen TUI, `@luan.sh/pi-copy-mode` 0.3.4, and `macism` or `im-select` on `PATH`. |

The copy-mode companion defaults to `com.apple.keylayout.ABC` for navigation. Its module README documents `PI_COPY_MODE_IME_*` configuration, installation, resource filtering, `/reload`, warning behavior, and the upstream internal IDs it observes. Other platforms and non-TUI modes stay inert.

---

## Development & Verification

### Prerequisites

- **Pi Coding Agent**: `>= 1.0.0`
- **Node.js**: `>= 20.0.0`

### Commands

```bash
# Run public-repo hygiene checks (no npm install required)
npm run check:hygiene

# Install devDependencies for TypeScript definitions and run typechecking
npm install
npm run typecheck
```

For detailed extension architecture, runtime/OS dependency conventions, and lifecycle rules, read [`extensions/README.md`](./extensions/README.md).

---

## Pre-Commit Checklist

- [ ] No hardcoded user paths (`/Users/<name>`, `/home/<name>`, `C:\\Users\\<name>`) or local proxy URLs.
- [ ] No secrets, tokens, private URLs, or `.jsonl` session transcripts.
- [ ] Optional OS/CLI dependencies are resolved via `PATH` / env vars, documented, and degrade gracefully.
- [ ] `npm run check:hygiene` and `npm run typecheck` pass cleanly.

---

## License

Released under the [MIT License](./LICENSE).
