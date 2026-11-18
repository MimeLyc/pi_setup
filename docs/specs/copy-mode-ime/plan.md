# Copy-mode IME implementation plan

## 1. Inspect integration boundaries

Read repository rules, Pi 1.5.2 lifecycle/package documentation, upstream copy-mode entry/exit and comment overlay paths, and bundled libtui registry implementation. Verify CLI query/select interfaces through current documentation/source. Record concrete findings in `docs/knowledge/copy-mode-ime.md`.

## 2. Implement the companion

- `backend.ts`: validate portable environment configuration, discover macism/im-select lazily, execute bounded shell-free processes, validate query output, and verify selections through readback.
- `controller.ts`: serialize reconciliation of latest copy/comment state, capture only after restoration, reject stale query-driven navigation work, and restore on shutdown or backend failure.
- `registry.ts`: observe existing/late registry publication, validate protocol/state, wrap registration/removal, track overlapping registrations by token, and restore descriptors only while owned. Reject attachment to existing active registrations.
- `index.ts`: guard TUI/platform/enabled state, enforce one runtime owner, warn once, and await cleanup on shutdown.

## 3. Document and validate

Document installation, resource filtering, configuration defaults, version-specific compatibility, warnings, cleanup limits, and manual validation in the module README. List the real extension in root and extensions READMEs. Use no additional runtime npm dependencies or committed tests.

Run `npm run typecheck`, `npm run check:hygiene`, and `git diff --check`. Use a temporary harness with a fake executable and the upstream registry to verify state transitions, race handling, duplicate loads, teardown, failure recovery, and headless behavior. Record verification results in the progress document.

## Runtime CLI failure follow-up

- Separate query/selection failures, deadline expiration, nonzero exit codes, signals, and output-limit failures without exposing CLI output or source IDs. Keep the portable default and existing fallback policy unchanged.
- Document the per-process deadline override for CLI cold starts.
- Verify diagnostics and timeouts with temporary fake executables. Exercise the extension entry through Pi’s loader with fake input-source operations.

## Configurable source hooks

1. Add a validated optional JSON configuration file with five lifecycle source policies and an optional restore fallback. Keep existing environment defaults and old behavior when no file is configured; add a portable example and document precedence and reload.
2. Separate the immutable entry source of each copy-mode interval from the evolving writing preference. Extend serial reconciliation for explicit comment/exit/shutdown policies, bounded restoration fallback, stale-work rejection, manual recovery, and interval cleanup. Preserve the previously fixed disposal race protections.
3. Run the legacy fake-CLI/registry scenarios plus focused cases covering entry restoration after a different comment language, fixed exit, fallback, standalone comments, rapid entry and re-entry, shutdown, and malformed configuration.
4. Review source transitions, configuration contracts, and upstream integration.
5. Verify that Pi loads the extension and executes the configured hook sequence with a fake CLI.

### Final hook correction and deferred improvements

- Gate error recovery on a possible automatic source selection. Discard an unentered interval without selecting exit or fallback sources. Track every attempted restoration candidate before invoking the CLI. Skip disabled cleanup queries when its policy has no target.
- Exercise matching original-entry exit and shutdown policies with a fixed comment source and a restore fallback through Pi’s loader.
- Known recovery edge cases: restoring comment entry (`restore-writing`) combined with a distinct original-entry exit can lose restoration ownership if comment-close capture fails; a standalone fixed-comment selection coalesced into copy entry can carry possible-source tracking into a cancelled unentered interval. Investigate those uncommon combinations before expanding recovery behavior; preserve current bounded retry/manual recovery guarantees.
- Earlier documented compatibility limits remain deferred: foreign global-accessor reload restoration and differing exit/shutdown policies under upstream FIFO teardown. Matching configured teardown policies avoid the ordering difference.

## 4. Final review

Compare the final diff and staging area against requirements. Review stale-work handling, wrapper ownership, error restoration, timeout behavior, and documentation accuracy. Record any engineering improvements discovered here and complete applicable corrections before handoff.

### Review findings and completed improvements

- Added revision checks after navigation capture so a comment opened and closed during a slow query causes a fresh capture before English is selected. The temporary harness verifies the newer comment source survives exit.
- Cached the disposal promise so concurrent cleanup callers cannot launch competing recovery selections.
- Made wrapper teardown idempotent, isolated throwing registration ID getters, and stopped observation with restoration when an upstream method returns a malformed remover. The smoke harness covers malformed removal and retention of foreign method/global wrappers.
- Retained the restoration obligation before selection, including CLI failures after changing the source. Readback verifies apparent CLI success; failed restoration is retried in a bounded way.
- Kept the baseline TypeScript fix to one JSDoc annotation in the hygiene script; scanner behavior and dependency declarations are unchanged.
- Reviewed all requirements against code and documentation. Remaining verification is manual macOS/terminal interaction; future upstream versions need an explicit compatibility review.

### Parent-approved review fixes

- P1-A: Drain every task started by a settling reconciliation's `finally` before completing disposal or issuing final cleanup. A single await could otherwise allow two restoration selections to overlap.
- P1-B: Retry cleanup after an already settled failure only while a current-source query confirms the forced navigation source remains active and restoration would change it. Preserve manual source recovery, and do not add an immediate third retry when disposal encounters a new or still-running failure.
- P2-C remains a deferred compatibility limitation: a foreign wrapper can restore this companion's stopped global accessor after shutdown, preventing attachment after later reloads. Document a Pi restart as recovery; do not add an accessor handoff protocol in this fix pass.
- Validate the two P1 findings with the parent's three regression assertions, six focused cleanup cases, and the existing 34-case fake-CLI/upstream-registry smoke harness. Keep all additional checks outside the repository.

### Hook implementation review findings

- Keep the first safe query result immutable for entry restoration, while requiring a fresh writing capture after stale registry events. An old interval must retain that snapshot during capture/shutdown races so a fallback cannot become the next interval's original source.
- Track possible forced sources through a failed fixed comment or exit selection; remembering only the attempted new source can lose the prior navigation restoration obligation. Later cleanup still queries before selecting and preserves a different manual recovery source.
- Clear standalone close-capture flags when a new standalone comment is handled. The legacy rapid-transition stress case exposed a reconciliation liveness issue here; the corrected implementation passes both the legacy and configured stress/drain cases.
- Keep validation disposable and repeatable, including regular-file/size checks and non-blocking rejection of FIFO configuration paths. No registry protocol, installed package, upstream implementation, or repository test changes are needed for these hooks.
- Track comment-open generations independently of the copy-mode phase so a newly opened comment receives its hook after pending work settles. Preserve a continuing comment’s writing input during copy exit and share source-ID validation between configuration and the CLI backend.

### Parent-approved hook review corrections

- H1: Re-check shutdown after a standalone comment's asynchronous capture before selecting its configured source.
- H2: During later disabled cleanup, compare possible forced state with the primary restore target; fallback is expected only if no primary snapshot exists.
- H3/H4: Track exhausted restoration candidates rather than a global exhausted flag. Immediate recovery can try a distinct exit/shutdown target while excluding already failed primary/fallback targets. A failure after active-interval disposal begins recovers with the shutdown policy.
- H5/H6: Derive manual-restoration guidance from the final obligation state and normalize repeated slashes in home-relative configuration paths.
- H7: Document upstream FIFO exit-before-shutdown precedence without adding a dispatcher hook or retaining completed intervals. Verify matching exit/shutdown policies in either event order and record distinct-policy behavior.
- Verify these corrections with fake-backend recovery cases, upstream-registry teardown cases, and the policy, legacy, cleanup, and CLI diagnostic checks.
