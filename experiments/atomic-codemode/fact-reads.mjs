// Shared read projections and partial batch semantics; no provider protocols.
export const sourceSummary = ({ evidence_id, sha256, bytes, elapsed_ms }) => ({
  evidence_id,
  sha256,
  bytes,
  elapsed_ms,
});

export const projectFact = (row, fields, identity) =>
  fields
    ? Object.fromEntries(
        [...new Set([...identity, ...fields])]
          .filter((key) => Object.hasOwn(row, key))
          .map((key) => [key, row[key]]),
      )
    : row;

export const pageFacts = (rows, input, identity = []) => ({
  items: rows
    .slice(input.offset, input.offset + input.limit)
    .map((row) => projectFact(row, input.fields, identity)),
  total: rows.length,
  next_offset:
    input.offset + input.limit < rows.length
      ? input.offset + input.limit
      : null,
});

export async function readFactBatch(requests, capture, read) {
  const results = [];
  for (const request of requests) {
    let source;
    try {
      const captured = await capture(request);
      source = captured.source;
      const facts = await read(captured, request);
      results.push({
        ...facts,
        ok: true,
        address: request.address,
        source: sourceSummary(source),
      });
    } catch (error) {
      results.push({
        ok: false,
        address: request.address,
        error: {
          code: error.code ?? "provider_failure",
          message: error.message,
          details: {
            ...error.details,
            ...(source ? { evidence_id: source.evidence_id } : {}),
          },
        },
      });
    }
  }
  return { results };
}
