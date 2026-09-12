# Repository Rules

## Testing

- Test observable behavior and real regressions only. A bug fix normally needs one focused test; use a second only for a distinct boundary.
- Do not add source-text tests, change detectors, fixed-count snapshots, duplicate test matrices, unreachable-state tests, or speculative “defense in depth” cases.
- Do not duplicate coverage already enforced by types, schemas, the build, or a lower-level test.
- Keep validation at trust and security boundaries. This policy removes redundant tests, not required input or security checks.
- Patched-sync workflows run only the focused patch tests and build or publish artifacts only when relevant runtime files changed.
