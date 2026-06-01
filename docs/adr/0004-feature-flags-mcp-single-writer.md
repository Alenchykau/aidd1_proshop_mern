# 4. Feature-flags MCP is the only writer for `backend/features.json`

- Status: **Proposed**
- Date: 2026-06-01 (drafted during M6 Stage 1 architecture review; ARCH-001)
- Confidence: HIGH (two writer code paths observed in code)

## Context

`backend/features.json` is the source of truth for runtime feature flags. CLAUDE.md states the file MUST only be mutated through the feature-flags MCP, which validates dependencies, enforces the disabled-traffic lock, and stamps `last_modified`. The current implementation has **two writers**:

- `mcp-feature-flags/server.ts` — writes via `set_feature_state` / `adjust_traffic_rollout` (the sanctioned path; holds the dependency-gate + disabled-traffic-lock invariants).
- `backend/utils/featureFile.js` — called from `featureController.updateFeature` (admin dashboard `PUT`), writes the file directly with `fs` and re-implements only a subset of the MCP validation.

Two unsynchronized writers race on the same file (PERF-006) and the duplicated validation will drift (ARCH-001 / ARCH-013).

## Decision

The feature-flags MCP becomes the **only** process that writes `backend/features.json`. The Express backend's admin `PUT` endpoint becomes an MCP client (calls the MCP HTTP transport: `set_feature_state` / `adjust_traffic_rollout`) instead of `fs.writeFile`. `backend/utils/featureFile.js` keeps only a read-only cached loader for runtime gating. A startup assertion verifies the MCP is reachable.

## Consequences

**Positive:** single writer → no cross-process race, no validation drift, one audit point; caching becomes trivial (PERF-005).
**Negative:** backend now depends on the MCP HTTP transport in production; needs a deployment story under Heroku (sidecar or separate dyno). Couples it to SEC-015 (the HTTP transport must be authenticated first).

## Alternatives considered

- Advisory file locks across processes — fragile across OSes.
- Move flags to MongoDB — larger refactor; revisit if flag volume grows.
