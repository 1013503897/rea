// One bounded decoded source view; the source owner revalidates bytes per read.
import { createHash } from "node:crypto";
import { readNativeGraphEvidence } from "./native-ir-contract.mjs";

export class NativeEvidenceReads {
  #graph;
  constructor(readSource) {
    this.readSource = readSource;
  }
  clear() {
    this.#graph = undefined;
  }
  async read(input) {
    const { text: original, source } = await this.readSource(input.evidence_id);
    let text = original,
      view;
    if (input.component === "recovered_ir") {
      const key = `${input.evidence_id}:${source.sha256}`;
      if (this.#graph?.key !== key) {
        const decoded = readNativeGraphEvidence(text);
        this.#graph = {
          key,
          ...decoded,
          sha256: createHash("sha256").update(decoded.text).digest("hex"),
          bytes: Buffer.byteLength(decoded.text),
        };
      }
      const decoded = this.#graph;
      text = decoded.text;
      view = {
        component: "recovered_ir",
        encoding: decoded.encoding,
        sha256: decoded.sha256,
        bytes: decoded.bytes,
        authority:
          "uninterpreted retained graph source; fact validity is separate",
      };
    }
    const offset = input.offset ?? 0,
      limit = input.limit ?? 4096;
    return {
      source,
      ...(view ? { view } : {}),
      text: text.slice(offset, offset + limit),
      total_code_units: text.length,
      next_offset: offset + limit < text.length ? offset + limit : null,
    };
  }
}
