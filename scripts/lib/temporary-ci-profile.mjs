import { appendFileSync } from "node:fs";

/** Temporary diagnostic events; never persist arguments, output or environment. */
export const trace = (phase, detail = {}) => {
  const path = process.env.REA_CI_PACKAGE_TRACE;
  if (path === undefined) return;
  appendFileSync(
    path,
    `${JSON.stringify({ phase, pid: process.pid, atMs: performance.now(), ...detail })}\n`,
  );
};

/** Observe an unchanged operation and preserve its value or exception. */
export const profile = async (phase, operation) => {
  const start = performance.now();
  trace(`${phase}:start`);
  try {
    const result = await operation();
    trace(`${phase}:complete`, { durationMs: performance.now() - start });
    return result;
  } catch (cause) {
    trace(`${phase}:failed`, { durationMs: performance.now() - start });
    throw cause;
  }
};
