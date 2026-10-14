import {
  spawn as nodeSpawn,
  type ChildProcess,
  type ChildProcessWithoutNullStreams,
  type SpawnOptionsWithoutStdio,
} from "node:child_process";
import { appendFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";

import { test as base } from "vitest";

const SHUTDOWN_GRACE_MS = 1_000;
let diagnosticSequence = 0;

/** Captured output and termination state from one child process. */
export interface ProcessResult {
  readonly exitCode: number | null;
  readonly signal: NodeJS.Signals | null;
  readonly stdout: string;
  readonly stderr: string;
}

/** Options for a bounded, output-capturing child process invocation. */
export interface ProcessRunOptions extends SpawnOptionsWithoutStdio {
  readonly timeoutMs?: number;
  readonly input?: string | Uint8Array;
}

/** Registry for child processes owned by one test. */
export interface TestProcesses {
  spawn(
    command: string,
    arguments_: readonly string[],
    options?: SpawnOptionsWithoutStdio,
  ): ChildProcessWithoutNullStreams;
  run(
    command: string,
    arguments_: readonly string[],
    options?: ProcessRunOptions,
  ): Promise<ProcessResult>;
  shutdown(): Promise<void>;
}

/** Wait for a child process to exit within a timeout, reporting completion. */
export const waitForExit = (
  child: ChildProcess,
  timeoutMs: number,
): Promise<boolean> =>
  new Promise((resolve) => {
    if (child.exitCode !== null || child.signalCode !== null) {
      resolve(true);
      return;
    }
    const timer = setTimeout(() => {
      child.removeListener("exit", onExit);
      resolve(false);
    }, timeoutMs);
    timer.unref();
    const onExit = (): void => {
      clearTimeout(timer);
      resolve(true);
    };
    child.once("exit", onExit);
  });

const stopChild = async (
  child: ChildProcessWithoutNullStreams,
): Promise<boolean> => {
  if (child.exitCode !== null || child.signalCode !== null) return true;
  child.kill("SIGTERM");
  if (await waitForExit(child, SHUTDOWN_GRACE_MS)) return true;
  child.kill("SIGKILL");
  return waitForExit(child, SHUTDOWN_GRACE_MS);
};

/** Create a child-process registry for a fixture composition root. */
export const createTestProcessRegistry = (): TestProcesses => {
  const children = new Set<ChildProcessWithoutNullStreams>();

  const spawn = (
    command: string,
    arguments_: readonly string[],
    options: SpawnOptionsWithoutStdio = {},
  ): ChildProcessWithoutNullStreams => {
    const child = nodeSpawn(command, arguments_, {
      ...options,
      stdio: ["pipe", "pipe", "pipe"],
    });
    children.add(child);
    child.once("exit", () => children.delete(child));
    child.once("close", () => children.delete(child));
    return child;
  };

  return {
    spawn,
    run: async (command, arguments_, options = {}) => {
      const { input, timeoutMs, ...spawnOptions } = options;
      // Temporary investigation only: no arguments, output, or environment are
      // persisted. Keep the original process deadline and result oracle.
      const diagnostics = process.env.REA_CI_PROCESS_DIAGNOSTICS;
      const cli =
        command === process.execPath &&
        arguments_[0] === resolve("scripts/rea.mjs");
      const id = `${process.pid}-${++diagnosticSequence}`;
      const started = performance.now();
      const record = (event: string, details: object = {}): void => {
        if (diagnostics === undefined) return;
        appendFileSync(
          join(diagnostics, "process.jsonl"),
          `${JSON.stringify({
            id,
            event,
            elapsedMs: performance.now() - started,
            cli,
            command: cli ? arguments_[1] : basename(command),
            invalidDemangle: arguments_.includes("$s4main\n3FooV"),
            ...details,
          })}\n`,
        );
      };
      const child = spawn(
        command,
        cli && diagnostics !== undefined
          ? [
              "--report-on-signal",
              "--report-exclude-env",
              "--report-exclude-network",
              `--report-directory=${diagnostics}`,
              ...arguments_,
            ]
          : arguments_,
        spawnOptions,
      );
      record("spawn", { pid: child.pid, timeoutMs });
      const reportTimer =
        cli && diagnostics !== undefined
          ? setTimeout(() => {
              record("diagnostic-signal");
              child.kill("SIGUSR2");
            }, 15_000)
          : undefined;
      reportTimer?.unref();
      const stdout: Buffer[] = [];
      const stderr: Buffer[] = [];
      child.stdout.on("data", (chunk: Buffer) => {
        if (stdout.length === 0) record("first-stdout");
        stdout.push(chunk);
      });
      child.stderr.on("data", (chunk: Buffer) => {
        if (stderr.length === 0) record("first-stderr");
        stderr.push(chunk);
      });
      if (input === undefined) child.stdin.end();
      else child.stdin.end(input);

      let timedOut = false;
      let killTimeout: NodeJS.Timeout | undefined;
      const timeout =
        timeoutMs === undefined
          ? undefined
          : setTimeout(() => {
              timedOut = true;
              record("deadline");
              child.kill("SIGTERM");
              killTimeout = setTimeout(() => {
                child.kill("SIGKILL");
              }, SHUTDOWN_GRACE_MS);
              killTimeout.unref();
            }, timeoutMs);
      timeout?.unref();

      const result = await new Promise<ProcessResult>((resolve, reject) => {
        child.once("error", reject);
        child.once("close", (exitCode, signal) =>
          resolve({
            exitCode,
            signal,
            stdout: Buffer.concat(stdout).toString("utf8"),
            stderr: Buffer.concat(stderr).toString("utf8"),
          }),
        );
      }).finally(() => {
        if (reportTimer !== undefined) clearTimeout(reportTimer);
        if (timeout !== undefined) clearTimeout(timeout);
        if (killTimeout !== undefined) clearTimeout(killTimeout);
      });
      record("close", {
        exitCode: result.exitCode,
        signal: result.signal,
        timedOut,
      });
      if (timedOut) {
        throw new Error(`Test process exceeded its ${timeoutMs}ms deadline`, {
          cause: result,
        });
      }
      return result;
    },
    shutdown: async () => {
      const results = await Promise.allSettled(
        [...children].reverse().map(async (child) => {
          if (!(await stopChild(child))) {
            throw new Error(
              `test child process ${String(child.pid)} did not exit after SIGKILL`,
            );
          }
        }),
      );
      const failures = results.flatMap((result) =>
        result.status === "rejected" ? [result.reason] : [],
      );
      if (children.size > 0) {
        failures.push(
          new Error(`${children.size} test child process(es) leaked`),
        );
      }
      if (failures.length > 0) {
        throw new AggregateError(
          failures,
          "Test child process shutdown failed",
        );
      }
    },
  };
};

/** Vitest API extended with a bounded child-process registry. */
export const processTest = base.extend<{ processes: TestProcesses }>({
  // oxlint-disable-next-line no-empty-pattern -- Vitest parses fixture dependencies from object destructuring.
  processes: async ({}, use) => {
    const processes = createTestProcessRegistry();
    try {
      await use(processes);
    } finally {
      await processes.shutdown();
    }
  },
});
