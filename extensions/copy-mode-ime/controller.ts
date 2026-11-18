import type { ImeBackend } from "./backend.ts";
import { defaultHooks, type ImeConfig, type SourceHooks, type SourcePolicy } from "./config.ts";

export interface ModeState {
  copy: boolean;
  comment: boolean;
}

type Phase = "navigation" | "comment";
type PolicyContext = Phase | "exit";
interface CopyInterval {
  id: number;
  entrySource?: string;
  phase?: Phase;
}

/** Coalesces registry events while draining old intervals before any new source capture. */
export class ImeController {
  private desired: ModeState = { copy: false, comment: false };
  private generation = 0;
  private interval: CopyInterval | undefined;
  private writingSource: string | undefined;
  private restoreRequired = false;
  private readonly forcedSources = new Set<string>();
  private recoveryPolicy: SourcePolicy = "restore-writing";
  private readonly exhaustedRestoreSources = new Set<string>();
  private commentGeneration = 0;
  private handledCommentGeneration: number | undefined;
  private captureRequested = false;
  private closed = false;
  private disabled = false;
  private running: Promise<void> | undefined;
  private disposal: Promise<void> | undefined;
  private revision = 0;
  private readonly hooks: SourceHooks;
  private readonly restoreFallbackSource: string | undefined;

  constructor(
    private readonly backend: ImeBackend,
    config: string | ImeConfig,
    private readonly warn: (message: string) => void,
  ) {
    // Keep the original constructor usable by disposable legacy integration harnesses.
    this.hooks = typeof config === "string" ? defaultHooks(config) : config.hooks ?? defaultHooks(config.navigationSource);
    this.restoreFallbackSource = typeof config === "string" ? undefined : config.restoreFallbackSource;
  }

  update(state: ModeState): void {
    if (this.closed || this.disabled) return;
    if (this.desired.copy === state.copy && this.desired.comment === state.comment) return;
    this.revision += 1;
    if (!this.desired.copy && state.copy) this.generation += 1;
    if (!this.desired.comment && state.comment) this.commentGeneration += 1;
    if (this.desired.comment && !state.comment && !this.restoreRequired && !this.endingInterval()) {
      this.captureRequested = true;
    }
    this.desired = state;
    this.kick();
  }

  private endingInterval(): boolean {
    return this.interval !== undefined && (this.closed || !this.desired.copy || this.interval.id !== this.generation);
  }

  private needsWork(): boolean {
    if (this.disabled) return false;
    if (this.endingInterval()) return true;
    if (this.closed) return this.restoreRequired;
    if (this.captureRequested) return true;
    const commentPending = this.commentGeneration !== this.handledCommentGeneration;
    if (this.desired.copy) {
      return !this.interval?.entrySource || this.interval.phase !== (this.desired.comment ? "comment" : "navigation") ||
        (this.desired.comment && commentPending);
    }
    return this.desired.comment ? commentPending : this.handledCommentGeneration !== undefined;
  }

  private kick(): void {
    if (this.running || !this.needsWork()) return;
    this.running = this.reconcile().catch(async (error: unknown) => {
      this.disabled = true;
      try {
        if (this.restoreRequired || this.forcedSources.size > 0) {
          const policy = this.closed && this.interval ? this.hooks.sessionShutdown : this.recoveryPolicy;
          await this.applyPolicy(policy, "exit", true);
        }
      } catch {
        // A failed CLI may already have changed the source; retain the restore obligation.
      }
      const restored = !this.restoreRequired;
      const reason = error instanceof Error ? error.message : "Input source operation failed.";
      this.warn(`${reason} Automatic switching is disabled until /reload.${restored
        ? ""
        : " Restore your writing input source manually; cleanup could not restore it."}`);
    }).finally(() => {
      this.running = undefined;
      // Events may arrive while a query or a selection is in flight.
      this.kick();
    });
  }

  private target(policy: SourcePolicy): string | undefined {
    if (policy === "restore-entry") return this.interval?.entrySource;
    if (policy === "restore-writing") return this.writingSource;
    return policy === "keep" ? undefined : policy;
  }

  private async applyPolicy(policy: SourcePolicy, context: PolicyContext, recovering = false): Promise<string | undefined> {
    if (context !== "exit") {
      this.recoveryPolicy = this.interval ? this.hooks.copyModeExit : "restore-writing";
    } else {
      this.recoveryPolicy = policy;
    }
    if (policy === "keep" || (policy === "restore-writing" && !this.restoreRequired)) {
      this.restoreRequired = false;
      this.forcedSources.clear();
      this.exhaustedRestoreSources.clear();
      return;
    }
    const restoring = policy === "restore-entry" || policy === "restore-writing";
    const target = this.target(policy);
    const fallback = restoring ? this.restoreFallbackSource : undefined;
    if (!target && !fallback) return;
    if (!recovering) this.exhaustedRestoreSources.clear();
    const candidates = [...new Set([target, fallback].filter((source): source is string => source !== undefined))]
      .filter((source) => !recovering || !this.exhaustedRestoreSources.has(source));
    this.restoreRequired = true;
    const revision = this.revision;
    let selected: string | undefined;
    for (const [index, source] of candidates.entries()) {
      // Track every candidate: even exit restoration can switch before its readback fails.
      this.forcedSources.add(source);
      try {
        await this.backend.select(source);
        selected = source;
        break;
      } catch (error) {
        // A configured fallback bounds this episode; a distinct recovery target may still work.
        if (fallback) this.exhaustedRestoreSources.add(source);
        if (index === candidates.length - 1 ||
          (context === "comment" && (this.closed || this.revision !== revision))) throw error;
      }
    }
    if (selected === undefined) return;
    this.restoreRequired = context === "navigation";
    if (context === "comment") this.writingSource = selected;
    if (context === "exit" || (context === "comment" && restoring)) this.forcedSources.clear();
    this.exhaustedRestoreSources.clear();
    return selected;
  }

  private async exitInterval(): Promise<void> {
    const handledGeneration = this.handledCommentGeneration;
    const commentContinues = () => !this.closed && !this.desired.copy && this.desired.comment &&
      this.commentGeneration === handledGeneration;
    // Reset completed interval bookkeeping before awaiting exit so newer events can request work.
    this.handledCommentGeneration = undefined;
    this.captureRequested = false;
    const exitPolicy = this.hooks.copyModeExit;
    let commentSource: string | undefined;
    let exitSource: string | undefined;
    if (this.interval?.phase || this.restoreRequired || this.forcedSources.size > 0) {
      try {
        if (commentContinues() && this.hooks.commentEnter === "restore-writing" && exitPolicy !== "keep" &&
          (exitPolicy !== "restore-writing" || this.restoreRequired)) {
          commentSource = await this.backend.query();
        }
      } finally {
        // The interval still needs its exit policy if capturing the continuing comment fails.
        exitSource = await this.applyPolicy(this.closed ? this.hooks.sessionShutdown : exitPolicy, "exit");
      }
    }
    this.interval = undefined;
    this.restoreRequired = false;
    this.forcedSources.clear();
    this.recoveryPolicy = "restore-writing";

    if (!commentContinues()) return;
    if (exitSource === undefined) {
      this.handledCommentGeneration = handledGeneration;
    } else if (commentSource !== undefined) {
      this.writingSource = commentSource;
      if (exitSource !== commentSource) {
        this.restoreRequired = true;
        const restored = await this.applyPolicy("restore-writing", "comment").catch((error: unknown) => {
          this.recoveryPolicy = exitSource;
          throw error;
        });
        if (!commentContinues() && restored !== undefined) {
          // A close or re-entry during the selection must see the completed exit source.
          this.forcedSources.add(restored);
          await this.applyPolicy(exitSource, "exit");
          return;
        }
      }
      this.handledCommentGeneration = handledGeneration;
    }
  }

  private async captureWriting(): Promise<boolean> {
    const revision = this.revision;
    this.captureRequested = false;
    this.writingSource = await this.backend.query();
    return revision === this.revision;
  }

  private async reconcile(): Promise<void> {
    while (this.needsWork()) {
      if (this.endingInterval()) {
        await this.exitInterval();
        continue;
      }
      if (this.closed) {
        await this.applyPolicy(this.hooks.sessionShutdown, "exit");
        continue;
      }
      if (this.desired.copy) {
        this.interval ??= { id: this.generation };
        const interval = this.interval;
        if (!interval.entrySource) {
          // Older forced work has drained. Preserve the first query as the immutable entry;
          // a stale query still needs a fresh writing capture before any forced switch.
          const stable = await this.captureWriting();
          interval.entrySource = this.writingSource;
          if (!stable) this.captureRequested = true;
          if (!stable || this.endingInterval()) continue;
        }
        if (this.desired.comment) {
          if (this.captureRequested) {
            const stable = await this.captureWriting();
            if (!stable) this.captureRequested = true;
            if (!stable || this.endingInterval() || !this.desired.comment) continue;
          }
          const generation = this.commentGeneration;
          if (interval.phase !== "comment" || this.handledCommentGeneration !== generation) {
            await this.applyPolicy(this.hooks.commentEnter, "comment");
            this.handledCommentGeneration = generation;
          }
          interval.phase = "comment";
        } else {
          const resuming = interval.phase === "comment";
          if (resuming || this.captureRequested) {
            const stable = await this.captureWriting();
            if (!stable) this.captureRequested = true;
            if (!stable || this.endingInterval() || this.desired.comment) continue;
          }
          await this.applyPolicy(resuming ? this.hooks.commentExit : this.hooks.copyModeEnter, "navigation");
          interval.phase = "navigation";
          this.handledCommentGeneration = undefined;
        }
        continue;
      }
      if (this.desired.comment) {
        const policy = this.hooks.commentEnter;
        // Standalone default comments keep their source and need no CLI call on entry.
        if (policy !== "keep" && policy !== "restore-writing") {
          if (!await this.captureWriting() || this.closed || this.desired.copy || !this.desired.comment) continue;
        }
        const generation = this.commentGeneration;
        this.captureRequested = false;
        await this.applyPolicy(policy, "comment");
        this.handledCommentGeneration = generation;
      } else {
        await this.captureWriting();
        this.handledCommentGeneration = undefined;
        this.forcedSources.clear();
      }
    }
  }

  dispose(): Promise<void> {
    return this.disposal ??= this.finish();
  }

  private async finish(): Promise<void> {
    const retryDisabled = this.disabled && !this.running;
    this.closed = true;
    this.captureRequested = false;
    this.kick();
    // A settling task can start its final restoration from finally().
    while (this.running) await this.running;
    // Do not repeat recovery from a failure still being handled above.
    if (retryDisabled && this.restoreRequired) {
      try {
        const policy = this.interval ? this.hooks.sessionShutdown : this.recoveryPolicy;
        const restoring = policy === "restore-entry" || policy === "restore-writing";
        const expected = this.target(policy) ?? (restoring ? this.restoreFallbackSource : undefined);
        const mayBeForced = expected !== undefined && [...this.forcedSources].some((source) => source !== expected);
        const current = mayBeForced ? await this.backend.query() : undefined;
        if (current && this.forcedSources.has(current) && current !== expected) {
          await this.applyPolicy(policy, "exit");
        } else {
          // Preserve a source selected manually after automatic switching failed.
          this.restoreRequired = false;
        }
      } catch {
        this.warn("Could not restore the writing input source. Restore it manually and check the input source CLI before /reload.");
      }
    }
  }
}
