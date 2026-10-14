# Increment 01 Implementer r3: occupied movement presentation

## O-12 disposition

The occupied movement card now presents the bound in-progress journey as a read-only status. It reads the current moving Fleet, its current strength, destination, and remaining distance; it does not derive a fresh draft, auto-select unrelated targets, calculate a new allocation, show affordability or missing-input issues, or offer update/cancel controls. The display contains player-facing names and values, not action or Fleet identifiers. This also works after a full departure removes the historical source Fleet.

The occupied story exercises that full-departure state and separately keeps a free instance of the same movement definition editable: it selects a valid Fleet and destination, enters strength, submits, and observes the resulting selection. The shared evaluator and authoritative API busy checks were left unchanged. The browser lifecycle still verifies the current journey after reload, no-submission continuation, release on arrival, and source-dependent target filtering.

O-12 is addressed at the presentation layer. This adds evidence for the occupied-card portions of I1-11 and I1-17; it does not claim the entire increment accepted. Fresh full tester and reviewer passes remain pending.

## Changed paths

- `apps/frontend/src/features/play/components/ActionCard.tsx`
- `apps/frontend/src/features/play/components/ActionCard.stories.tsx`
- `apps/frontend/playwright/pages/ActionsPage.ts`
- `apps/frontend/playwright/specs/fleets.spec.ts`

## Verification

All commands ran in the assigned worktree on `codex/fleet-operations-experiment` at base `acde251d2fb2164eb7cd881fb55fc5f08e52d817`. No environment configuration, API, shared rules, persistence, or root run-state was changed for O-12.

- Focused ActionCard stories, including occupied journey and editable free-instance behavior:
  `pnpm exec storybook tools test run --input '{"stories":[{"storyId":"application-action-card--exceptional-range-boundary"},{"storyId":"application-action-card--mixed-definition-parity"},{"storyId":"application-action-card--occupied-during-movement"},{"storyId":"application-action-card--partial-movement-allocation"},{"storyId":"application-action-card--prototype-safe-selection"}]}'` — exit 0, 5 stories passed.
- Required combined component/native gate: `pnpm --filter frontend storybook:test` — exit 0, 15 files and 52 tests passed, including `storybook-native`. The separate Storybook tools story-only run reported 46 stories; that count is distinct from the combined 52-test gate.
- `pnpm --filter frontend storybook:build` — exit 0. Existing Vite `use client` directive and large-chunk warnings were emitted; the build completed.
- `pnpm --filter frontend typecheck` — exit 0.
- `pnpm typecheck` — exit 0.
- `pnpm --filter frontend build` — exit 0.
- `pnpm lint` — exit 0 after removing the now-unused `indexBy` test-fixture import.
- `pnpm exec oxfmt --write apps/frontend/src/features/play/components/ActionCard.tsx apps/frontend/src/features/play/components/ActionCard.stories.tsx apps/frontend/playwright/pages/ActionsPage.ts apps/frontend/playwright/specs/fleets.spec.ts` — exit 0; formatted 4 files.
- Focused browser run:
  `$env:PLAYWRIGHT_HTML_OPEN = "never"; $env:PLAYWRIGHT_LIST_PRINT_STEPS = "1"; pnpm --filter frontend e2e --add-reporter=list playwright/specs/fleets.spec.ts` — exit 0, 5 passed. The lifecycle test reloaded the occupied journey, continued it without a new submission, then verified release and source-change filtering. Playwright's web-server and worker processes were confirmed exited after the runner returned. Routine output included Clerk development-key, `NO_COLOR`/ `FORCE_COLOR`, and pg query deprecation warnings.
- `git diff --check` — exit 0.

## Test-flow corrections

The first focused story attempts exposed harness issues rather than a product-state failure: Storybook returned an array rather than a Locator for `getAllByRole`; the configured matcher did not support `toHaveText`; an absent combobox was queried with throwing `getByRole`; and the free-card dependent picker was checked before selecting its source Fleet. The story now scopes the returned DOM elements with `within`, uses the repository's supported text/value matchers and non-throwing absence query, and checks the picker after the source selection. The final focused story run and combined gate passed. An initial lint run also caught the unused `indexBy` import; it was removed and lint passed.

## Remaining disposition

No known O-12 defect remains in the current implementation based on the focused story, combined Storybook/native gate, and fleet browser flow. The independent full I1 acceptance review is still required; this report does not waive any I1-01 through I1-17 criterion or earlier implementation evidence gap.
