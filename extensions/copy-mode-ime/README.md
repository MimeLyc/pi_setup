# copy-mode-ime

A macOS input source companion for [`@luan.sh/pi-copy-mode`](https://www.npmjs.com/package/@luan.sh/pi-copy-mode). It keeps Vim navigation keys usable in copy mode and restores your writing input source for comments and after leaving copy mode.

## Requirements

- Pi's interactive fullscreen TUI. Developed against Pi **1.5.2** and Node.js **20+**.
- `@luan.sh/pi-copy-mode` **0.3.4**, loaded as a separate Pi extension.
- macOS with [`macism`](https://github.com/laishulu/macism) or [`im-select`](https://github.com/daipeihust/im-select) on the Pi process's `PATH`. Automatic discovery tries `macism` first and falls back to `im-select` only when `macism` is absent. An installed but failing CLI disables automatic switching for that session.
- An enabled English/ASCII input source. The default is `com.apple.keylayout.ABC`; change `PI_COPY_MODE_IME_NAV_SOURCE` if your enabled source has another ID.

There are no additional runtime npm dependencies. Linux and Windows remain inert with one warning in TUI mode. Print, JSON, and RPC sessions perform no instrumentation, CLI calls, or notifications.

## Install and load

Install the upstream copy-mode extension and its input source companion separately.

```sh
pi install npm:@luan.sh/pi-copy-mode@0.3.4
pi install npm:pi-copy-mode-ime
```

To install the companion from a local checkout, use `pi install /path/to/pi_setup` in place of the second command. Use `pi config` to enable `extensions/copy-mode-ime/index.ts`. For a one-off session from the repository root, with copy-mode already installed:

```sh
pi -e ./extensions/copy-mode-ime/index.ts
```

To load only this resource from the local package, merge this package entry into your Pi settings:

```json
{
  "source": "/path/to/pi_setup",
  "extensions": ["extensions/copy-mode-ime/index.ts"],
  "skills": [],
  "prompts": [],
  "themes": []
}
```

Run `/reload` after changing local source files or resource filters. Environment variables are read on session start; to change the environment of a running Pi process, restart it from the configured shell. `/reload` also cleans up the old runtime and retries a backend disabled by an earlier failure. Do not independently load multiple copies; if that happens, only the first active companion instance owns switching.

Disable the resource with `pi config`, exclude it with `"-extensions/copy-mode-ime/index.ts"` in the package's `extensions` filter, or launch Pi with `PI_COPY_MODE_IME_ENABLED=0`.

## Behavior

Without a JSON configuration file, the legacy defaults are:

| Transition | Input source behavior |
| --- | --- |
| Enter copy mode | Query and remember the current writing source, then select the navigation source. |
| Open a comment | Restore the remembered writing source. Applies to keyboard `c`, mouse selection comments, and annotation pill editing. |
| Save, cancel, or delete a comment inside copy mode | Query the source used for writing, then return to the navigation source. |
| Comment outside copy mode | Leave the source alone and remember the current source on close. |
| Copy, cancel, or lose the copy-mode surface | Restore the most recently remembered writing source. |
| `/reload`, session replacement, or graceful shutdown | Stop observing, drain in-flight operations, restore if necessary, and release ownership. |

The writing preference follows the source selected in a comment, including English if you deliberately select it there. A separate, immutable entry snapshot records the first safe source query of each copy-mode interval, before any automatic switch. Comment source selections and later writing changes never replace that snapshot. Old intervals finish their exit policy before a re-entry can capture a new snapshot, including when a CLI operation is still in flight. Both values stay in memory only. The extension does not control an IME's internal Chinese/English submode when both share the same source ID.

CLI operations run asynchronously and serially. Each process has a deadline, selections are read back for confirmation, and obsolete transitions are skipped. Very brief comment opens can be coalesced before a switch occurs. A new comment that stays open applies its entry policy even if the previous comment's close query is still pending. If an English switch is already in flight when you open a comment or exit, restoration follows its completion. Allow the input source indicator to settle before typing; no synchronous hook can delay the upstream comment UI until the switch completes.

## Configuration

| Environment variable | Default | Meaning |
| --- | --- | --- |
| `PI_COPY_MODE_IME_ENABLED` | Enabled | Set exactly `0` to disable all companion activity, including warnings. Other values leave it enabled. |
| `PI_COPY_MODE_IME_NAV_SOURCE` | `com.apple.keylayout.ABC` | Enabled macOS English/ASCII source ID used for navigation. Empty values use the default. |
| `PI_COPY_MODE_IME_BIN` | Auto: `macism`, then `im-select` | Executable name on `PATH` or explicit executable path. No shell expansion or extra arguments; an override must support the macOS CLI interface below. Empty values use automatic discovery. |
| `PI_COPY_MODE_IME_TIMEOUT_MS` | `1500` | Deadline per CLI process in milliseconds, integer `100`–`10000`. Empty values use the default. |
| `PI_COPY_MODE_IME_CONFIG_FILE` | Unset | Optional JSON hook configuration, read once at TUI session start. An explicitly empty, unreadable, oversized, or invalid file setting leaves switching inert with a sanitized warning. |

Both supported CLIs print the current source ID with no arguments and select a source with one argument. You can query your current source without switching:

```sh
macism
# Or:
im-select
```

Source IDs must use 1–256 letters, digits, dots, underscores, or hyphens, starting with a letter or digit. The words `keep`, `restore-entry`, and `restore-writing` are reserved for hook policies. Use the ID reported by a CLI query, not a display name or a shell command. Selecting a Chinese source ID does not guarantee Chinese composition: an IME may have an internal ASCII/composition mode under the same ID, which this extension cannot control.

The optional file uses the shape shown in [`config/copy-mode-ime.example.json`](../../config/copy-mode-ime.example.json). Copy it to a location you control and set `PI_COPY_MODE_IME_CONFIG_FILE` in the shell that launches Pi. Absolute paths are used directly; relative paths resolve against the Pi process's current working directory at session start. A leading `~/` resolves through the current user's home directory. The setting is trimmed; no other tilde, environment-variable, or shell expansion occurs. The file must be a regular UTF-8 JSON file of at most **16384 bytes**. It requires a `hooks` object; unknown top-level or hook keys, non-string policies, and invalid source IDs are rejected. An empty `hooks` object is valid.

Each hook accepts a fixed source ID or one of these policies:

| Policy | Meaning |
| --- | --- |
| A source ID | Select that enabled source. This overrides the navigation environment setting for that hook. |
| `restore-entry` | Select the immutable original source of the current copy-mode interval. |
| `restore-writing` | Restore the latest writing preference when navigation has forced a source; leave active writing input alone otherwise. |
| `keep` | Make no selection and relinquish the current automatic restoration obligation. |

Omitted hooks inherit these defaults, including when a JSON file is present:

| Hook | Default | Applicability |
| --- | --- | --- |
| `copyModeEnter` | `PI_COPY_MODE_IME_NAV_SOURCE` or `com.apple.keylayout.ABC` | Start of a copy interval without an open comment. |
| `commentEnter` | `restore-writing` | All comment entry paths, including standalone comments. When an interval starts with a comment already open, its comment policy applies directly. |
| `commentExit` | `PI_COPY_MODE_IME_NAV_SOURCE` or `com.apple.keylayout.ABC` | Resume navigation only while copy mode is still active. Standalone closure keeps the writing source and does not apply this policy. |
| `copyModeExit` | `restore-writing` | End of each interval, including surface loss or registry replacement. |
| `sessionShutdown` | `restore-writing` | Cleanup of an active interval or an unfinished forced switch on reload, session replacement, or graceful shutdown. Completed intervals have no effect on idle shutdown. |

Pi runs shutdown handlers in extension load order. Upstream copy-mode can dispose its host and emit a copy-mode exit before this companion receives `session_shutdown`; that exit can already complete the interval using `copyModeExit`. Completed intervals are not reopened for a later shutdown hook. Set `copyModeExit` and `sessionShutdown` to the same policy for consistent teardown in either order. Distinct policies intentionally depend on which event completes the interval first; no exit-reason or shutdown-dispatch interception is added.

A comment that stays open when copy mode ends keeps its active source if the exit policy makes no selection. If the exit policy selects a source, a continuing `restore-writing` comment resumes with the source active just before exit. Other comment policies apply as they would for a standalone comment.

The example chooses original-entry restoration on exit and shutdown; omit those overrides for legacy writing-preference restoration. To always use a particular Chinese IME for comments, put its locally queried, enabled source ID in `hooks.commentEnter`. A fixed `copyModeExit` ID can instead choose a consistent exit source. Keep these personal choices in your own configuration. `keep` can deliberately leave a navigation or comment source selected; a later interval then starts from that retained source.

The optional top-level `restoreFallbackSource` must be a source ID. For a restore policy, the recorded source is tried first when present; if it is missing or unavailable, at most one fallback selection follows. Identical recorded and fallback IDs are attempted once. Without a fallback, a missing target leaves the source alone. In particular, `restore-entry` has no target for a standalone comment. Fixed source policies do not use this fallback. If the fallback also fails, those failed restore targets are not retried during the immediate recovery episode. A distinct exit or shutdown target can still be attempted, without repeating a fallback that already failed. Shutdown does not add another immediate attempt after that recovery finishes. Legacy recovery without a configured fallback still permits its existing second restoration attempt.

JSON hook values take precedence over per-hook defaults; other environment variables keep controlling enablement, executable discovery, and CLI deadlines. With the file setting absent, behavior stays unchanged. File edits take effect on the next `/reload` or session start; there is no watcher or polling. Restart Pi to change its inherited environment. An explicitly supplied invalid configuration disables initialization instead of silently using defaults; warnings identify the setting and correction without printing its path, file contents, source arguments, or CLI stdout/stderr.

An unavailable source, query failure, selection mismatch, or timeout disables further automatic transitions until `/reload` unless a restoration fallback succeeds. Cleanup attempts the interval's exit policy if a switch may have occurred; a failure after shutdown begins uses the active interval's shutdown policy. After an already settled cleanup failure, later shutdown retries only when a current-source query confirms a possible automatically forced source remains active and differs from the primary restore target. The fallback is the expected target only when no recorded primary exists; it never masks an available primary. A source outside the possible automatically forced set, selected manually after the failure, is preserved. Cleanup drains all in-flight work and concurrent shutdown calls share one promise; a new or still-running failure receives no third immediate recovery attempt.

## Compatibility and lifecycle

This companion uses **version-specific internal behavior**, because copy-mode 0.3.4 has no public enter/exit or comment lifecycle API:

- `globalThis[Symbol.for("pi-libtui/mouse/registry/v1")]`, protocol `pi-libtui/mouse/registry/v1`, version `1`.
- `registerScreenDecorator` with ID `pi-copy-mode.active` and its returned remover indicate copy-mode entry and exit.
- `registerOverlayRegion` with ID `pi-copy-mode.annotations.comment-editor` and its returned remover indicate comment entry and exit.
- The registry's `Symbol.for("pi-libtui/mouse/registry-state/v1")` arrays are read only to reject attachment when an existing copy mode or comment is already open. Existing removers cannot be safely retrofitted.

It wraps those two methods and observes late publication/replacement of the global registry through a configurable property accessor. It never creates a replacement registry, imports copy-mode's filesystem paths, changes libtui's arrays, intercepts keystrokes, or treats temporary removal of modal input as exit. Registry replacement restores the old writing source before any new navigation capture. On disposal, it restores only properties it still owns; wrappers installed later by other extensions remain in place, and any retained companion wrapper becomes passive.

Load order is flexible while the registry slot and methods can be observed safely. Unknown accessors, locked properties, incompatible registries, and already active registrations are rejected with a non-fatal warning. Close copy mode/comments and `/reload` when existing active registrations prevented attachment. A missing registry causes no switching and a warning after resource discovery; late publication can still attach. A registry supplied by another libtui consumer is harmless until the exact copy-mode IDs appear. Future upstream versions need compatibility review, even if their registry protocol number remains the same.

One compatibility case remains deferred: another extension can wrap the global registry accessor after this companion and restore the saved companion accessor after the companion has shut down. Pi's shutdown order can then leave the companion's passive accessor in place. Later loads reject that accessor, so repeated `/reload` cannot recover in that process. Restart Pi and check the other extension's registry wrapper/load order. The normal copy-mode 0.3.4 registry publication does not use this wrapping pattern.

At most one actionable warning is emitted per owning TUI runtime (reset by `/reload` or a new session). Warning output excludes configuration values and raw CLI stdout/stderr. The optional configuration file is read once; no background polling occurs and no files, settings, input source preferences, or source history are written. Graceful cleanup awaits bounded CLI operations; forcible termination such as SIGKILL cannot run restoration.

## Troubleshooting and manual verification

- If shortcuts still produce composition text, check that the navigation source is enabled in macOS settings and that `macism` or `im-select` runs from the same terminal environment as Pi. Set `PI_COPY_MODE_IME_NAV_SOURCE` to an enabled English source ID if ABC is unavailable.
- If nothing happens, check both extensions in `pi config`, confirm fullscreen TUI mode, and `/reload` after closing any active comment or copy mode. If a registry accessor warning persists with another registry-wrapping extension, restart Pi as described above. Read the first warning; subsequent failures are silent for that runtime.
- If a CLI fails, the warning identifies query versus selection, the built-in CLI name (or a configured executable), and whether it timed out, exited with a code, was terminated by a signal, or exceeded the output limit. Raw stdout/stderr and input source IDs are omitted. If it times out, measure a read-only query from the same terminal; cold startup may exceed the default 1500 ms. Set `PI_COPY_MODE_IME_TIMEOUT_MS=10000` when a larger bounded startup allowance is needed, restart Pi from that environment, and retry. Changing only this setting does not fix permission or nonzero-exit errors. After a failed restoration, select the writing source manually before retrying.
- Switching is local to the machine running Pi. An SSH session does not control the input source of a remote client terminal. Avoid running multiple independently switching Pi sessions against the same desktop while another session has copy mode open.

For manual macOS validation, start with a non-English writing source, enter copy mode, and check English navigation. Open a comment with `c`, choose a different writing source, save, and leave copy mode; confirm that the new source is restored. Repeat with mouse comments, existing annotation pills, cancel/delete, copy/cancel exit, and `/reload` or quit while copy mode is active. Also open and close a comment outside copy mode and confirm its source stays selected. With `restore-entry` configured, begin from both English and non-English sources, change the comment language, and confirm exit restores the original entry instead of the updated writing preference. Repeat shutdown during navigation and a comment, and confirm idle shutdown leaves a manually selected source alone.

Development verification uses a temporary fake CLI and the upstream registry; it does not prove actual macOS switching or terminal/IME GUI behavior. No unit test files are included.
