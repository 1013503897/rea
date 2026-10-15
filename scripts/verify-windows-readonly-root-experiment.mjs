import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
  access,
  mkdir,
  mkdtemp,
  readFile,
  rename,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

if (process.platform !== "win32")
  throw new Error("Requires actual Windows NTFS");
const [rootArgument, expected] = process.argv.slice(2);
assert.ok(rootArgument);
assert.ok(expected === "deny-clear" || expected === "allow");
const root = resolve(rootArgument);
const { requireWindowsNativeAuthority } = await import(
  pathToFileURL(join(root, "dist/windows/WindowsNativeLoader.js"))
);
const native = requireWindowsNativeAuthority();
const workspace = await mkdtemp(join(tmpdir(), "rea-readonly-root-probe-"));
const roots = [];
const attributes = (path, readonly) => {
  const script = `$ErrorActionPreference='Stop';
$path=$env:REA_OWNED_ATTRIBUTE_PROBE;
$current=[int][IO.File]::GetAttributes($path);
$next=if($env:REA_ATTRIBUTE_PROBE_MODE -eq 'set'){ $current -bor 1 }else{ $current -band (-bnot 1) };
[IO.File]::SetAttributes($path,[IO.FileAttributes]$next);
$observed=[int][IO.File]::GetAttributes($path);
@{readonly=(($observed -band 1) -ne 0); attributes=$observed} | ConvertTo-Json -Compress`;
  const result = JSON.parse(
    execFileSync(
      "powershell.exe",
      ["-NoLogo", "-NoProfile", "-NonInteractive", "-Command", script],
      {
        encoding: "utf8",
        timeout: 10000,
        windowsHide: true,
        env: {
          ...process.env,
          REA_OWNED_ATTRIBUTE_PROBE: path,
          REA_ATTRIBUTE_PROBE_MODE: readonly ? "set" : "clear",
        },
      },
    ),
  );
  assert.equal(result.readonly, readonly);
  return result;
};
const create = () => {
  const runtime = native.call("runtime_create", [workspace, "owned-"]);
  const owned = { runtime, currentPath: runtime.path, closed: false };
  roots.push(owned);
  return owned;
};
const close = (owned) => {
  native.call("runtime_close", [owned.runtime.handle]);
  owned.closed = true;
};
try {
  const normal = create();
  close(normal);
  await assert.rejects(access(normal.currentPath), { code: "ENOENT" });

  const owned = create();
  const original = owned.currentPath;
  const originalIdentity = await stat(original, { bigint: true });
  const marked = attributes(original, true);
  assert.notEqual(marked.attributes & 16, 0, "Probe must be a directory");
  const moved = original + "-moved";
  await rename(original, moved);
  owned.currentPath = moved;
  await mkdir(original);
  const replacementIdentity = await stat(original, { bigint: true });
  assert.notEqual(replacementIdentity.ino, originalIdentity.ino);
  const sentinel = join(original, "unrelated.txt");
  await writeFile(sentinel, "replacement must survive");
  let failure;
  try {
    close(owned);
  } catch (cause) {
    failure = cause;
  }
  if (expected === "deny-clear") {
    assert.equal(failure?.win32Code, 5);
    assert.equal(failure?.constraint, "Clear owned readonly attribute failed");
    assert.equal(
      (await stat(moved, { bigint: true })).ino,
      originalIdentity.ino,
    );
    attributes(moved, false);
    close(owned);
  } else assert.equal(failure, undefined, failure?.message);
  await assert.rejects(access(moved), { code: "ENOENT" });
  assert.equal(
    (await stat(original, { bigint: true })).ino,
    replacementIdentity.ino,
  );
  assert.equal(await readFile(sentinel, "utf8"), "replacement must survive");

  const children = create();
  native.call("runtime_mkdir", [children.runtime.handle, "nested"]);
  native.call("runtime_write", [
    children.runtime.handle,
    "nested/readonly.txt",
    Buffer.from("owned readonly file"),
  ]);
  attributes(join(children.currentPath, "nested"), true);
  attributes(join(children.currentPath, "nested", "readonly.txt"), true);
  close(children);
  await assert.rejects(access(children.currentPath), { code: "ENOENT" });
  console.log(
    JSON.stringify({
      ok: true,
      expected,
      rootReadonlyConfirmed: true,
      renamedOwnedRootRemoved: true,
      unrelatedReplacementPreserved: true,
      readonlyChildFileAndDirectoryRemoved: true,
      baselineConstraint: failure?.constraint ?? null,
      baselineWin32: failure?.win32Code ?? null,
      originalIssueDeleteDenialReproduced: false,
    }),
  );
} finally {
  for (const owned of roots) {
    if (owned.closed) continue;
    attributes(owned.currentPath, false);
    close(owned);
  }
  await rm(workspace, { recursive: true, force: true });
}
