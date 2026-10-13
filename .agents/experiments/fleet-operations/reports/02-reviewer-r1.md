# Increment 02 — independent reviewer r1

## Verdict

**Changes requested: R2-R1-01, R2-R1-02 and R2-R1-03.** Fresh full review of the current increment, including untracked files. No additional actionable engine, chronology, arithmetic, saved-intent, persistence or concurrency defect was established. Passing checks do not waive the findings.

## Identity and authority

Reviewed only `C:/Users/Guillaume/.codex/worktrees/fleet-operations-sol/text-based-browser-game-1`. Initial/final elevated Git inspection confirmed branch `codex/fleet-operations-sol`, HEAD/base `e4c0710d46bb54e12946e568a7406fecf7c5ae30`. Enumerated `git status --short` and `git ls-files --others --exclude-standard`, inspected the entire uncommitted tracked/new production, test, support and documentation increment. Root-owned ledger/other worker reports were identified but deliberately not read as correctness evidence.

Authority: requirements.md, approved packet02 v1 2026-10-10 (all M2-01..09, A2-01..07, P2-01..06), retained increment01 A1-01..18. Colonize/final integration remain later mandatory work. No placeholder, history subsystem or extra endpoint is required now.

Read reviewer persona; root/shared/backend/frontend/Playwright/docs AGENTS; TypeScript coding standards/glossary; installed tools-ts README; actual ADR index and accepted007/008/010/011/013/015/016/017/018/020/022–031; turn-resolution/processing guides; GDDR009/index; Systems001/003/008/010/011/012/014/015/index. Requirements supersede old System008 colonization design. Loaded storybook-agent-workflow plus installed stories/write-story guidance for component inspection.

## Full scope and conclusions

- Shared domain/content: Assault schema/stub/union, ActionDefinition composition, pending indexed effects, safe whole FleetStrength, FleetMovement/Fleet schemas, ActionResolutionOrigin, ResolvedAction/schema/stub and Test content. Roles compose through validated mappings; repeated Assault indexes remain separate. Standard/Test are independently authored with approved values. No runtime ID/name/tier/tag branch or speculative Colonize abstraction found.
- Resolution: entire final TurnContext, ArrivalIntent, ResolutionFleet, Effect/Factory/Pool, FleetMoveEffect, movement phase/preflight, combat phase, AssaultEffect and resolveTurn; surrounding shared evaluator/validation, availability, Build/simple resolver and fixed phases. Saved integrity precedes payment. Canonical departures advance once using saved speed/progress. Positive tiny tick1, true-zero tick0, full/floating-final tick20 and fractional ties match the approved calculations. Chronological landing retains earliest child or preexisting station; actual bindings redirect while original turn/selections/tick remain immutable.
- Combat/outcomes: all Movement and Build precede Combat. Whole tied ticks across destinations shuffle once from canonical keys, retaining later-dead candidates. Only stationed opponents defend. Snapshot loss/apportionment uses BigInt aggregate/product/remainder calculations and stable fleet-ID ties; D0 has no allocations/division. Recorded destruction yields Prevented without rebound/payment replay. Semantic groups coalesce reconstructed orders and separate later reuse. Worker history remains absent as approved.
- Backend: every new combat integration/concurrency file, scenario/save-fault support and tracked server/router-content test change; Standard Attack data; actual updateActionSubmission/getPlayerView/createTurnState evaluator calls; GameplayRepository load/Turn-lock/update and TurnProcessor/TurnsRepository load/save/delete/null/availability paths. Existing JSONB round-trips pending intent without a SQL migration. Delete precedes positive upsert, arrival clears all transit columns to null, and real save/next-turn inserts are awaited in one transaction. Scenarios use normal clients/actions/production processing. SaveTransactionFailure instruments real transaction transport, not synthetic state setup.
- Frontend: all changed/new ActionCard stories/stubs/rules text, combat Playwright spec/FleetsPage addition, actual ActionCard/TargetPicker/projection/SearchSelect. Allocation/edit/cancellation/occupancy decisions delegate to the same evaluator. Browser setup uses observed home roles, ordinary funding/builds, literal distances/strengths/resources. R2-R1-01 exposes a preserved component defect under the binding retained composition/UI criteria.
- Tests/docs: entire fleetOperations suite/scenario builders/pool tests, tracked boundary/continuation test changes, backend public suites, component stories and browser scenario; entire changed architecture/System/glossary/index prose. Literal tiny/fractional/large integer, merge/current survivor, dead effect, deferred JSON reload and tied/alternate seed oracles are useful. No additional harmful duplication or unnecessary workflow abstraction established. Status/history prose respects current scope, but two changed Markdown tables regress.

## Executed verification and limits

Exact workdirs, pnpm only, reviewed require_escalated for external-worktree runtime/Git/report operations; no environment-value edits.

| Command                                                                                                                                                                                     | Actual result                                                                                                                                                                                   |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm --filter shared test`                                                                                                                                                                 | Exit0;24 files/210 tests;0.931s Vitest duration.                                                                                                                                                |
| `pnpm --filter backend test --project integration src/api/gameplay/combat.integration.test.ts`                                                                                              | Exit0;1 file/7 tests;65.44s. Public router/PGLite behavior. Owned session43402 completed.                                                                                                       |
| `pnpm --filter backend test --project concurrency src/api/gameplay/combat.concurrency.test.ts`                                                                                              | Exit0;1 file/5 tests;27.73s. Real PostgreSQL reload/null/deletion, departure/arrival save rollback/retry, Attack/Move reservation and edit/closure/arrival races. Owned session60427 completed. |
| `git diff --check`                                                                                                                                                                          | Exit0 before report and after final report formatting.                                                                                                                                          |
| Storybook `skills stories`, `skills write-story`, `tools docs list --help`, `tools docs list --withStoryIds true`, `tools docs show --help`, `tools docs show --id application-action-card` | All exit0; actual discovered IDs/docs; no UI edits or Storybook server.                                                                                                                         |
| Actual ActionCard SSR reproduction below                                                                                                                                                    | Exit0; owned Vite middleware closed. Only target-map reversal changes initial destination availability.                                                                                         |
| `pnpm exec oxfmt --write .agents/experiments/fleet-operations/reports/02-reviewer-r1.md`                                                                                                    | Exit0; report only.                                                                                                                                                                             |

The first sandbox Git status failed outside its writable root; elevated retry succeeded. Exploratory reads initially used wrong use-case/simple-resolver paths, then corrected actual files were read. The concurrency runner emitted a pg concurrent-query deprecation warning but passed. First report-write attempt had a PowerShell nested here-string parser error before execution; corrected the delimiter and wrote this report only.

I did not independently rerun builds/typechecks, full backend suites, Storybook browser tests or Playwright E2E. Browser spec inspection is not browser execution. SSR establishes actual initial rendered disabled/placeholder behavior, not a live browser interaction receipt. Broader delivery gates remain required; fixes require fresh review.

## Findings

### R2-R1-01 — target declaration order hides valid destinations (medium)

**Location:** `apps/frontend/src/features/play/components/ActionCard.tsx:85–96`, especially autofill95 (retained component).

**Trigger:** valid Move+Assault data declares ranged destination before fleet source, one owned stationary fleet exists, and available instance has no saved selection. Reverse only AttackMoveStandard.targets entries in createAttackActionCardScenario; preserve mappings/constraints/IDs/costs/state.

**Consequence:** initial Planet combobox is disabled with `No planet targets available`, while Fleet is singleton-disabled and visibly selected. The equivalent source-first definition enables Planet. Destination options are computed before singleton autofill mutates this render's local selectedTargets; autofill is not persisted or followed by recomputation. Unrelated rerender repeats the false empty state. Entering Strength can persist the source and recover, so this is false initial unavailability/undocumented interaction order, not permanent impossibility. The existing planet-then-strength user flow fails on valid reordered content.

**Contract:** requirements hard2/3/data composition, A2-06/P2-05, retained A1-06/09/17. Target record iteration order is not a declared prerequisite. Displayed source and evaluated dependent choices must share actual state.

**Correction:** settle independent source autofill before evaluating dependent options, regardless of declaration order; keep decisions shared. Add an isolated destination-first Attack regression for enabled legal destinations and normal planet-then-strength submission.

**Exact executed reproduction:** from assigned worktree `apps/frontend`, this PowerShell pipeline (equivalent here-string delimiter spelling; executed run used single-quoted delimiter):

```powershell
@"
import { createServer } from 'vite';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
const server = await createServer({ configFile: false, resolve: { tsconfigPaths: true }, server: { middlewareMode: true }, appType: 'custom' });
try {
 const { ActionCard } = await server.ssrLoadModule('/src/features/play/components/ActionCard.tsx');
 const { createAttackActionCardScenario } = await server.ssrLoadModule('/src/features/play/components/ActionCard.stub.ts');
 const fixture = createAttackActionCardScenario();
 const attack = fixture.view.actions.find(action => action.id === 'ATTACK_MOVE_STANDARD_1');
 for (const reversed of [false, true]) {
  const definition = { ...fixture.definition, targets: Object.fromEntries(reversed ? Object.entries(fixture.definition.targets).reverse() : Object.entries(fixture.definition.targets)) };
  const view = { ...fixture.view, ruleset: { ...fixture.view.ruleset, actionDefinitions: { ...fixture.view.ruleset.actionDefinitions, [definition.id]: definition } } };
  const html = renderToStaticMarkup(React.createElement(ActionCard, { actionDefinition: definition, action: attack, playerView: view, players: fixture.players, resources: view.resources, canAfford: true, isSelected: false, disabled: false, onSelect() {} }));
  console.log(JSON.stringify({reversed, inputs: html.match(/<input[^>]+>/g)}));
 }
} finally { await server.close(); }
"@ | pnpm exec node --input-type=module
```

Receipt: reversed:false Planet input had `placeholder="Choose planet" value=""` without disabled; reversed:true had `placeholder="No planet targets available" disabled="" value=""`. Both had Fleet `disabled="" value="Fleet source (50 strength)"` and empty Strength min1/max30. No source/test file changed.

### R2-R1-02 — new helper extracts nested API contracts locally (low)

**Location:** `apps/frontend/src/features/play/components/ActionCard.stories.tsx:20`.

New stockpile signature uses `keyof PlayerView["resources"]` and `PlayerView["resources"][typeof type]`. Frontend AGENTS/accepted ADR022 require nested contract aliases in `apps/backend/src/api/types.ts`, imported by name. Adding frontend shape extraction defeats the single contract catalogue and spreads contract-maintenance knowledge.

Use existing exported ResourceType for the key and add/reuse a named resource-amount return contract derived in api/types.ts. Bound the correction to this new code; no broad existing cleanup. Established by source/explicit accepted rule, not a failing typecheck.

### R2-R1-03 — Markdown changes detach table rows (low)

**Locations:** `docs/game-design/systems/012-movement.md:35–49` and `docs/game-design/systems/README.md:18–19`.

Movement Core Concepts now separates header/separator/every row with blank lines. GFM requires contiguous table rows; this renders pipe text paragraphs rather than the former table. The new011-combat index row is isolated after a blank line, outside Partially Implemented's table. Exact base diff establishes both introduced regressions.

Restore contiguous movement table rows and insert011 within the existing index table. Preserve approved mechanic/status prose. This is readable synchronized System/index upkeep, not a new design decision.

## Stopped handoff

Only this assigned report was authored. No production/test/support/doc edits, ledger/dispositions, commit/push/PR, reset/reseed, main-checkout work, environment edits or subagents. Owned sessions43402/60427 reached exit0 and Vite middleware closed. Final ports showed preserved DB10135 only;10136/10137/10138 absent. Docker confirmed `cosmic-empires-worktree-45-db-1` remains on10135. No owned app/test processes remain. **ALL WRITING AND OWNED PROCESSES STOPPED** after report formatting/check.
