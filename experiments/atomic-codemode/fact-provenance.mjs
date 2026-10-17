// Transport failures keep the lease and the already retained observation sources.
const dataProperty = (value, key) =>
  value && typeof value === "object"
    ? Object.getOwnPropertyDescriptor(value, key)?.value
    : undefined;

export const evidenceIds = (response) => {
  const ids = new Set();
  const add = (id) => {
    if (typeof id === "string" && id) ids.add(id);
  };
  const error = dataProperty(response, "error"),
    details = dataProperty(error, "details"),
    observation =
      dataProperty(response, "data") ??
      dataProperty(details, "partial_observation"),
    results = dataProperty(observation, "results");
  for (const row of [observation, ...(Array.isArray(results) ? results : [])]) {
    add(dataProperty(dataProperty(row, "source"), "evidence_id"));
    add(dataProperty(row, "evidence_id"));
    add(
      dataProperty(
        dataProperty(dataProperty(row, "error"), "details"),
        "evidence_id",
      ),
    );
  }
  add(dataProperty(details, "evidence_id"));
  for (const values of [
    dataProperty(response, "evidence_ids"),
    dataProperty(details, "evidence_ids"),
  ])
    if (Array.isArray(values)) for (const id of values) add(id);
  return [...ids];
};

export const serializationFailure = (response, failure, scope, code) => {
  const ids = evidenceIds(response),
    primary = response?.ok === false ? response.error?.code : undefined;
  return {
    ok: false,
    context: dataProperty(response, "context") ?? null,
    error: {
      code: primary ?? (failure.kind === "capacity" ? code : "invalid_result"),
      message:
        failure.kind === "capacity"
          ? `Selected response exceeds the ${scope} byte budget. Select fewer fields or a smaller page; use any reported Evidence IDs to inspect retained observations.`
          : `Selected response cannot be JSON encoded: ${failure.reason}`,
      details: {
        scope,
        ...failure,
        evidence_ids: ids,
        evidence_retention: ids.length ? "retained_by_lease" : "unknown",
        ...(primary
          ? { original_message_omitted: true, original_details_omitted: true }
          : {}),
      },
    },
  };
};
