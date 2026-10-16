import assert from "node:assert/strict";
import test from "node:test";
import { backwardSlice, parseKunaSsaDump } from "./kuna-ssa.mjs";
import { queryLiteralUses } from "./query-ssa.mjs";

// Minimal native print_raw syntax, including a STORE pointer on its LHS.
const dump = `ignored C text
0
Basic Block 0 0x100-0x106
0x100:1: r0(0x100:1) = #0xffffffffffffffff
0x102:2: u0(0x102:2) = r0(0x100:1) != #0x0
0x106:3: goto Block_1:0x110 if (u0(0x102:2) != 0) else Block_2:0x120
Basic Block 1 0x110-0x114
0x110:4: u1(0x110:4) = ->(RDI(i),#0x30)
0x112:5: *(ram,u1(0x110:4)) = r0(0x100:1)
0x114:6: return(#0x0)
Basic Block 2 0x120-0x120
0x120:7: switch r0(0x100:1)
`;

test("SSA definitions preserve STORE address dependencies, exact u64 and conditional polarity", () => {
  const snapshot = parseKunaSsaDump(dump);
  assert.deepEqual(snapshot.findConstant("0xffffffffffffffff"), ["0x100:1"]);
  assert.deepEqual(
    snapshot.operation("0x112:5").definitions.map((e) => e.definition),
    ["0x110:4", "0x100:1"],
  );
  assert.equal(snapshot.operation("0x100:1").definitions.length, 0);
  assert.deepEqual(
    snapshot.incoming(1).map((e) => [e.from, e.polarity]),
    [[0, "true"]],
  );
  assert.deepEqual(
    snapshot.incoming(2).map((e) => [e.from, e.polarity]),
    [[0, "false"]],
  );
  assert.deepEqual(snapshot.coverage.unrepresented_outgoing_blocks, [2]);
  assert.equal(snapshot.coverage.control_flow, "partial");
});

test("a bounded slice names budget frontiers; graph cycles terminate", () => {
  const snapshot = parseKunaSsaDump(dump);
  const result = backwardSlice(snapshot, ["0x112:5"], { maxOperations: 1 });
  assert.equal(result.operations.length, 1);
  assert.equal(result.coverage.boundaries.length, 2);
  assert.equal(result.coverage.status, "partial");
  const cyclic = parseKunaSsaDump(
    dump.replace("#0xffffffffffffffff", "r0(0x100:1)"),
  );
  assert.equal(backwardSlice(cyclic, ["0x100:1"]).operations.length, 1);
});

test("snapshot identity changes with source; malformed and missing facts cannot look complete", () => {
  assert.notEqual(
    parseKunaSsaDump(dump).identity.sha256,
    parseKunaSsaDump(dump + "unknown native line\n").identity.sha256,
  );
  assert.equal(
    parseKunaSsaDump(dump + "unknown native line\n").coverage.issues.length,
    1,
  );
  assert.throws(
    () => parseKunaSsaDump(dump.replace("Block_1:0x110", "Block_1:0x111")),
    /identity mismatch/u,
  );
  assert.throws(
    () => parseKunaSsaDump(dump.replace("0x112:5:", "0x100:1:")),
    /Duplicate operation/u,
  );
  const missing = parseKunaSsaDump(
    dump.replace("r0(0x100:1) !=", "r0(0xff:9) !="),
  );
  assert.equal(missing.coverage.issues.length, 1);
  assert.deepEqual(backwardSlice(missing, ["0x102:2"]).coverage.missing, [
    "0xff:9",
  ]);
});

test("phi/load cutoffs preserve boundary rows and do not invent memory or predecessor bindings", () => {
  const snapshot = parseKunaSsaDump(
    dump.replace("r0(0x100:1) != #0x0", "r0(0x100:1) ? r0(0x100:1)"),
  );
  const result = backwardSlice(snapshot, ["0x102:2"]);
  assert.deepEqual(result.coverage.boundaries, [
    { id: "0x102:2", reason: "phi" },
  ]);
  assert.equal(result.operations.length, 1);
  assert.equal(result.operations[0].definitions.length, 2);
  assert.equal(result.coverage.memory_alias_dependencies, "unknown");
});

test("cloned blocks share starts; operation identity includes sequence, and facts stay immutable", () => {
  const snapshot = parseKunaSsaDump(dump.replaceAll("0x120", "0x110"));
  assert.equal(snapshot.block(1).origin_start, snapshot.block(2).origin_start);
  assert.notEqual(snapshot.block(1).id, snapshot.block(2).id);
  assert.throws(() => {
    snapshot.operation("0x100:1").kind = "store";
  }, TypeError);
  assert.throws(() => snapshot.uses("0x100:1").pop(), TypeError);
  const query = queryLiteralUses(snapshot, "0xffffffffffffffff");
  assert.deepEqual(query.constant_operations, ["0x100:1"]);
  assert.ok(query.direct_uses.includes("0x112:5"));
  assert.equal(query.coverage.control_flow, "partial");
});

test("a literal directly in STORE is itself an effect seed; shared block edges are returned once", () => {
  const snapshot = parseKunaSsaDump(
    dump.replace(
      "*(ram,u1(0x110:4)) = r0(0x100:1)",
      "*(ram,u1(0x110:4)) = #0x20",
    ),
  );
  const query = queryLiteralUses(snapshot, "0x20");
  assert.deepEqual(query.effect_seed_operations, ["0x112:5"]);
  assert.deepEqual(
    query.control_edges.map((e) => e.operation),
    ["0x106:3"],
  );
  assert.ok(query.operations.some((row) => row.id === "0x102:2"));
});
