# Increment 02 reviewer r2

## Verdict

**One actionable documentation finding: R2-DOC-01 (P3). No actionable production, test, architecture, duplication, or abstraction defect established.** This verdict applies to the entire current increment product diff, including untracked files, from accepted increment-1 base `e4c0710d46bb54e12946e568a7406fecf7c5ae30`. Root owns disposition and acceptance; the documentation finding remains open in this report.

Checkout: `C:/Users/Guillaume/.codex/worktrees/fleet-operations-sol/text-based-browser-game-1`, branch `codex/fleet-operations-sol`. Reviewer: fresh Fleet Operations Reviewer, gpt-6.1-sol/high. Review completed 2026-10-10.

## Actionable finding

### R2-DOC-01 — synchronize System 003's current implementation account (P3)

Locations: `docs/game-design/systems/003-actions.md:65`, `:87`, and newly added `:223`.

Trigger: a reader consults Current Implementation after this increment ships. Line 65 enumerates the live Standard pool and its target controls but omits the new normal Attack Move directive. Line 87 still refers to “remaining chronological arrival work,” although chronological arrivals are implemented in `resolveFleetMovementPhase.ts` and documented as implemented in System 012. The newly added Current Attack Move content subsection follows Potential Flaws, so its accurate live-content description is separated from the current implementation account and nested under an unrelated section.

Consequence: the primary Action System gives inconsistent status and an incomplete current catalogue, despite the increment implementing the omitted behavior. This is a factual documentation synchronization issue, not a request for broader document restructuring.

Authority: root documentation instruction to keep existing Systems and their implementation status synchronized with live behavior; `docs/AGENTS.md` Game Systems rule; approved increment-02 scope requiring honest affected existing documentation.

Bounded fix: add normal Attack Move to the current pool/target summary, replace the remaining-chronology wording with a reference to the live movement chronology and binding rules, and move the existing Current Attack Move content subsection under Current Implementation. Preserve its concrete Standard/Test values and planned catalogue distinctions. No new System/GDDR/ADR or gameplay change is needed.

## Scope and primary evidence

Read the reviewer persona, authoritative requirements, approved increment-02 v1 packet and retained increment-01 v1 packet. All M2-01..09, A2-01..07, P2-01..06 and retained A1-01..18 remained binding. No earlier implementer/tester/reviewer/orchestrator confidence report or run-state content was read as correctness evidence. Root bookkeeping/report paths were excluded from product correctness inspection under the fresh-review instruction.

Inspected all 39 tracked product paths changed from the base and all 17 untracked product paths: shared domain schemas, pending Assault and action origin types, complete movement/combat/pool/effect/turn implementation, Standard/Test content, backend contracts and harness changes, frontend ActionCard production/stories/stubs/rules text, browser page-object/spec changes, every changed existing System/architecture/glossary/index document, and all added/changed tests and scenario fixtures. Inspected relevant unchanged surrounds, especially actual eligibility projections and consumers, phase ordering, availability, API locks/views, worker processing, and real repository load/save mappings.

Read root and scoped shared/backend/frontend/Playwright/docs AGENTS, coding standards/glossary, installed tools-ts README, ADR index and accepted 007/008/010/011/013/015/016/017/018/020/022–031, turn-resolution/processing guides, GDDR009/index and Systems001/003/008/010/011/012/014/015/index. Applied storybook-agent-workflow and read installed stories/write-story guidance; discovered component/story IDs and ActionCard docs. No component or test was edited.

## Independent conclusions

- Saved fleet/domain integrity runs before eligibility and payment. Missing/malformed pending Attack data, invalid indexed composition, mismatched roles/ownership, absent route/player, impossible progress and forged child bindings return typed failure. Legacy absent pending lists survive only when the current definition requires no arrival effect. Continuation does not recheck an exhausted original source or replace saved speed with current content speed.
- Assault is bounded declarative composition with one mapped Move. Departure persists each indexed Assault once; the factory omits immediate Assault creation. Arrival activates it only in Combat. Reversed effect-list order remains meaningful data rather than an action-ID branch. The shared engine imports no app runtime, and Standard/Test content is authored independently. No Colonize placeholder, new endpoint, history subsystem, or speculative workflow framework was added.
- Canonical elapsed-turn progress governs arrival. True zero arrives at tick0, positive underflow is clamped to tick1, full/final rounding cases reach tick20, and 5/2 continuation ends at tick10. Landing processes tick batches before merging; separate intents preserve immutable origin/tick while redirecting actual fleet IDs. Later friendly arrivals and Build complete before Assault and contribute to its current strength.
- Each whole tied tick is canonically ordered by origin/index/departure identity, then shuffled once with injected persisted RNG; singleton groups draw nothing. Destination grouping and earlier destruction do not alter the draw schedule. Canonical landing and combat scheduling are independent of input/database enumeration or the merged survivor ID.
- Combat snapshots attacker and all positive stationed opponents, excludes friends/transit, exchanges once, and preserves exact whole losses through BigInt totals/products/quotients/remainders. Stable fleet-ID ties award remaining units. No-enemy combat succeeds without division; zero fleets are deleted; a later intent on a recorded destroyed actual ID becomes explanatory Prevented and cannot rebound elsewhere.
- EffectPool owns outcome deltas by initiating turn/player/action, detects conflicting same-key submissions, coalesces equal reconstructed objects, and keeps later reuse separate. resolveTurn returns prior origins even without current submissions and does not replay old payment/departure deltas. The backend intentionally discards completed outcomes; documentation states that limit.
- Actual frontend projection, TargetPicker/ActionCard, API complete-set validation and resolver validation delegate to the shared evaluator. Total stockpiles, source origins, selections, cumulative strength/resource commitments, replacement exclusion and occupancy are retained. The ActionCard change settles independent singleton sources before dependent destinations, supporting destination-first target declaration order. Existing invalid local edits and cancellation semantics remain covered.
- Existing Turn-row transactions serialize submissions against each other, readiness and deadline closure. Occupied instance checks precede the missing current-row rejection. Different instances remain independent. Worker availability is computed from final surviving journeys, so completion/destruction releases bindings for the next collecting turn.
- Production repositories round-trip pending data in existing movement JSONB. The successful save is one transaction, deletes merged/destroyed IDs before positive survivor upserts, explicitly writes null movement/destination/distance, and saves final RNG and next availability. No SQL migration is needed. The failure instrument aborts a real production transaction after awaited save statements; it fabricates no scenario state or test repository.
- Test setup uses normal public actions/turn processing for backend and browser scenarios. Shared tests use literal geometry and damage/tick/RNG oracles. New real-PG tests exercise public allocations, persistence and closure/arrival races. Duplication between independent content fixtures is intentional; new origin/pending/intent seams carry real distinct lifecycle responsibilities. No concrete harmful duplication or unnecessary abstraction was established.

Coverage inspected: chronology/provenance M2-01..04/06 and A2-05/07; pending/lifecycle/outcomes/corruption M2-05..09; combat arithmetic/current forces A2-01..07; real persistence/save/races P2-01..04; actual adapters/components/browser P2-05..06 and retained A1-01..18. Scope accounting retains the original increment-2 remainder and original increment-3 normal Assault; Colonization04 and integrated delivery05 remain future required increments.

## Checks actually completed

| Reviewer command                                                                               | Completed result                                             |
| ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| `pnpm --filter shared test`                                                                    | Exit0; 24 files / 210 tests passed                           |
| `pnpm --filter backend test --project integration src/api/gameplay/combat.integration.test.ts` | Exit0; 1 file / 7 tests passed; 64.33s                       |
| `pnpm --filter backend test --project concurrency src/api/gameplay/combat.concurrency.test.ts` | Exit0; real PostgreSQL, 1 file / 5 tests passed; 28.85s      |
| `pnpm --filter frontend storybook:test`                                                        | Exit0; Chromium Storybook/native, 16 files / 66 tests passed |
| `pnpm typecheck`                                                                               | Exit0                                                        |
| `pnpm --filter shared typecheck`                                                               | Exit0                                                        |
| `pnpm --filter backend typecheck`                                                              | Exit0                                                        |
| `pnpm --filter frontend typecheck`                                                             | Exit0                                                        |

Storybook CLI guidance/docs/discovery commands completed. Its affected-story result included ActionCard and FleetsPage; advisory uncovered backend/test paths were inspected through their real source/test boundaries. Generated docs contained unresolved example imports, so actual colocated source/stories supplied repository usage.

`git diff --check` was executed during review without whitespace findings and is rerun as an exact command after formatting this report. Formatting and final exact diff-check results are appended below.

Material limits: browser E2E, full backend integration/concurrency/unit/types suites, lint, application/build and Storybook build were inspection-only in this reviewer pass. No claim is made that I reran those full gates or latest-head CI. I inspected the focused combat browser scenario and retained movement browser contract; I did not manually browse the live game. This report is independent code review with the completed checks above, not a replacement for root's full gate/CI acceptance.

## Stopped ownership handoff

All reviewer test sessions completed and exited. Integration API resources, Chromium/Vitest resources and disposable PostgreSQL test containers completed their normal disposal. Final Docker inventory contains only the existing persistent databases, with no reviewer disposable container remaining. Ports10136/10137/10138 have no listener; the preserved worktree DB10135 remains running. I started no persistent app/Storybook service and stopped or altered no unrelated service/helper, port6006, sibling/main database, or environment value.

Production/tests/docs stayed read-only. The only authored file is this assigned report; pnpm may update ignored test/typecheck artifacts. No SQL setup, DB reset/reseed, fixes, scope weakening, delegation, commit, push, or PR. Whole review and runtime work are stopped; root may route R2-DOC-01 and owns acceptance/ledger.

Final report verification: report-only oxfmt with write completed exit0; exact git diff --check completed exit0.
