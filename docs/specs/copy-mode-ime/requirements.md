# Copy-mode input source companion requirements

Implement an independent companion to `@luan.sh/pi-copy-mode` 0.3.4 using the upstream registry without modifying upstream code.

1. Save the current writing source before copy-mode navigation and select an English/ASCII source.
2. Restore writing input for every comment entry path. Remember source changes when the comment closes; use English again only while copy mode remains active. Comments outside copy mode must keep their writing source.
3. Restore on copy/cancel exit, surface loss, reload, session replacement, and graceful shutdown. Forced English must never replace the remembered source because of async races.
4. Serialize CLI calls with deadlines, coalesce rapid transitions, and handle duplicate loads, registry replacement, and wrapper ownership safely. Do not poll or block TUI input.
5. Support macOS with macism or im-select discovered through PATH or an environment override. Default navigation source is `com.apple.keylayout.ABC`. Unsupported platforms and missing dependencies remain inert with at most one actionable warning per runtime. Non-TUI modes perform no activity.
6. Use structural access to the existing versioned libtui registry. Document every internal ID, environment variable, runtime dependency, loading and disabling procedure, and limitation.
7. Keep public artifacts portable, sanitized, and in English. Declare Pi host dependencies as peer and development dependencies.
8. Verify with repository hygiene, TypeScript, diff whitespace checks, and a temporary integration harness using a fake CLI and upstream registry. Report simulated versus manual verification accurately.

## Configurable input source hooks

9. Read an optional JSON file named by `PI_COPY_MODE_IME_CONFIG_FILE` on TUI session start. The object has `hooks` and optional `restoreFallbackSource`. Supported hook keys are `copyModeEnter`, `commentEnter`, `commentExit`, `copyModeExit`, and `sessionShutdown`; each value is a macOS source ID, `restore-entry`, `restore-writing`, or `keep`. Invalid/unreadable configuration stays inert with a sanitized actionable warning, without echoing file contents.
10. With no hook configuration, preserve existing behavior and legacy environment variables: copy entry uses the navigation source, comment entry restores writing input, comment exit returns to navigation only while copy mode remains active, and copy exit/shutdown restore the most recent writing preference. Comments closed outside copy mode retain their source.
11. `restore-entry` restores the source queried before the first forced switch of that copy-mode interval. Keep this entry snapshot separate from writing preference updates in comments. Never capture a forced navigation or configured comment source as the original entry source during rapid transitions or exit/re-entry. No snapshot or forced state from a completed interval may leak into the next interval.
12. `restoreFallbackSource`, when provided, is the bounded fallback for unavailable/missing restore targets; try the remembered source before fallback, without retry loops. Fixed source IDs remain valid alternatives for copy exit. Shutdown cleanup must respect active interval policy, preserve manual recovery after disablement, drain all operations, and remain idempotent. Idle shutdown must not apply an unrelated stale interval policy.
13. `commentExit` applies to resuming active copy mode; outside copy mode a closed comment keeps its writing source. A configured comment source applies to keyboard, mouse-selection, and existing annotation entry paths. Source-ID selection does not promise to control an IME-internal ASCII/composition mode sharing that ID.
14. The hook file can combine an ASCII navigation source, a fixed comment source, original-entry restoration on exit or shutdown, and an optional fallback. User-selected source IDs belong in the user’s own configuration. Verify the hook sequence through Pi’s loader with fake input-source operations.
