import type { ModeState } from "./controller.ts";

const PROTOCOL = "pi-libtui/mouse/registry/v1";
const REGISTRY_KEY = Symbol.for(PROTOCOL);
const STATE_KEY = Symbol.for("pi-libtui/mouse/registry-state/v1");
const COPY_ID = "pi-copy-mode.active";
const COMMENT_ID = "pi-copy-mode.annotations.comment-editor";
type MethodName = "registerScreenDecorator" | "registerOverlayRegion";
type RegistrationMethod = (this: unknown, ...args: unknown[]) => unknown;
type Registry = Record<PropertyKey, unknown> & Record<MethodName, RegistrationMethod>;

function object(value: unknown): value is Record<PropertyKey, unknown> {
  return value !== null && typeof value === "object";
}

function id(value: unknown): unknown {
  try {
    return object(value) ? value.id : undefined;
  } catch {
    return undefined;
  }
}

function compatible(value: unknown): value is Registry {
  return object(value) && value.protocol === PROTOCOL && value.version === 1 &&
    typeof value.registerScreenDecorator === "function" &&
    typeof value.registerOverlayRegion === "function";
}

export interface RegistryObserver {
  isAttached(): boolean;
  dispose(): void;
}

/**
 * Observes the existing capability; never constructs a replacement libtui registry.
 * The global accessor handles late publication without polling or filesystem imports.
 */
export function observeRegistry(
  onState: (state: ModeState) => void,
  warn: (message: string) => void,
): RegistryObserver {
  let stopped = false;
  let attached = false;
  let detach: (() => void) | undefined;
  const scope = globalThis as Record<PropertyKey, unknown>;
  const original = Object.getOwnPropertyDescriptor(scope, REGISTRY_KEY);

  const publish = (copy: boolean, comment: boolean): void => {
    if (!stopped) onState({ copy, comment });
  };

  const attach = (value: unknown): void => {
    detach?.();
    detach = undefined;
    attached = false;
    publish(false, false);
    if (value === undefined) return;
    if (!compatible(value)) {
      warn("Incompatible pi-libtui registry. Use @luan.sh/pi-copy-mode 0.3.4 and /reload.");
      return;
    }
    const state = value[STATE_KEY];
    if (!object(state) || !Array.isArray(state.screenDecorators) || !Array.isArray(state.regions)) {
      warn("Cannot inspect pi-libtui registration state. Use @luan.sh/pi-copy-mode 0.3.4 and /reload.");
      return;
    }
    if (state.screenDecorators.some((entry: unknown) => id(entry) === COPY_ID) ||
      state.regions.some((entry: unknown) => id(entry) === COMMENT_ID)) {
      warn("Copy mode or a comment is already open. Close it and /reload to attach copy-mode-ime safely.");
      return;
    }

    let enabled = true;
    const copies = new Set<symbol>();
    const comments = new Set<symbol>();
    const restorers: (() => void)[] = [];
    const emit = (): void => {
      if (enabled) publish(copies.size > 0, comments.size > 0);
    };
    const unpatch = (): void => {
      if (!enabled) return;
      enabled = false;
      for (const restore of restorers.reverse()) restore();
      copies.clear();
      comments.clear();
    };

    try {
      const patch = (name: MethodName, targetId: string, tokens: Set<symbol>): void => {
        const descriptor = Object.getOwnPropertyDescriptor(value, name);
        if (descriptor && !("value" in descriptor)) throw new Error("Accessor method");
        const previous = value[name];
        const wrapper: RegistrationMethod = function (...args) {
          const remove = Reflect.apply(previous, this, args) as unknown;
          if (!enabled || id(args[0]) !== targetId) return remove;
          if (typeof remove !== "function") {
            unpatch();
            attached = false;
            publish(false, false);
            warn("Unexpected pi-libtui registration result. Automatic switching has stopped; check companion compatibility and /reload.");
            return remove;
          }
          const token = Symbol(targetId);
          tokens.add(token);
          emit();
          let removed = false;
          return function (this: unknown, ...removeArgs: unknown[]): unknown {
            const result: unknown = Reflect.apply(remove, this, removeArgs);
            if (!removed) {
              removed = true;
              tokens.delete(token);
              emit();
            }
            return result;
          };
        };
        Object.defineProperty(value, name, descriptor
          ? { ...descriptor, value: wrapper }
          : { value: wrapper, writable: true, configurable: true, enumerable: true });
        restorers.push(() => {
          // Other extensions may have wrapped our wrapper. Leave their chain intact.
          if (Object.getOwnPropertyDescriptor(value, name)?.value !== wrapper) return;
          try {
            if (descriptor) Object.defineProperty(value, name, descriptor);
            else Reflect.deleteProperty(value, name);
          } catch {
            // A later owner may have frozen the registry; our wrapper is now passive.
          }
        });
      };
      patch("registerScreenDecorator", COPY_ID, copies);
      patch("registerOverlayRegion", COMMENT_ID, comments);
      attached = true;
      detach = unpatch;
    } catch {
      unpatch();
      warn("Cannot instrument the pi-libtui registry. Check other registry wrappers and /reload.");
    }
  };

  // Unknown accessors and non-configurable slots belong to another owner.
  if (original && (!("value" in original) || !original.configurable || !original.writable)) {
    warn("Cannot observe the pi-libtui registry slot safely. Check other registry wrappers and /reload.");
    return { isAttached: () => false, dispose() {} };
  }

  let current: unknown = original?.value;
  const get = (): unknown => current;
  const set = (next: unknown): void => {
    if (next === current) return;
    current = next;
    if (!stopped) {
      try {
        attach(next);
      } catch {
        warn("Cannot inspect the pi-libtui registry. Check companion compatibility and /reload.");
      }
    }
  };

  try {
    Object.defineProperty(scope, REGISTRY_KEY, {
      configurable: true,
      enumerable: original?.enumerable ?? true,
      get,
      set,
    });
    attach(current);
  } catch {
    warn("Cannot observe the pi-libtui registry. Check companion compatibility and /reload.");
  }

  return {
    isAttached: () => attached,
    dispose() {
      if (stopped) return;
      stopped = true;
      detach?.();
      attached = false;
      const descriptor = Object.getOwnPropertyDescriptor(scope, REGISTRY_KEY);
      if (descriptor?.get !== get || descriptor.set !== set) return;
      // Preserve the registry most recently published, including by a later package load.
      try {
        if (original) Object.defineProperty(scope, REGISTRY_KEY, { ...original, value: current });
        else if (current === undefined) Reflect.deleteProperty(scope, REGISTRY_KEY);
        else Object.defineProperty(scope, REGISTRY_KEY, {
          value: current, writable: true, configurable: true, enumerable: true,
        });
      } catch {
        // An owner that changed the descriptor keeps ownership; the accessor is passive.
      }
    },
  };
}
