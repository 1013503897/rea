# Verification after upstream integration

Integrated upstream 8fc2043eb8bcedbf34dce064f977e455438635d6, preserving its
new signal-recording guide and current translations.

- Documentation facts and README consistency checks passed.
- Production VitePress build passed.
- Independent built-HTML verification passed for 56 stable public routes,
  56 physical source-edit links and 506 distinct internal file/anchor targets.
- The new regression caught a doubled catalog base path and a missing historical
  managed/native fragment. Both were corrected without weakening assertions.
- All six static tasks and architecture guards passed.
- 61 relevant catalog, release, documentation, signal-MCP and target-framing
  regression tests passed across six files.

The renderer treats physical docs/public references as site-root assets.
The managed guide retains its original heading and an explicit historical fragment
alias. External HTTP targets were not fetched; this verification concerns actual
local production HTML and source files.
