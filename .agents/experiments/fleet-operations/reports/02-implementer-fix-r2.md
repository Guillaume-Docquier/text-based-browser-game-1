# Increment 02 implementer correction r2

Date: 2026-10-10. Findings: R2-R1-01, R2-R1-02, R2-R1-03. Bounded correction evidence; independent acceptance/review remains root-owned.

Exact worktree `C:/Users/Guillaume/.codex/worktrees/fleet-operations-sol/text-based-browser-game-1`; branch `codex/fleet-operations-sol`; HEAD/base unchanged `e4c0710d46bb54e12946e568a7406fecf7c5ae30`. Packet02 v1, requirements and retained A1 remain binding. No ledger, earlier report, packet, environment, main checkout, gameplay runtime, persistence/schema or seed changes.

## Finding dispositions and changed paths

- R2-R1-01: `apps/frontend/src/features/play/components/ActionCard.tsx` settles independent singleton target selections before computing all visible target options. Shared `getTargetOptions` / target evaluator remains authoritative. Rendering preserves declaration order; autofill does not depend on that order. Existing selected values are not overwritten. No dependency framework, effect, identity/name branch or new shared gameplay rule. Draft source changes, dependent clearing, editing exclusion, resource/strength totals and journey locks retain existing paths.
- R2-R1-01 regression: `apps/frontend/src/features/play/components/ActionCard.stories.tsx` adds DestinationFirstAttack. It reverses only target declarations with `toReversed`, parses the definition through ActionDefinitionSchema, then uses the existing controlled harness. It asserts visible source50, initially enabled Planet, exactly two legal options Boundary/Other, planet selection before strength30, exact saved sibling20 + Attack30 and exact retained Boundary label. Existing renamed craft/route/force stories remain intact and pass.
- R2-R1-02: `apps/backend/src/api/types.ts` exports `ResourceStockpile = PlayerView["resources"][ResourceType]`, derived in the API contract catalogue. The new frontend stockpile helper imports named ResourceType/ResourceStockpile through import type; no local nested API extraction remains in that helper. Bound correction, no cleanup of unrelated older signatures.
- R2-R1-03: `docs/game-design/systems/012-movement.md` restores contiguous Core Concepts table lines; `docs/game-design/systems/README.md` puts011-combat inside the existing Partially Implemented table. Approved status/mechanics prose preserved; no new design records.

O2-S1 preflight correction and all independent tester additions (rollback/alternate seed/transit) preserved. These UI corrections support A2-06/P2-05 and retained A1-06/09/17 data composition and shared eligibility. No acceptance criterion narrowed; Colonization4/final integration5 remain later mandatory work.

## Failing-before evidence

Added the isolated browser regression before production edits. From apps/frontend:

`pnpm exec storybook tools test run --stories '[{"absoluteStoryPath":"C:/Users/Guillaume/.codex/worktrees/fleet-operations-sol/text-based-browser-game-1/apps/frontend/src/features/play/components/ActionCard.stories.tsx","exportName":"DestinationFirstAttack"}]'`

Actual exit1, one failed/nine skipped. Initial Planet input was disabled, placeholder No planet targets available, while Fleet source50 was displayed. Failure screenshot captured by Storybook. This proves the real Chromium regression rather than relying on SSR alone.

After production correction, the entire planet-then-strength saved-order sequence succeeded; its final added assertion initially used unsupported regex semantics with toHaveValue, reporting received Boundary (0:0:0). Replaced it with the stronger exact literal `Boundary (0:0:0)`. This did not weaken the original failing enabled/choices/submission assertions. Focused tool rerun exited0, one passed/nine skipped. Initial lint caught reverse() in new test fixture; replaced with toReversed(), then reran final full component/native, all static, and Storybook build gates.

## Executed gates and actual exits

All commands use pnpm, exact workdirs and require_escalated user-authorized isolated-worktree justification. No early test count was treated as runner completion.

| Exact command                                                                                                                                                                                                                                                   | Actual exit / result                                                                                   |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `pnpm exec oxfmt --write apps/frontend/src/features/play/components/ActionCard.tsx apps/frontend/src/features/play/components/ActionCard.stories.tsx apps/backend/src/api/types.ts docs/game-design/systems/012-movement.md docs/game-design/systems/README.md` | 0; all bounded edits formatted                                                                         |
| `pnpm exec oxfmt --write apps/frontend/src/features/play/components/ActionCard.stories.tsx`                                                                                                                                                                     | 0 after exact literal and immutable reversal updates                                                   |
| `pnpm exec storybook tools test run --stories '[{"storyId":"application-action-card--destination-first-attack"}]'`                                                                                                                                              | 0; one passed/nine skipped after exact literal repair                                                  |
| `pnpm --filter frontend storybook:test`                                                                                                                                                                                                                         | Final0;66 tests/16 files, including native15 and all10 ActionCard stories;6.39s                        |
| `pnpm exec storybook tools test run`                                                                                                                                                                                                                            | Final0; all51 story plays passed; native suite separately accounted above                              |
| `pnpm typecheck`                                                                                                                                                                                                                                                | 0; root                                                                                                |
| `pnpm --filter frontend typecheck`                                                                                                                                                                                                                              | 0                                                                                                      |
| `pnpm --filter backend typecheck`                                                                                                                                                                                                                               | 0                                                                                                      |
| `pnpm --filter shared typecheck`                                                                                                                                                                                                                                | 0                                                                                                      |
| `pnpm lint`                                                                                                                                                                                                                                                     | Final0;zero warnings; initial new-test reverse() lint failure corrected                                |
| `git diff --check`                                                                                                                                                                                                                                              | 0                                                                                                      |
| `pnpm --filter frontend build`                                                                                                                                                                                                                                  | 0;production component and API inputs final;later test-only toReversed change does not enter app build |
| `pnpm --filter frontend storybook:build`                                                                                                                                                                                                                        | Final0 after test-only input change; exact reviewed one-command prefix used                            |
| `pnpm --filter frontend e2e --add-reporter=list`                                                                                                                                                                                                                | 0;full21 tests including3 setup;1.4m;actual runner cleanup completed                                   |

E2E executed in tty with only skill-prescribed runner-local PLAYWRIGHT_HTML_OPEN=never and PLAYWRIGHT_LIST_PRINT_STEPS=1. No persistent environment values changed. Playwright owned backend10136/frontend10137 startup and cleanup. Current HTML report: apps/frontend/playwright-report/index.html.

Maintained workflows: loaded storybook skills stories/write-story; docs list/show + discovered story IDs; stories changed; find-by-component on actual ActionCard path; focused tests; full tool tests; review create on owned10138. Help read before first tool use. Discovery exposed all10 ActionCard stories, with backend type-only alias checked statically rather than treated as a visual runtime dependency.

Non-blocking tool warnings: module.register deprecation, Vitest init deprecation, Vite mock interceptor hooks; Storybook bundle module-level use-client directives. E2E showed existing Clerk development-key/color notices and expected rejected shortfall submission server logs; full runner exited0.

## Browser-visible verification and review

Owned Chrome tab opened the discovered destination-first story on10138. Inspected live accessibility and screenshot: destination is above source, Boundary selected, singleton Fleet source50, Strength30/available30, Selected and literal saved sibling20/Attack30. Opened live Planet combobox and observed exactly Boundary (0:0:0) and Other (0:0:0). Closed the owned tab.

Published maintained local review with two groups/five discovered stories, including the new destination-first story and original allocation/source-change/invalid-saved/occupied controls. Returned URL: http://localhost:10138/?path=/review/ . Per mandatory stopped handoff, preview server was then stopped; URL requires restarting this checkout's Storybook10138. Review creation itself exited0.

## Changed-input accounting and limits

Common ActionCard runtime changed, so current full Chromium component/native and full E21 were rerun, along with production and Storybook builds and all package/root static checks. Only backend change is a type-only API alias; no unchanged backend gameplay unit/integration/PG runtime rerun was needed or claimed. Earlier shared210/public backend+PG/full browser receipts remain historical rather than acceptance of this changed UI. Fresh independent tester/full reviewer will assess packet-wide candidate acceptance.

No blocker or design deviation established. The corrections do not add a speculative dependency workflow, history, Surprise Assault, conquest or Colonize implementation.

## Stopped ownership handoff

Storybook command `pnpm storybook --no-open --port 10138 --exact-port` started own session99397/PID6240. Verified its exact Fleet checkout dispatcher command line before Stop-Process. Stop command marker R2_OWNED_STORYBOOK_STOPPED exited0. Dev runner reached actual exit1 as intentional shutdown, not a failed gate. Attached full-story subprocess19188 and PID6240 were absent after cleanup. Playwright session28144 reached actual exit0 and app listeners disappeared. Final inspection found only preserved DB10135 PIDs25828/18476, no10136/10137/10138. No unrelated process stopped, no container reset/reseed or environment edit, no commits/push/PR/subagents.

ALL WRITING/PROCESSES STOPPED after report formatting and final read-only verification. Remain available for routed findings.
