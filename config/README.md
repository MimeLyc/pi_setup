# Configuration Templates

This directory stores **sanitized, portable** Pi configuration templates (such as `settings.example.json` and `keybindings.example.json`).

## Portability & Privacy Rules

Files in `config/` are reference templates intended to be safe for any developer on macOS, Linux, or Windows:

1. **Never commit raw live files from `~/.pi/agent/`**:
   - Live `settings.json` often accumulates local proxies (`httpProxy`), machine-specific absolute paths, internal provider URLs, and `extensionChangelogVersions` state.
2. **No secrets or personal identifiers**:
   - Reference credentials strictly through environment variable placeholders (for example, `"$OPENAI_API_KEY"`), never literal values.
   - Do not include private endpoints, internal hostnames, or personal account identifiers.
3. **No hardcoded user paths**:
   - Use `~` or package specifiers (`npm:...`, `git:...`) where Pi supports them, never `/Users/<name>`, `/home/<name>`, or `C:\\Users\\<name>`.
4. **Non-destructive adoption**:
   - Copy or merge desired snippets manually into `~/.pi/agent/settings.json` or `~/.pi/agent/keybindings.json`.
   - Keep machine-specific overrides in untracked `*.local.json` files if staging changes locally.
