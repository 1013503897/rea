/** Deny only the first removal of a CLI-owned `rea-wabt-*` runtime root.
 * Later removals use the real filesystem. Each attempt is appended to
 * `REA_RUNTIME_ROOT_REMOVAL_TRACE` as `denied|removed|failed <path>`.
 */
import { appendFileSync, existsSync } from "node:fs";
import fsPromises from "node:fs/promises";
import { syncBuiltinESMExports } from "node:module";
import { tmpdir } from "node:os";
import { basename, dirname } from "node:path";

const trace = process.env.REA_RUNTIME_ROOT_REMOVAL_TRACE ?? "";
const original = fsPromises.rm;
let denied = false;

fsPromises.rm = async (path, options) => {
  const target = String(path);
  if (
    trace === "" ||
    dirname(target) !== tmpdir() ||
    !basename(target).startsWith("rea-wabt-")
  )
    return original(path, options);
  if (!denied) {
    denied = true;
    appendFileSync(trace, `denied ${target}\n`);
    throw Object.assign(
      new Error(`EACCES: permission denied, rm '${target}'`),
      {
        code: "EACCES",
      },
    );
  }
  try {
    await original(path, options);
  } catch (cause) {
    appendFileSync(trace, `failed ${target}\n`);
    throw cause;
  }
  appendFileSync(
    trace,
    `${existsSync(target) ? "failed" : "removed"} ${target}\n`,
  );
};
syncBuiltinESMExports();
