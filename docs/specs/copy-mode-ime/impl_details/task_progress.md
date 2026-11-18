# Copy-mode IME verification

The companion observes the upstream copy-mode decorator and comment overlay. It supports fixed input sources, entry and writing restoration policies, and an optional fallback. Older copy-mode intervals finish teardown before a new interval captures its entry source.

## Automated checks

- `npm run check:hygiene`, `npm run typecheck`, and `git diff --check` passed.
- Temporary fake-CLI and controller harnesses exercised legacy defaults, hook configuration, and failed or timed-out commands. Input-source operations stayed serialized, and concurrent shutdown calls shared the same cleanup.
- The 25 focused regression cases covered rapid comment reopen, continuing comments on copy exit, overlapping overlays, stale operations during re-entry or shutdown, and recovery after failed CLI readback.
- The 18 package checks used Pi’s loader and fake input-source operations. They covered headless startup, configured navigation and comment transitions, and restoration of the entry source.

## Known limits

- Configure matching copy-exit and shutdown policies if they must produce the same result regardless of extension shutdown order.
- If another extension restores an expired global registry accessor, Pi may need to restart before the companion can reattach.
- Failed comment-close capture and a standalone comment racing with copy-mode entry can leave recovery edge cases. See the implementation plan for their triggers.

## Desktop verification

Automated verification did not select a real macOS input source. The extension README describes how to verify input-source switching in the fullscreen TUI.
