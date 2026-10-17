// Own the complete MCP tool-result body, including the second JSON escaping layer.
import { TARGET_CONTENT_RESULT_META } from "../../dist/server/toolResultEncoding.js";
import { MAX_MCP_RESULT_BYTES } from "./limits.mjs";
import { measureJson, serializeJson } from "./json-capacity.mjs";
import { serializationFailure } from "./fact-provenance.mjs";

const envelope = (text) => ({
  content: [{ type: "text", text }],
  _meta: TARGET_CONTENT_RESULT_META,
});
const attempt = (value) => {
  const encoded = serializeJson(value, MAX_MCP_RESULT_BYTES);
  if (!encoded.ok) return encoded;
  const reply = envelope(encoded.text),
    measured = measureJson(reply, MAX_MCP_RESULT_BYTES);
  return measured.ok ? { ok: true, reply } : measured;
};

export const encodeMcpResult = (value) => {
  const encoded = attempt(value);
  if (encoded.ok) return { result: value, reply: encoded.reply };
  const result = serializationFailure(
      value,
      encoded.error,
      "mcp_reply",
      "result_budget",
    ),
    fallback = attempt(result);
  if (!fallback.ok)
    throw new Error("MCP capacity diagnostic could not be encoded");
  return { result, reply: fallback.reply };
};
