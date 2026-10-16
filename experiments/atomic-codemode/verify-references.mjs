// Real adapter/reference coverage, including a function beyond full IR capacity.
import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { Client } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";
import Ajv2020 from "ajv/dist/2020.js";
import {
  createVerifierRun,
  completeVerifierRun,
  assertVerifierCleanupComplete,
} from "../../scripts/lib/verifier-run.mjs";

const [binary, output] = process.argv.slice(2);
const verifier = createVerifierRun(),
  calls = [],
  failures = [];
const direct = process.env.REA_ATOMIC_ADAPTER === "direct";
const client = new Client({ name: "rea-reference-verifier", version: "0.1.0" });
const transport = new StdioClientTransport({
  command: process.execPath,
  args: [resolve("experiments/atomic-codemode/server.mjs")],
  env: { ...process.env },
  stderr: "pipe",
});
const call = async (name, input) => {
  const result = await client.callTool(
    { name, arguments: input },
    { timeout: 180000 },
  );
  assert.equal(result._meta?.provenance?.untrusted_content, true);
  const value = JSON.parse(result.content[0].text);
  calls.push({ name, input, value });
  return value;
};
const read = async (name, input) => {
  const r = direct
    ? await call(`facts_${name}`, input)
    : await call("execute_javascript", {
        code: `const r=await rea.${name}(${JSON.stringify(input)});if(!r.ok)throw new Error(JSON.stringify(r));return r.data;`,
      });
  assert.equal(r.ok, true, JSON.stringify(r));
  return direct ? r.data : r.value;
};
const references = (addresses, scope = "function", extra = {}) =>
  read("references", {
    addresses,
    direction: "outgoing",
    scope,
    kinds: ["call"],
    fields: [],
    limit: 128,
    ...extra,
  });
try {
  await client.connect(transport);
  const catalog = await client.listTools();
  const ajv = new Ajv2020({ strict: false });
  for (const tool of catalog.tools) ajv.compile(tool.inputSchema);
  assert.equal((await call("open_binary", { path: binary })).ok, true);
  const wrapper = (await references(["0x65180"])).results[0];
  assert.equal(wrapper.total, 9);
  assert.equal(wrapper.coverage.function_scope, "established-by-rows");
  assert.ok(
    wrapper.items.some((r) => r.from === "0x6534b" && r.to === "0x29370"),
  );
  assert.deepEqual(
    Object.keys(wrapper.items[0]).sort(),
    ["source_row", "from", "to", "kind"].sort(),
  );
  const snapshot = await read("snapshot", { entry: "0x65180" });
  const recovered = await read("calls", {
    snapshot: snapshot.snapshot,
    fields: ["target"],
    limit: 128,
  });
  assert.equal(recovered.total, 8);
  assert.ok(recovered.items.every((r) => r.origin_address !== "0x6534b"));
  const exact = (await references(["0x65180"], "address")).results[0];
  assert.equal(exact.total, 0);
  assert.equal(exact.coverage.excluded_scope_rows, 9);
  assert.equal(exact.source.evidence_id, wrapper.source.evidence_id);
  const sites = await references(["0x65211", "0xf238b"], "address");
  assert.deepEqual(
    sites.results.map((r) => r.items.map((f) => [f.from, f.to])),
    [[["0x65211", "0x64060"]], [["0xf238b", "0x296c0"]]],
  );
  const pages = [];
  let source;
  for (let offset = 0; offset !== null;) {
    const row = (await references(["0xea6d0"], "function", { offset }))
      .results[0];
    assert.equal(row.ok, true);
    assert.equal(row.total, 396);
    if (source) assert.equal(row.source.evidence_id, source);
    source = row.source.evidence_id;
    pages.push(...row.items);
    offset = row.next_offset;
  }
  assert.equal(pages.length, 396);
  assert.equal(new Set(pages.map((p) => p.source_row)).size, 396);
  assert.equal(new Set(pages.map((p) => p.to)).size, 171);
  assert.equal(pages.filter((p) => p.to === "0x296c0").length, 16);
  const unknown = (await references(["0xdeadbeef"])).results[0];
  assert.equal(unknown.coverage.function_scope, "unknown");
  assert.equal(unknown.coverage.discovery, "unknown");
  if (direct) {
    // The SDK rejects invalid direct arguments before the target-content handler.
    const rejected = await client.callTool({
      name: "facts_references",
      arguments: {
        addresses: ["0x1000"],
        direction: "incoming",
        scope: "function",
      },
    });
    calls.push({ name: "facts_references:invalid-scope", value: rejected });
    assert.equal(rejected.isError, true);
    assert.match(
      JSON.stringify(rejected.content),
      /Incoming references require exact address scope/,
    );
  } else {
    const bad = await call("execute_javascript", {
      code: 'return await rea.references({addresses:["0x1000"],direction:"incoming",scope:"function"});',
    });
    assert.equal(bad.value.ok, false);
    assert.equal(bad.value.error.code, "invalid_input");
  }
  if (!direct) {
    const composed = await call("execute_javascript", {
      code: 'let offset=0,n=0,formatter=0;const targets=new Set();do{const r=await rea.references({addresses:["0xea6d0"],direction:"outgoing",scope:"function",kinds:["call"],fields:[],offset,limit:128});if(!r.ok)throw new Error(JSON.stringify(r));const p=r.data.results[0];if(!p.ok)throw new Error(JSON.stringify(p));for(const x of p.items){n++;targets.add(x.to);if(x.to==="0x296c0")formatter++;}offset=p.next_offset;}while(offset!==null);return {references:n,distinct_targets:targets.size,formatter};',
    });
    assert.equal(composed.ok, true);
    assert.deepEqual(composed.value, {
      references: 396,
      distinct_targets: 171,
      formatter: 16,
    });
    assert.deepEqual(composed.evidence_ids, [source]);
    const vm = await read("snapshot", { entry: "0xea6d0" });
    assert.equal(vm.facets.code.availability, "available");
    assert.equal(vm.facets.recovered_ir.availability, "unavailable");
    assert.match(vm.facets.recovered_ir.error.details.native_error, /capacity/);
    assert.equal(vm.facets.calls.availability, "available");
    assert.equal(vm.facets.values.scope, "call-boundary-only");
    const selectedCalls = await read("calls", {
      snapshot: vm.snapshot,
      origin_addresses: ["0xf238b", "0xf115c"],
      fields: ["target", "target_value_id", "arguments"],
    });
    assert.equal(selectedCalls.total, 2);
    assert.ok(selectedCalls.items.every((c) => c.target?.offset === "0x296c0"));
    assert.ok(selectedCalls.coverage.operations_examined > 12000);
    const ids = [
      ...new Set(
        selectedCalls.items
          .flatMap((c) => [
            c.target_value_id,
            ...c.arguments.map((a) => a.value_id),
          ])
          .filter(Boolean),
      ),
    ];
    const boundary = await read("values", { snapshot: vm.snapshot, ids });
    assert.equal(boundary.missing.length, 0);
    assert.match(boundary.coverage.value_scope, /only/);
    for (const row of selectedCalls.items)
      assert.ok(
        boundary.items.some(
          (v) =>
            v.id === row.target_value_id &&
            v.space === "fspec" &&
            v.is_annotation,
        ),
      );
    const unavailable = await call("execute_javascript", {
      code: `return await rea.operations({snapshot:${JSON.stringify(vm.snapshot)},limit:1});`,
    });
    assert.equal(unavailable.value.ok, false);
    assert.equal(unavailable.value.error.code, "capability_unavailable");
    assert.equal(
      (await read("snapshot", { entry: "0xea6d0" })).snapshot,
      vm.snapshot,
    );
  }
  assert.equal((await call("close_binary", {})).ok, true);
} catch (error) {
  failures.push(error.stack ?? String(error));
} finally {
  try {
    await client.close();
    await transport.close();
  } catch (error) {
    failures.push(String(error));
  }
}
const lifecycle = await completeVerifierRun(verifier);
assertVerifierCleanupComplete(lifecycle.process_lineage);
await writeFile(
  output,
  JSON.stringify({ direct, calls, failures, lifecycle }),
  { flag: "wx" },
);
console.log(
  JSON.stringify({
    output,
    direct,
    calls: calls.length,
    failures,
    cleanup_verified: true,
  }),
);
if (failures.length) process.exitCode = 1;
