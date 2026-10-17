// One bounded decoded source view; the source owner revalidates bytes per read.
import { createHash } from "node:crypto";
import { readNativeGraphEvidence } from "./native-ir-contract.mjs";

export class NativeEvidenceReads {
  #graph;
  constructor({ readText, readWindow }) {
    Object.assign(this, { readText, readWindow });
  }
  clear() {
    this.#graph = undefined;
  }
  async read(input) {
    if (input.component !== "recovered_ir")
      return this.readWindow(input.evidence_id, {
        offset: input.offset ?? 0,
        limit: input.limit ?? 4096,
      });
    const { text: original, source } = await this.readText(input.evidence_id);
    const key = `${input.evidence_id}:${source.sha256}`;
    if (this.#graph?.key !== key) {
      const decoded = readNativeGraphEvidence(original);
      this.#graph = {
        key,
        ...decoded,
        sha256: createHash("sha256").update(decoded.text).digest("hex"),
        bytes: Buffer.byteLength(decoded.text),
      };
    }
    const decoded = this.#graph,
      text = decoded.text;
    const view = {
      component: "recovered_ir",
      encoding: decoded.encoding,
      sha256: decoded.sha256,
      bytes: decoded.bytes,
      authority:
        "uninterpreted retained graph source; fact validity is separate",
    };
    const offset = input.offset ?? 0,
      limit = input.limit ?? 4096;
    return {
      source,
      view,
      text: text.slice(offset, offset + limit),
      total_code_units: text.length,
      next_offset: offset + limit < text.length ? offset + limit : null,
    };
  }
}
