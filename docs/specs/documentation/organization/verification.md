# Verification after upstream integration

Integrated upstream 82cfcee19f18b0eeae9a330ba04e0411cdf85225, preserving its
new signal-recording guide, managed summary documentation and current translations.

- Documentation facts and README consistency checks passed.
- Production VitePress build passed.
- Independent built-HTML verification passed for 56 stable public routes,
  56 physical source-edit links and 507 distinct internal file/anchor targets.
- The new regression caught a doubled catalog base path and a missing historical
  managed/native fragment. Both were corrected without weakening assertions.
- All six static tasks and architecture guards passed.
- 167 relevant catalog, release, documentation, signal-MCP, target-framing,
  managed-summary, Worker-URL CLI and CI-planner regression tests passed across
  ten files. CLI runs need process-table access for actual ownership/cleanup
  verification; restricted execution failed with spawn EPERM, while the normal
  host run passed without changing timeouts or assertions.
- Documentation CI and the manual build require the built-page verifier.
  An actual CI-planner regression ensures edits to the verifier select that lane.

The renderer treats physical docs/public references as site-root assets.
The managed guide retains its original heading and an explicit historical fragment
alias. External HTTP targets were not fetched; this verification concerns actual
local production HTML and source files.
