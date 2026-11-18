import { execFile } from "node:child_process";
import { isSourceId, type ImeConfig } from "./config.ts";
export { readConfig, type ImeConfig } from "./config.ts";

export interface ImeBackend {
  query(): Promise<string>;
  select(source: string): Promise<void>;
}

class CliError extends Error {
  constructor(readonly missing: boolean, detail: string) {
    super(missing
      ? "Input source CLI not found. Install macism or im-select on PATH, or set PI_COPY_MODE_IME_BIN."
      : `Input source CLI ${detail}. Check the CLI and PI_COPY_MODE_IME_TIMEOUT_MS.`);
  }
}

function run(binary: string, args: string[], timeoutMs: number): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(binary, args, {
      encoding: "utf8",
      shell: false,
      timeout: timeoutMs,
      killSignal: "SIGKILL",
      maxBuffer: 4096,
      windowsHide: true,
    }, (error, stdout) => {
      if (error) {
        const operation = args.length === 0 ? "query" : "selection";
        const executable = binary === "macism" || binary === "im-select" ? binary : "configured executable";
        let reason = typeof error.code === "number"
          ? `exited with code ${error.code}`
          : `failed (${error.code ?? "unknown error"})`;
        if (error.code === "ERR_CHILD_PROCESS_STDIO_MAXBUFFER") {
          reason = "output exceeded the 4096-byte limit";
        } else if (error.killed) {
          reason = `timed out after ${timeoutMs} ms`;
        } else if (error.signal) {
          reason = `terminated by ${error.signal}`;
        }
        reject(new CliError(error.code === "ENOENT", `${operation} ${reason} (${executable})`));
      } else {
        resolve(stdout.trim());
      }
    });
  });
}

function parseSource(output: string): string {
  if (!isSourceId(output)) {
    throw new Error("Input source CLI returned an invalid source ID. Check macism or im-select in this terminal.");
  }
  return output;
}

/** Both macOS CLIs query with no arguments and select with one source ID. */
export function createBackend(config: ImeConfig): ImeBackend {
  let binary = config.binary;

  const query = async (): Promise<string> => {
    if (binary) return parseSource(await run(binary, [], config.timeoutMs));
    try {
      const source = parseSource(await run("macism", [], config.timeoutMs));
      binary = "macism";
      return source;
    } catch (error) {
      if (!(error instanceof CliError) || !error.missing) throw error;
    }
    const source = parseSource(await run("im-select", [], config.timeoutMs));
    binary = "im-select";
    return source;
  };

  return {
    query,
    async select(source) {
      if (!isSourceId(source)) throw new Error("Refusing an invalid input source ID.");
      // Discovery must finish before any switch, including restoration.
      if (!binary) await query();
      await run(binary!, [source], config.timeoutMs);
      // macism can exit successfully when the requested source does not exist.
      if (await query() !== source) {
        throw new Error("Input source did not change as requested. Enable the source in macOS settings and check PI_COPY_MODE_IME_NAV_SOURCE and hook policies.");
      }
    },
  };
}
