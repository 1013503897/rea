/**
 * Experimental adapter. Types borrow the canonical contract rather than
 * describing a second result format. The host authenticates and retains reads.
 * @typedef {Extract<import('../../src/domain/analysisView/analysisView.js').AnalysisViewResult, {kind: 'javascript'}>} ModulePage
 * @typedef {import('zod').input<typeof import('../../src/domain/analysisView/javascriptModuleReferences.js').javascriptModuleReferencesRequestSchema>} ModuleView
 * @typedef {Omit<ModuleView, 'kind' | 'collection' | 'projection'>} ModuleOptions
 * @typedef {{evidence_id: string, page: ModulePage}} QueryEvidence
 * @typedef {{kind: 'tool-error' | 'unexpected-result', details: unknown}} QueryError
 * @typedef {import('../../src/domain/result.js').Result<QueryEvidence, QueryError>} QueryResult
 * @typedef {{error?: unknown, evidence_id?: string, normalized_result?: ModulePage}} QueryResponse
 */

/**
 * Pure factory also installed in the isolated guest. Ordinary awaits and
 * iterators compose reads; no source parser, task oracle or new authority.
 * @param {(name: string, args: unknown) => Promise<QueryResponse>} call
 */
export function createJavaScriptClient(call) {
  return {
    /** @param {string} evidenceId */
    fromEvidence(evidenceId) {
      /** @param {ModuleOptions} [options]
       *  @returns {Promise<QueryResult>} */
      async function references(options = {}) {
        const response = await call("inspect_analysis_view", {
          source: { kind: "retained-evidence", evidence_id: evidenceId },
          view: {
            ...options,
            kind: "javascript",
            collection: "modules",
            projection: "references",
          },
        });
        if (response.error)
          return {
            ok: false,
            error: { kind: "tool-error", details: response.error },
          };
        const page = response.normalized_result;
        if (
          page?.kind !== "javascript" ||
          page.parent_evidence_id !== evidenceId ||
          typeof response.evidence_id !== "string"
        )
          return {
            ok: false,
            error: { kind: "unexpected-result", details: response },
          };
        return { ok: true, value: { evidence_id: response.evidence_id, page } };
      }
      return {
        modules: {
          references,
          /** @param {ModuleOptions} [options]
           *  @returns {AsyncGenerator<QueryResult, void, void>} */
          async *pages(options = {}) {
            let offset = options.offset ?? 0;
            while (true) {
              const result = await references({ ...options, offset });
              yield result;
              if (!result.ok) return;
              const next = result.value.page.coverage.next_offset;
              if (next === null) return;
              if (next <= offset)
                throw new Error(
                  "Non-advancing module page; no further reads issued",
                );
              offset = next;
            }
          },
        },
      };
    },
  };
}
