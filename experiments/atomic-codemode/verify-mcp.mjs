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

const [binary, output, scenario = "zlib"] = process.argv.slice(2);
assert.ok(["zlib", "sqlite-partial", "sqlite-encoded"].includes(scenario));
const verifier = createVerifierRun();
const client = new Client({ name: "rea-codemode-verifier", version: "0.1.0" });
const transport = new StdioClientTransport({
  command: process.execPath,
  args: [resolve("experiments/atomic-codemode/server.mjs")],
  env: { ...process.env },
  stderr: "pipe",
});
let stderr = "";
transport.stderr?.on("data", (part) => {
  stderr = (stderr + part).slice(-8192);
});
const calls = [];
const call = async (name, arguments_ = {}) => {
  const response = await client.callTool(
    { name, arguments: arguments_ },
    { timeout: 180000 },
  );
  assert.equal(response._meta?.provenance?.untrusted_content, true);
  const value = JSON.parse(response.content[0].text);
  calls.push({ name, arguments: arguments_, response: value });
  assert.equal(value.ok ?? true, true, JSON.stringify(value));
  return value;
};
let failure;
try {
  await client.connect(transport);
  const catalog = await client.listTools();
  assert.deepEqual(catalog.tools.map((tool) => tool.name).sort(), [
    "close_binary",
    "execute_javascript",
    "open_binary",
    "reference",
  ]);
  const ajv = new Ajv2020({ strict: false });
  for (const tool of catalog.tools) ajv.compile(tool.inputSchema);
  const opened = await call("open_binary", { path: binary });
  if (scenario === "sqlite-encoded") {
    for (const entry of ["0xb90e0", "0xb3d00"]) {
      const result = await call("execute_javascript", {
        code: `
const s=await rea.snapshot({entry:${JSON.stringify(entry)}});if(!s.ok)throw new Error(JSON.stringify(s));
const c=await rea.code({snapshot:s.data.snapshot,limit:4});if(!c.ok)throw new Error(JSON.stringify(c));
const graph=await rea.operations({snapshot:s.data.snapshot,limit:1,fields:["opcode"]});
return {snapshot:s.data,code:c.data,graph};`,
      });
      assert.equal(result.value.snapshot.facets.code.availability, "available");
      assert.ok(result.value.snapshot.source.bytes <= 8 * 1024 * 1024);
      assert.ok(result.value.code.total_lines > 1000);
      assert.ok(result.value.code.text.length > 0);
      assert.equal(
        result.value.code.evidence_id,
        result.value.snapshot.source.evidence_id,
      );
      if (entry === "0xb3d00") {
        assert.equal(result.value.graph.ok, true);
        assert.equal(result.value.graph.data.total, 5164);
      } else {
        assert.equal(result.value.snapshot.coverage.operations, null);
        assert.equal(result.value.graph.ok, false);
        assert.match(
          result.value.graph.error.details.native_error,
          /encoded document/u,
        );
        assert.equal(
          result.value.graph.error.details.evidence_id,
          result.value.snapshot.source.evidence_id,
        );
      }
    }
  } else if (scenario === "sqlite-partial") {
    assert.equal(opened.context.analysis_model, "experimental-native-ir-v2");
    const result = await call("execute_javascript", {
      code: `
const read=async(p)=>{const r=await p;if(!r.ok)throw new Error(JSON.stringify(r));return r.data;};
const names=await read(rea.functions({query:"sqlite3Fts3ErrMsg",exact:true}));
const entries=await read(rea.functions({query:"sqlite3VdbeExec",exact:true}));
const entry=entries.items.find(fn=>fn.address==="0xea6d0");if(!entry)throw new Error("fixture entry missing");
const snap=await read(rea.snapshot({entry:entry.address}));
const code=await read(rea.code({snapshot:snap.snapshot,limit:4}));
const graph=await rea.operations({snapshot:snap.snapshot,limit:1});
const evidence=await read(rea.evidence({evidence_id:snap.source.evidence_id,limit:512}));
return {names,snap,code,graph,evidence_source:evidence.source};`,
    });
    assert.deepEqual(result.value.names.items.map((fn) => fn.address).sort(), [
      "0x268f0",
      "0x5efc0",
    ]);
    assert.equal(result.value.snap.facets.code.availability, "available");
    assert.equal(
      result.value.snap.facets.recovered_ir.availability,
      "unavailable",
    );
    assert.equal(result.value.snap.coverage.operations, null);
    assert.ok(
      result.value.code.text.length > 0 && result.value.code.total_lines > 1000,
    );
    assert.equal(result.value.graph.ok, false);
    assert.equal(result.value.graph.error.code, "capability_unavailable");
    assert.equal(
      result.value.graph.error.details.evidence_id,
      result.value.snap.source.evidence_id,
    );
    assert.equal(
      result.value.evidence_source.sha256,
      result.value.snap.source.sha256,
    );
  } else {
    await call("reference", { query: "relations" });
    const result = await call("execute_javascript", {
      code: `
const found=await rea.strings({query:"incorrect header check",limit:1});
if(!found.ok) throw new Error(JSON.stringify(found));
const literal=found.data.items[0].address;
const refs=await rea.references({addresses:[literal]});
const entry=refs.data.results[0].items[0].fromFunction.address;
const snap=await rea.snapshot({entry}); if(!snap.ok)throw new Error(JSON.stringify(snap));
const s=snap.data.snapshot;
const seed=await rea.operations({snapshot:s,constant:literal});
const uses=await rea.relations({snapshot:s,kind:"uses",seeds:seed.data.items.map(x=>x.id)});
const consumers=await rea.operations({snapshot:s,ids:uses.data.items.map(x=>x.use)});
const incoming=await rea.relations({snapshot:s,kind:"incoming",seeds:consumers.data.items.map(x=>x.block)});
const slice=await rea.slice({snapshot:s,seeds:incoming.data.items.map(x=>x.operation).filter(Boolean),fields:["statement"]});
return {literal,entry,snapshot:s,consumer_blocks:[...new Set(consumers.data.items.map(x=>x.block))],selected:slice.data.operations.length,projected:slice.data.operations.every(op=>!("inputs" in op)&&typeof op.origin_address==="string"),guards:slice.data.operations.map(x=>x.statement),coverage:slice.data.coverage,evidence_id:slice.data.evidence_id};`,
    });
    assert.equal(result.value.selected, 19);
    assert.equal(result.value.projected, true);
    assert.equal(result.value.coverage.status, "partial");
    assert.ok(result.value.guards.some((s) => s.includes("/ #0x1f")));
    if (opened.context.analysis_model === "experimental-native-ir-v2") {
      const native = await call("execute_javascript", {
        code: `const s=${JSON.stringify(result.value.snapshot)};
const read=async(p)=>{const r=await p;if(!r.ok)throw new Error(JSON.stringify(r));return r.data;};
const blocks=await read(rea.blocks({snapshot:s,ids:${JSON.stringify(result.value.consumer_blocks)}}));
const controls=await read(rea.relations({snapshot:s,kind:"controllers",seeds:blocks.items.map(b=>b.id)}));
const guards=await read(rea.operations({snapshot:s,block_ids:controls.items.map(r=>r.controller),kind:"branch",fields:["inputs"]}));
const phi=await read(rea.operations({snapshot:s,kind:"phi",fields:["inputs","output"],limit:2}));
const values=await read(rea.values({snapshot:s,ids:phi.items.flatMap(o=>o.inputs.map(i=>i.value_id)).filter(Boolean)}));
return {blocks,controls,guards,phi,values};`,
      });
      assert.equal(native.value.controls.total, 2);
      assert.deepEqual(
        native.value.guards.items.map((op) => op.origin_address).sort(),
        ["0xd9ec", "0xda32"],
      );
      assert.ok(
        native.value.phi.items.every((op) =>
          op.inputs.every(
            (input) => typeof input.phi_predecessor_edge === "string",
          ),
        ),
      );
      assert.equal(
        native.value.blocks.coverage.control_flow,
        "complete-for-recovered-graph",
      );
      assert.ok(native.value.values.items.length > 0);
    }
    const machine = await call("execute_javascript", {
      code: 'const r=await rea.instructions({windows:[{address:"0xd97e",count:1},{address:"0xe26d",count:2},{address:"0xdeadbeef",count:1}]});if(!r.ok)throw new Error(JSON.stringify(r));return r.data;',
    });
    assert.equal(machine.value.results[0].items[0].bytes, "0f87e9080000");
    assert.match(machine.value.results[0].items[0].text, /e26d/u);
    assert.equal(machine.value.results[1].items[1].address, "0xe270");
    assert.match(machine.value.results[1].items[1].text, /d9c9/u);
    assert.equal(machine.value.results[2].ok, false);
  }
  await call("close_binary");
} catch (error) {
  failure = error.stack ?? String(error);
} finally {
  await client.close();
  await transport.close();
}
const lifecycle = await completeVerifierRun(verifier);
assertVerifierCleanupComplete(lifecycle.process_lineage);
await writeFile(
  output,
  JSON.stringify({ calls, failure, stderr, lifecycle }, null, 2),
  { flag: "wx" },
);
console.log(
  JSON.stringify({
    output,
    calls: calls.length,
    failure,
    cleanup_verified: true,
  }),
);
if (failure) process.exitCode = 1;
