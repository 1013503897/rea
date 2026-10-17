// Stream a complete legacy native inventory; retain only small expected query pages.
import assert from "node:assert/strict";
import { createReadStream } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { createGunzip } from "node:zlib";
import { Transform } from "node:stream";
import chain from "stream-chain";
import { parser } from "stream-json";
import { pick } from "stream-json/filters/pick.js";
import { streamArray } from "stream-json/streamers/stream-array.js";
import { join } from "node:path";

const [directory, output] = process.argv.slice(2);
assert(directory && output);
const manifest = JSON.parse(
  await readFile(join(directory, "manifest.json"), "utf8"),
);
const queries = [
  "undefined symbol",
  "Invalid bitcode signature",
  "",
  "\ud800",
  "a.b+",
].map((query) => ({ query, total: 0, sample: [] }));
const rawHash = createHash("sha256");
let bytes = 0,
  total = 0,
  group = [],
  previous = -1;
const emit = () => {
  group.sort((a, b) => a.encoding.localeCompare(b.encoding, "en"));
  for (const row of group) {
    for (const selection of queries)
      if (row.text.includes(selection.query)) {
        selection.total++;
        if (selection.sample.length < 16)
          selection.sample.push({ ...row, source_row: total });
      }
    total++;
  }
  group = [];
};
const stream = chain([
  createReadStream(join(directory, "inventory.json.gz")),
  createGunzip(),
  new Transform({
    transform(chunk, _encoding, done) {
      rawHash.update(chunk);
      bytes += chunk.length;
      done(null, chunk);
    },
  }),
  parser(),
  pick({ filter: "strings" }),
  streamArray(),
]);
for await (const { value } of stream) {
  assert(Number.isSafeInteger(value.address) && typeof value.text === "string");
  assert.equal(value.address_hex, "0x" + value.address.toString(16));
  assert(value.address >= previous);
  if (value.address !== previous) {
    emit();
    previous = value.address;
  }
  group.push(value);
}
emit();
assert.equal(rawHash.digest("hex"), manifest.raw_sha256);
assert.equal(bytes, manifest.raw_bytes);
await writeFile(
  output,
  JSON.stringify(
    {
      manifest,
      total,
      queries,
      scope:
        "Complete legacy producer comparison; query matches use JavaScript UTF16 includes, only first 16 per query retained. Not an independent proof of all string recognition.",
    },
    null,
    2,
  ),
  { flag: "wx" },
);
console.log(
  JSON.stringify({
    total,
    bytes,
    queries: queries.map(({ query, total }) => ({ query, total })),
  }),
);
