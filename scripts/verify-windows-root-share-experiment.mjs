#!/usr/bin/env node

import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, parse, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { verifyVolumeRootAppendLease } from "./lib/windows-volume-root-append-lease.mjs";

if (process.platform !== "win32" || process.arch !== "x64")
  throw new Error("The volume-root share probe requires Windows x64.");

const [packageRootArgument, fixtureArgument, expectation] = process.argv.slice(2);
if (
  packageRootArgument === undefined ||
  fixtureArgument === undefined ||
  (expectation !== "expect-denial" && expectation !== "allow")
)
  throw new Error(
    "Usage: verify-windows-root-share-experiment.mjs PACKAGE_ROOT FIXTURE expect-denial|allow",
  );

const packageRoot = resolve(packageRootArgument);
const fixturePath = resolve(fixtureArgument);
const { requireWindowsNativeAuthority } = await import(
  pathToFileURL(join(packageRoot, "dist/windows/WindowsNativeLoader.js"))
);
const native = requireWindowsNativeAuthority();
const workspace = await mkdtemp(join(tmpdir(), "rea-volume-root-share-"));

try {
  const sourceDirectory = join(workspace, "source");
  await mkdir(sourceDirectory);
  const source = join(sourceDirectory, "target.bin");
  await writeFile(source, "volume-root admission control");
  await verifyVolumeRootAppendLease({
    fixturePath,
    volumeRoot: parse(source).root,
    verifyAdmission: () => {
      let admitted;
      let failure;
      try {
        admitted = native.call("open", [source]);
      } catch (cause) {
        failure = cause;
      }
      if (admitted !== undefined) native.call("close", [admitted.handle]);

      if (expectation === "expect-denial") {
        assert.equal(
          failure?.win32Code,
          32,
          `Baseline root admission must fail with Win32 32; observed ${failure?.win32Code ?? "success"}.`,
        );
      } else {
        assert.equal(
          failure,
          undefined,
          `Fixed root admission should succeed, got ${failure?.message ?? failure}.`,
        );
        assert.ok(admitted);
      }
    },
  });
  process.stdout.write(
    `${JSON.stringify({ ok: true, expectation, volumeRoot: parse(source).root })}\n`,
  );
} finally {
  await rm(workspace, { recursive: true, force: true });
}
