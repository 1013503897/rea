import { chmod, mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { expect, it } from "vitest";

import { analysisErrorProjectionSchema } from "../../../src/contracts/errorSchemas.js";
import { parseEvidence } from "../../../src/domain/evidence.js";
import { runCliJson } from "../../fixtures/cliJsonProcess.js";
import { createTestTempDirectory } from "../../fixtures/temporaryDirectory.js";

const canDenyCleanup = process.platform !== "win32" && process.getuid?.() !== 0;

it.runIf(canDenyCleanup)(
  "retains wasm evidence and primary diagnostics when real scratch cleanup is denied",
  async () => {
    const directory = await createTestTempDirectory("rea-wasm-cleanup-cli-");
    const tools = join(directory, "tools");
    const artifact = join(directory, "module.wasm");
    const locked = join(directory, "locked-paths.txt");
    await mkdir(tools);
    const wasm = Buffer.from(
      "0061736d01000000010401600000020b0103656e7603666f6f0000030201000503010001071002066d656d6f727902000372756e00010a0601040001010b000c04746573747061796c6f6164",
      "hex",
    );
    expect(wasm).toHaveLength(76);
    await writeFile(artifact, wasm);
    execFileSync(process.execPath, [
      "-e",
      "WebAssembly.compile(require('node:fs').readFileSync(process.argv[1])).catch(() => { process.exitCode = 1; });",
      artifact,
    ]);
    const objdump = fileURLToPath(
      new URL("../../fixtures/wasm/objdump.txt", import.meta.url),
    );
    const makeTool = async (name: string, body: string) => {
      const path = join(tools, name);
      await writeFile(path, `#!/bin/sh\n${body}\n`, { mode: 0o700 });
      await chmod(path, 0o700);
    };
    const deny = `mkdir denied\nprintf '%s\\n' "$PWD/denied" >> "$REA_LOCKED_PATHS"\nprintf marker > denied/marker\nchmod 000 denied`;
    await makeTool(
      "wasm-validate",
      `if [ "$1" = "--version" ]; then echo '1.0.42'; exit 0; fi\nif [ "$REA_PRIMARY_FAILURE" = "1" ]; then ${deny}\n  echo 'fixture validation rejected' >&2\n  exit 1\nfi\nexit 0`,
    );
    await makeTool(
      "wasm-objdump",
      `if [ "$1" = "--version" ]; then echo '1.0.42'; exit 0; fi\ncat "$REA_FIXTURE_OBJDUMP"`,
    );
    await makeTool(
      "wasm2wat",
      `if [ "$1" = "--version" ]; then echo '1.0.42'; exit 0; fi\nif [ "$REA_DENY_CLEANUP" = "1" ]; then ${deny}; fi\nprintf '%s\\n' '(module (@custom "test" "payload"))'`,
    );

    const environment = {
      ...process.env,
      REA_WABT_BIN_DIRECTORY: tools,
      REA_FIXTURE_OBJDUMP: objdump,
      REA_LOCKED_PATHS: locked,
      TMPDIR: directory,
      TMP: directory,
      TEMP: directory,
    };
    const invoke = (extra: NodeJS.ProcessEnv = {}) =>
      runCliJson(["inspect-wasm-artifact", artifact, "--format", "json"], {
        ...environment,
        ...extra,
      });
    const restoreDeniedDirectories = async () => {
      let paths: string[] = [];
      try {
        paths = (await readFile(locked, "utf8")).trim().split("\n");
      } catch (cause: unknown) {
        if (
          cause instanceof Error &&
          "code" in cause &&
          cause.code === "ENOENT"
        )
          return;
        throw cause;
      }
      for (const path of paths) await chmod(path, 0o700);
    };

    try {
      const control = parseEvidence(await invoke());
      expect(control.normalized_result).toMatchObject({ validation: "valid" });

      const completedThenCleanupFails = analysisErrorProjectionSchema.parse(
        await invoke({ REA_DENY_CLEANUP: "1" }),
      );
      expect(completedThenCleanupFails).toMatchObject({
        code: "cleanup_incomplete",
        details: {
          cleanup: "incomplete",
          partial_observation: {
            normalized_result: { validation: "valid" },
          },
        },
      });

      await restoreDeniedDirectories();
      await writeFile(locked, "");
      const primaryAndCleanupFail = analysisErrorProjectionSchema.parse(
        await invoke({ REA_PRIMARY_FAILURE: "1" }),
      );
      expect(primaryAndCleanupFail).toMatchObject({
        code: "cleanup_incomplete",
        details: {
          execution_failure: "execution_failure",
          diagnostics: {
            primary_error: { code: "cleanup_incomplete" },
            cleanup_error: { code: "cleanup_incomplete" },
          },
        },
      });
      expect(JSON.stringify(primaryAndCleanupFail.details)).toContain(
        "fixture validation rejected",
      );
    } finally {
      await restoreDeniedDirectories();
    }
  },
);

it.runIf(process.platform !== "win32")(
  "resolves runtime-root cleanup after the owner's close retry succeeds",
  async () => {
    const directory = await createTestTempDirectory("rea-wasm-cleanup-retry-");
    const runtimeTemp = join(directory, "tmp");
    const tools = join(directory, "tools");
    const artifact = join(directory, "module.wasm");
    await mkdir(runtimeTemp);
    await mkdir(tools);
    await writeFile(
      artifact,
      Buffer.from(
        "0061736d01000000010401600000020b0103656e7603666f6f0000030201000503010001071002066d656d6f727902000372756e00010a0601040001010b000c04746573747061796c6f6164",
        "hex",
      ),
    );
    const makeTool = async (name: string, body: string) => {
      const path = join(tools, name);
      await writeFile(
        path,
        `#!/bin/sh\nif [ "$1" = "--version" ]; then echo '1.0.42'; exit 0; fi\n${body}\n`,
        { mode: 0o700 },
      );
      await chmod(path, 0o700);
    };
    await makeTool(
      "wasm-validate",
      `if [ "$REA_REJECT_MODULE" = "1" ]; then echo 'fixture validation rejected' >&2; exit 1; fi\nexit 0`,
    );
    await makeTool("wasm-objdump", `cat "$REA_FIXTURE_OBJDUMP"`);
    await makeTool(
      "wasm2wat",
      `printf '%s\\n' '(module (@custom "test" "payload"))'`,
    );
    const invoke = async (name: string, extra: NodeJS.ProcessEnv = {}) => {
      const trace = join(directory, `${name}.trace`);
      const output = await runCliJson(
        ["inspect-wasm-artifact", artifact, "--format", "json"],
        {
          ...process.env,
          ...extra,
          NODE_OPTIONS: `--import=${new URL("../../fixtures/wasm/denyFirstRuntimeRootRemoval.mjs", import.meta.url).href}`,
          REA_RUNTIME_ROOT_REMOVAL_TRACE: trace,
          REA_WABT_BIN_DIRECTORY: tools,
          REA_FIXTURE_OBJDUMP: fileURLToPath(
            new URL("../../fixtures/wasm/objdump.txt", import.meta.url),
          ),
          TMPDIR: runtimeTemp,
          TMP: runtimeTemp,
          TEMP: runtimeTemp,
        },
      );
      // The owner's first removal is denied; its close retry really removes it.
      const attempts = (await readFile(trace, "utf8")).trim().split("\n");
      const root = attempts[0]?.slice("denied ".length) ?? "";
      expect(attempts).toEqual([`denied ${root}`, `removed ${root}`]);
      await expect(readdir(runtimeTemp)).resolves.toEqual([]);
      const projection = analysisErrorProjectionSchema.parse(output);
      expect(projection.code).not.toBe("cleanup_incomplete");
      expect(projection.details).not.toHaveProperty("cleanup", "incomplete");
      // Historical cleanup diagnostics may name the root; live resources may not.
      const details = projection.details ?? {};
      const resources = "resources" in details ? details.resources : [];
      expect(Array.isArray(resources) ? resources : []).not.toContain(root);
      return projection;
    };

    const completed = await invoke("completed");
    expect(completed).toMatchObject({
      code: "execution_failure",
      details: {
        partial_observation: { normalized_result: { validation: "valid" } },
      },
    });

    const rejected = await invoke("rejected", { REA_REJECT_MODULE: "1" });
    expect(rejected).toMatchObject({
      code: "invalid_request",
      details: {
        partial_observation: {
          normalized_result: { validation: "rejected-by-selected-profile" },
        },
      },
    });
    expect(JSON.stringify(rejected.details)).toContain(
      "fixture validation rejected",
    );
  },
);
