// Read-only kernel counters for the currently bounded diagnostic payload.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

export async function familyCounters() {
  const group = (await readFile("/proc/self/cgroup", "utf8"))
    .split("\n")
    .find((row) => row.startsWith("0::"))
    ?.slice(3);
  assert.ok(group?.includes("rea-efficiency-"), "Run under resource-run.py");
  const cpu = (await readFile(`/sys/fs/cgroup${group}/cpu.stat`, "utf8")).match(
    /^usage_usec (\d+)$/mu,
  );
  assert.ok(cpu, "Missing cgroup CPU counter");
  return {
    cpu: Number(cpu[1]),
    peak: Number(
      (await readFile(`/sys/fs/cgroup${group}/memory.peak`, "utf8")).trim(),
    ),
  };
}
