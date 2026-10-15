import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
import { z } from "zod";

/** Narrow discovery generated from named canonical schemas, with full discovery
 * still accessible. This is an experiment, not an additional server contract. */
export async function moduleReferenceDiscovery(runtime) {
  const load = (path) =>
    import(pathToFileURL(resolve(runtime, "dist", path)).href);
  const [views, modules] = await Promise.all([
    load("domain/analysisView/analysisView.js"),
    load("domain/analysisView/javascriptModuleReferences.js"),
  ]);
  return {
    name: "inspect_analysis_view",
    description:
      "Read typed retained JavaScript module references. Exact filters select all matching identities, including ambiguous paths. Rows carry canonical identity and retained source-range counts with observation support. Page exhaustion concerns retained matches; source coverage is separate. Complete discovery: inspect_analysis_view.complete.",
    inputSchema: z.toJSONSchema(
      z.strictObject({
        source: views.retainedAnalysisViewSourceSchema,
        view: modules.javascriptModuleReferencesRequestSchema,
      }),
    ),
    pageSchema: z.toJSONSchema(
      views.javascriptModuleReferencesViewResultSchema,
    ),
    response:
      "The ordinary canonical Evidence envelope: evidence_id, normalized_result (pageSchema), evidence_links, authority, confidence and limitations. Queries create retained view Evidence, linked to the parent. Errors preserve the ordinary tool error envelope.",
    code: "const app = rea.javascript.fromEvidence(parentEvidenceId); await app.modules.references({where:{path,kind},offset:0,limit:64}) returns Result<{evidence_id,page},{kind,details}>. for await (const result of app.modules.pages(options)) iterates the same query. Narrow result and option types come from the canonical schemas; client.mjs also borrows canonical TypeScript types. Use await rea.call(name,args) for any original tool. Cells are async functions; print(value) returns selected facts. Complete Evidence remains retained; arbitrary printed conclusions are derivations, not new source Evidence.",
  };
}
