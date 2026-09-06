# Issue #422 — Build Fleets

Issue: [#422](https://github.com/Guillaume-Docquier/text-based-browser-game-1/issues/422)

## Scope

This stack adds stationary fleet construction, planet targeting, fleet turn-state persistence, a Fleets page, and fleet markers in the galaxy.

Deferred to later issues:

- Planet ownership and ownership-restricted building: [#372](https://github.com/Guillaume-Docquier/text-based-browser-game-1/issues/372)
- Fleet movement: [#342](https://github.com/Guillaume-Docquier/text-based-browser-game-1/issues/342)
- Fleet combat and destruction: [#385](https://github.com/Guillaume-Docquier/text-based-browser-game-1/issues/385)

## Stacked PRs

- [x] `00-plan-ledger` — create and maintain this ledger
- [x] `01-fleet-schema` — FleetId, fleets table, constraints, migration
- [x] `02-fleet-mechanic` — FleetBuild mechanic, planet targets, validation
- [x] `03-fleet-resolution` — FleetBuild effect, phase, deterministic IDs, ruleset actions, solo targeting
- [x] `04-fleet-turn-processing` — load and persist planets/fleets during turn processing
- [x] `05-fleet-api` — PlayerView fleets, server-provided target options, backend integration flow
- [x] `06-fleet-action-ui` — targeted action controls and Playwright coverage
- [x] `07-fleets-page` — fleets table and planet deep links
- [x] `08-galaxy-fleet-markers` — galaxy/system markers and documentation updates

Each implementation session should append a dated entry to the session log with the PR, changes, checks, and any follow-up. Keep the stack green with the narrowest relevant checks, then run `pnpm checks` before the final merge.

## Decisions

- Target options are supplied by the server in the PlayerView; the client does not derive legal targets.
- Self targets remain server-owned and are hidden from the UI.
- Fleet IDs are deterministic turn-scoped text IDs: `fleet:<gameId>:<turn>:<sequence>`.
- All planets are valid build targets for this issue. Ownership restrictions are deferred to #372.
- `originPlanetId` is the fleet's current position until movement exists.
- Use existing components and native `<select>` controls; add no UI dependency.

## Acceptance checklist

- [x] FleetBuild rules are validated for positive, non-zero integer strength.
- [x] Unknown and missing planet targets are rejected before resolution.
- [x] Empty-planet creation, friendly merge, and enemy separation resolve correctly.
- [x] Fleets are persisted and visible to every player.
- [x] Standard, Improved, and Exceptional fleet-build actions have the specified costs and strengths.
- [x] Selected action targets remain visible while locked and cannot be changed.
- [x] Fleets page sorts own fleets first and links each origin planet to Galaxy.
- [x] Galaxy and system views display owner-colored fleet markers with strength.
- [x] Existing turn, action, and readiness behavior remains intact.

## Session log

Append entries here; do not replace earlier entries.

### 2026-09-06 — implementation session

- Implemented the complete backend-to-frontend slice in the working tree: schema, rules validation, Fleet Build resolution, turn persistence, API target options, targeted action controls, solo targeting, Fleets page, galaxy markers, docs, and E2E coverage.
- Checks passed: `pnpm --filter backend checks` (130 tests), `pnpm --filter frontend checks` (typecheck, build, Storybook, 10 E2E tests), `pnpm lint`, and `git diff --check`.
- No commits or pull requests were created. The next session can split this working tree into the numbered stacked PRs before merging.

## Deferred work

Do not add movement coordinates, ownership validation, fleet splitting, combat, or zero-strength deletion in this stack.
