import { readFile } from "node:fs/promises";
import { AtomicSession } from "./api.mjs";
import { executeJavaScript } from "./executor.mjs";

const [binary, script] = process.argv.slice(2);
if (!binary || !script)
  throw new Error("Usage: node cli.mjs BINARY JAVASCRIPT_FILE");
const session = new AtomicSession();
try {
  await session.open(binary);
  const result = await executeJavaScript(
    session,
    await readFile(script, "utf8"),
  );
  console.log(JSON.stringify(result));
  process.exitCode = result.ok ? 0 : 1;
} finally {
  session.abort();
  await session.close();
}
