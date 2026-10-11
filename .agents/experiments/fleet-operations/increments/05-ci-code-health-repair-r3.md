# Increment 05 CI code-health repair r3

## Identity

- Increment ID/title: **05-r3 — preserve declaration diagnostics while simplifying effect-target compatibility**.
- Absolute worktree root: `C:/Users/Guillaume/.codex/worktrees/fleet-operations-sol/text-based-browser-game-1`; branch `codex/fleet-operations-sol`.
- Base: `375eedf2966c06a7811fea846c37baffc46e88dc`. Increment05 comparison base: `84fa50e210d74e3f480c96d32e6f6c1ad7568d25`; complete experiment comparison base: `aa9272ec2b9ac756aa5d606bca900875ff9f58ed`.
- Plan version: **1, proposed**. Root freezes its formatted SHA256 on approval and dispatches the unchanged packet; this planner does not authorize implementation.
- Goal: make one substantive local responsibility split in `ActionDefinition.ts` for the sole residual hosted warning, preserving all schema acceptance, parsed outputs and ordered diagnostics.
- Non-goals: gameplay/content/balance changes; new modules or public APIs; generic validation framework; forwarding/dummy helpers or function-count padding; suppression; analyzer/CI/configuration/threshold/dependency changes; timeout/retry/test weakening; migrations/database resets; services; environment-value edits; main-checkout operations; Git/cloud mutations by workers.
- Persona/model/effort: fresh Fleet Planner, `.agents/personas/fleet-planner.md`, `gpt-6.1-sol` / `high`. Root assigns existing Fleet Implementer `gpt-6.1-sol` / `medium`, fresh Fleet Tester `gpt-6.1-sol` / `medium`, fresh Fleet Reviewer `gpt-6.1-sol` / `high` after approval. Workers spawn no agents.
- Authority: [requirements.md](../requirements.md), [initial-plan.md](../initial-plan.md), [increment-template.md](../increment-template.md), the three frozen contracts below and their incorporated earlier increments. Requirements supersede the old colonization design; settled scope stays settled.
- Planner write scope: **only this file**. No separate planner report. Implementation, suites, service operations, Git mutation and external operations are prohibited for this planner.
- Proposed implementer write scope after approval: `packages/shared/src/domain/ruleset/action-definitions/ActionDefinition.ts` and meaningful diagnostic cases in `packages/shared/src/action-submission/fleetBoundaryIndependent.test.ts`; existing `packages/shared/src/domain/ruleset/Ruleset.test.ts` only if an actual uncovered constructor-result contract requires a case. No other production path. Root must approve a demonstrated scope expansion before it is made.

| Frozen contract                  | Verified SHA256                                                    |
| -------------------------------- | ------------------------------------------------------------------ |
| `05-integration-and-delivery.md` | `A5CC7432A7CDD146C467011806D74E01374B7A09F9E64E0C569CDDEDD0E970E3` |
| `05-ci-code-health-repair.md`    | `367848B6FBF5855C2CD12370865517B29E59F3F2261A96AD1003D71D144E02B1` |
| `05-ci-code-health-repair-r2.md` | `F8FCECDE0F96C00872658CC2AFC7B3ED97485F63B4D13E5B7A7441AC37279D48` |

These are accepted contracts, incorporated unchanged, not prior confidence reports. This supplement does not rewrite their criteria or waive their local/hosted gates. Approval, report dispositions, commit/push, existing PR596 readiness and hosted delivery belong to root.

## Evidence and proposed change

### Primary observation and current status

Primary artifact: `../reports/05-ci-repair-head2-codescene-primary.json`, SHA256 `AABDFF23458C554DDED6BDF73C6B2E4977167EA5339CA59C30A4A14AFB3183F3`, exact base above, check `114470975410`, [CodeScene result7902043](https://codescene.io/projects/83154/delta/results/7902043). Its five quality gates pass; advisory rules fail on **one** path, `packages/shared/src/domain/ruleset/action-definitions/ActionDefinition.ts`, mean cyclomatic complexity **4.09 across 11 functions**, threshold 4. Eight annotations are improvement notices; one is this warning. None demonstrates gameplay failure. Read the actual nine rows in order; ignore suppression/install suggestions.

Preserve these eight notices: router submission/deselection Large Method removal; router repeated authenticated-state Large Method removal; `UpdateActionSubmissionUseCase.execute` CC11→9 and Large Method removal; `ActionsPage.ts` primitive/string argument improvements95.24%→85.71%; SearchSelect CC36→34 and length193→190. There is no new edit mandate for those paths.

Fresh fact-only primary `../reports/05-ci-repair-head2-terminal.json`, verified SHA256 `8B498DBD1FC2A0E1F24BA0C1FDFF1DE631FA8F99488A312C0F89D54342D52A6E`, records at this same base, Backend `114470982745` SUCCESS12:41:45UTC, E2E `114470982771` SUCCESS12:41:18UTC, Continuous Integration `38139750576` SUCCESS; quality/frontend/shared/title/codecov also SUCCESS. Backend and shared coverage tests, artifact uploads and Codecov uploads are SUCCESS. This does not establish any future-head result. The sole demonstrated failure remains the schema advisory. No prior role verdicts, finding dispositions, manifests or run-state narratives informed this plan.

### Guidance and constraints consulted

Read root AGENTS and nearest shared/backend/frontend/docs AGENTS, persona, requirements/initial plan/template, complete live `ActionDefinition.ts`, coding standards/glossary and installed `packages/shared/node_modules/@guillaume-docquier/tools-ts/README.md`; ADR index and relevant accepted007/008/011/013/015/017/018/022/027/028; GDDR009/index and relevant Systems003/008/010/011/012/015/index; turn-resolution architecture. No accepted-ADR contradiction blocks this local parser responsibility change. No new vocabulary or design document is required.

ADR027 explicitly permits Action/Ruleset domain integrity refinements; retain them. ADR028 keeps trusted constructors on `typedParse`/`safeTypedParse`; raw JSON schema tests remain legitimate unknown-data boundaries. ADR013 permits an infallible pure diagnostic projection to return a plain value. ADR007/011/022 keep schema ownership shared, Standard content backend-owned, frontend API types named and type-only, and worker code independent of API. Preserve native erasable TypeScript and current immutable request conventions. No helper needs an app import, I/O, RNG, mutable global state, Assert or thrown expected failure.

### Current live responsibility and exact entry points

`ActionDefinitionSchema` retains `z.object` with id/name/type/tier/inputs/targets/costs/effects, then **first** `.superRefine(validateEffectDefinitionTargets)`, **second** `.superRefine(validateMovementComposition)`. Every current exported type/schema and nested schema stays unchanged.

`validateEffectDefinitionTargets` currently owns three jobs in one nested loop: enumerate declarations and roles; classify a referenced slot as absent, incompatible or compatible; emit Zod custom issues with rendered messages. Its ordering is `[...actionDefinition.costs, ...actionDefinition.effects]`, then `Object.values(effectDefinition.targets)`. It resolves only the role's `actionTargetTag`; it never substitutes the role name or action ID. Compatible references emit nothing; every invalid occurrence emits one issue, even if another role/effect points to the same bad slot.

The r2 repairs are already live and are preservation obligations: `validateFleetSourcePolicy` derives a constraint-type Set and emits owned then stationary; `validateInputReferences` derives a consumed movement-tag Set; `validateSharedMovement` checks exact-one cardinality and both mapped tags. Do not churn these or the other validators to chase a metric.

The entire unchanged composition sequence is:

1. Each Assault declaration in effect order: exactly one Move sharing source and destination, one issue per incompatible Assault.
2. Colonize cardinality, then each Colonize declaration in effect order: owned, stationary, unclaimed, followed by stationary no-input/at-source or moving exact-one/shared-tags diagnostics.
3. Move cardinality.
4. Target entries and each constraint in declaration order: missing/non-Fleet source dependencies.
5. Input entries in declaration order: invalid source reference first, unused input independently second. A malformed Move still consumes its declared input tag; duplicate Moves do not multiply an unused-input issue.
6. Each Move in effect order: strength-input source mismatch, owned source, stationary source, configured range-from-source requirement. Repeated Moves repeat their declaration diagnostic sequences.

Nested `TargetDefinitionSchema` constraint compatibility errors retain their indexed paths; base shape/discriminated-union/value checks remain Zod-owned. Do not run composition on structurally invalid objects, bypass nested validation, move errors to new paths, deduplicate, sort diagnostics or stop on first mismatch.

### Minimal proposed responsibility split

Keep the existing module. Add **one private pure compatibility diagnostic function**, e.g. `getEffectTargetCompatibilityIssue(request)`, with one named typed readonly request containing:

- Action name and declared `ActionDefinition["targets"]` slots.
- Effect type from the current EffectDefinition union.
- One `EffectDefinitionTargetDefinition` reference, retaining its branded `TargetTag` and declared `TargetType`.

It owns actual slot lookup, absent-versus-incompatible classification, and exact diagnostic message construction. Its output is `string | undefined`: compatible→undefined; absent→the existing missing-slot message; incompatible→the existing expected-versus-actual-type message. Use the existing shared type, imported type-only if necessary; no new exported/domain type or generic result hierarchy. Missing takes precedence over incompatible. Do not assume slot presence merely because the source object passed base shape parsing: missing cross-references are precisely this refinement's responsibility.

`validateEffectDefinitionTargets` remains the Zod adapter and traversal coordinator: enumerate the same costs/effects/roles, evaluate that meaningful compatibility contract once per occurrence, and add exactly `{ code: "custom", message }` when the returned diagnostic exists. The pure function must contain the actual reference policy and message ownership, not forward another validator; the adapter must contain traversal and ordered Zod emission, not wrap the old nested validator unchanged. Do not split message constructors, success predicates, individual branches or emitter aliases into additional filler functions. Tests exercise the real schema; do not export the private function solely for helper tests.

This separation makes reference compatibility locally understandable without a mutable Zod context, while the schema adapter owns ordered issue accumulation. It is a substantive responsibility split; the review must establish that independently of analyzer scores. It does not remove any validation decision, introduce a framework, or promise a predicted mean/Code Health score. Only a new committed/pushed exact-head hosted analysis can establish success. If this real split still leaves an actual warning, root routes the new measured evidence; no padding or suppression is authorized.

### Related schemas and actual consuming boundaries

Inspected `InputDefinition.ts`, `TargetDefinition.ts`, `TargetConstraint.ts`/`getFleetTargetDependency`, `TargetType.ts`, `EffectDefinition.ts`, `EffectDefinitionTargetDefinition.ts`, ResourceLoss/Move/Assault/Colonize definitions, `Ruleset.ts`, ActionDefinition stub, Fleet/FleetMovement schemas and saved-movement validators. Bounds, strict objects, optionality, inferred/branded values, supported effect vocabulary and target/input mappings remain identical.

| Actual consumer                                                                                                                                 | Preservation proof / validation seam                                                                                                                                                                                                        |
| ----------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ActionDefinition.stub.ts::createActionDefinitionStub`                                                                                          | `typedParse(ActionDefinitionSchema, ...)` still constructs trusted valid definitions, with identical parsed output                                                                                                                          |
| Standard `action-definitions/move-fleet.ts`, `attack-move.ts`, `colonize-planet.ts`, `build-fleet.ts`                                           | Current typed schema constructors remain valid; `StandardRuleset.ts` still uses `Ruleset.create`                                                                                                                                            |
| shared Test counterparts / `TestRuleset.ts`                                                                                                     | Stable independent Test constructors and extra instance identities remain unchanged                                                                                                                                                         |
| `testing/FleetOperationsRuleset.stub.ts::authorFleetOrder` / `createFleetOperationsRuleset`                                                     | Renamed craft/world/force, alternate range17/18, cost24/4, speed9/10 and required25 still construct/load identically                                                                                                                        |
| `Ruleset.ts::Ruleset.create`, `safeCreate`, `RulesetSchema`                                                                                     | Typed constructors retain success/failure behavior; `safeCreate` preserves the complete ordered custom-message Failure list; direct unknown JSON yields identical nested issues                                                             |
| backend `lib/rulesets/rulesets.repository.ts::RulesetsRepository.toRuleset` / `getRuleset`                                                      | Persisted rules JSON is still reconstructed through `Ruleset.create`; no row mapping/storage change                                                                                                                                         |
| `api/games/games.repository.ts::getRuleset`; `api/gameplay/gameplay.repository.ts::getRuleset`; `turn-processing/turns.repository.ts` load path | All delegate to that same reconstruction; game-start, locked submission/public view and worker loads still parse the selected ruleset                                                                                                       |
| `api/gameplay/getPlayerView.useCase.ts::PlayerViewDtoSchema`                                                                                    | Still nests `RulesetSchema`; public validated output and inferred API contract stay identical                                                                                                                                               |
| `resolveFleetMovementPhase.ts::validateJourneyBinding`; `resolveTurn.ts`                                                                        | `safeTypedParse(ActionDefinitionSchema, definition)` still rejects corrupt saved definitions before submissions/payment/mutation with `Invalid persisted journey Action Definition`; other first-error order and continuation checks remain |
| frontend `actionEligibilityState.ts::toActionEligibilityState`, `ActionCard.tsx::evaluateActionSelection`, `TargetPicker.tsx::getTargetOptions` | Consume unchanged parsed definitions/public ruleset and the same shared eligibility functions; no UI formula or API type reconstruction                                                                                                     |

No public schema/data/persistence/transaction change is proposed. No new effect, constraint, selected input, balance parameter, migration, reset or frontend/backend contract edit. Continuation, one-time payment, turn locks, arrival ticks/provenance, same-owner merge identity, saved pending variants, release/reuse and expected Prevented-versus-invalid Failure behavior stay governed by every frozen criterion. This patch handles declaration integrity; expected current-state prevention is not converted into schema failure.

### Ordered diagnostics contract

At the direct boundary compare the **complete** `error.issues` array with independently authored expected objects. For these custom issues each object is exactly `{ code: "custom", path: [], message: <literal> }`. At `RulesetSchema.safeParse(JSON.parse(JSON.stringify(...)))`, the same sequence/multiplicity is expected with paths `["actionDefinitions", "RENAMED"]`. Do not project only messages, use arrayContaining, compare unordered Sets, calculate expected diagnostics with the new helper or use before/after production output as the sole oracle.

Existing missing-source vector in `fleetBoundaryIndependent.test.ts` stays exactly:

1. `Action Definition "Traverse" is missing target slot tagged "craft" required by the "FLEET_MOVE" effect definition`
2. `Target route references a missing or non-fleet source`
3. `Input force references a missing or non-fleet source`
4. `Movement source must be owned`
5. `Movement source must be stationary`

Existing duplicate-Move vector stays exactly: Move cardinality; invalid force reference; invalid spare reference; unused spare; then strength-input/source-owned/source-stationary/range in that order **twice**. Keep its twelve literal message objects, empty/duplicate/reversed source-policy cases and valid renamed controls unchanged. Preserve malformed Assault/Colonize matrices and unrelated Ruleset indexing/pool/value diagnostics through focused/full suites.

Add a meaningful mixed compatibility fixture with `id: RENAMED`, `name: Schema Probe`, inputs empty, a no-target resource cost, no-target gain, compatible Build→`site` PLANET, and ordered Build references `absent`, `wrong` FLEET, then `absent` again. Its only errors, in the Build occurrence order, are:

1. `Action Definition "Schema Probe" is missing target slot tagged "absent" required by the "FLEET_BUILD" effect definition`
2. `Action Definition "Schema Probe" target slot tagged "wrong" has type "FLEET", but the "FLEET_BUILD" effect definition requires "PLANET"`
3. The exact first missing-slot message again.

No-target cost/gain and compatible Build emit nothing. Reorder the wrong/missing Build declarations in a second control and assert the corresponding literal order. Keep the ruleset fixture's pool references valid and its key equal to the definition id, so unrelated index/pool failures do not obscure the oracle. Both direct schema and nested JSON must assert the full issue objects, code/path/message/multiplicity.

Add one multi-role/composition fixture, also `Schema Probe`/RENAMED: slots `wrong: FLEET` with no constraints and `site: PLANET` with no constraints; input `force` references `site` and `spare` references `absent`; effects are one Assault then two identical Moves, all roles mapping fleet→`absent`, planet→`wrong`, both Moves consuming `force`, with valid positive speed. No costs or nested shape violations. The exact custom-message sequence is:

1. Missing `absent` required by ASSAULT.
2. `wrong` has FLEET but ASSAULT requires PLANET.
3. Missing `absent` required by FLEET_MOVE.
4. `wrong` has FLEET but FLEET_MOVE requires PLANET.
5. The same missing FLEET_MOVE message again.
6. The same incompatible FLEET_MOVE message again.
7. `Assault must share the source and destination of exactly one Move`
8. `An Action supports at most one FLEET_MOVE`
9. `Input force references a missing or non-fleet source`
10. `Input spare references a missing or non-fleet source`
11. `Unused input spare`
12. `Movement strength input must reference its fleet source`
13. `Movement source must be owned`
14. `Movement source must be stationary`
15. `Movement destination must declare a range from its source`
16. The exact strength-input message again.
17. The exact owned message again.
18. The exact stationary message again.
19. The exact range message again.

For rows1..6 use the same complete literal message vocabulary shown in the Build fixture, substituting only the explicitly specified effect type. Write those expected strings literally in tests. This independently exposes role ordering, duplicate references, continued composition validation, and repeated declaration multiplicity at both boundaries. A success control fixes the Build references or uses the existing valid renamed Move rather than suppressing diagnostics.

## Acceptance contract

All **99 inherited IDs and their exact semantics remain binding**. Their unchanged definitions live in the frozen packets/approved earlier packets, not duplicated or replaced here. Fresh tester records one current concrete evidence row per ID, plus the new R3 rows; explicit root-owned future hosted status is required for hosted criteria. A passing group summary or old confidence verdict cannot replace those rows.

- A1-01, A1-02, A1-03, A1-04, A1-05, A1-06, A1-07, A1-08, A1-09, A1-10, A1-11, A1-12, A1-13, A1-14, A1-15, A1-16, A1-17, A1-18.
- M2-01, M2-02, M2-03, M2-04, M2-05, M2-06, M2-07, M2-08, M2-09.
- A2-01, A2-02, A2-03, A2-04, A2-05, A2-06, A2-07.
- P2-01, P2-02, P2-03, P2-04, P2-05, P2-06.
- C4-01, C4-02, C4-03, C4-04, C4-05, C4-06, C4-07, C4-08, C4-09, C4-10.
- P4-01, P4-02, P4-03, P4-04, P4-05, P4-06, P4-07, P4-08.
- I5-01, I5-02, I5-03, I5-04, I5-05, I5-06, I5-07, I5-08, I5-09, I5-10, I5-11.
- CH-01, CH-02, CH-03, CH-04, CH-05, CH-06, CH-07, CH-08, CH-09, CH-10, CH-11.
- R2-CS01, R2-CS02, R2-CS03, R2-CS04, R2-CS05, R2-CS06, R2-CS07, R2-CS08, R2-CS09, R2-CS10, R2-CS11.
- R2-D01, R2-D02, R2-D03, R2-D04, R2-D05, R2-B01, R2-B02, R2-B03.

| ID      | Independent Given / When / Then                                                                                                                                                                                                                                                                                                                                                                                              | Layer / command                                                                                                    |
| ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| R3-01   | Given the Schema Probe no-target/valid/missing/wrong/repeated Build declarations, when direct-parsing and JSON-loading, then precisely the three complete custom issue objects above occur; the wrong-first control changes only their declaration order; fixed references succeed with unchanged parsed values                                                                                                              | Real schemas in fleetBoundaryIndependent; focused command below                                                    |
| R3-02   | Given the explicit multi-role Assault/two-Move fixture, when direct-parsing and JSON-loading, then exactly nineteen independently authored issue objects appear in the specified order, with direct empty paths and nested RENAMED paths; no deduplication or short-circuit                                                                                                                                                  | Same file; complete strict issue-array comparison                                                                  |
| R3-03   | Given existing missing-source, duplicate-Move, policy and malformed composition controls, when running focused/full shared suites, then all exact current issue vectors, structural-error paths, valid renamed constructors, parsed outputs and Ruleset.safeCreate whole Results remain; input/state objects remain unmutated by schema parsing                                                                              | fleetBoundaryIndependent, Ruleset, actionEligibility, fleetOperations, colonization; focused/full shared commands  |
| R3-04   | Given Standard/Test/alternate definitions and actual persisted ruleset/journey consumers, when constructing/reloading and validating a corrupt saved definition, then original parameters/mappings load unchanged, corrupt journeys fail before current payment/state mutation, valid 2/2/1 continuation and arrival20/25 consumption behave unchanged                                                                       | CoreRulesets unit; persistedJourney/fleetOperations/colonization/shared resolver; applicable public backend checks |
| R3-05   | Given the final narrow diff, when fresh review examines both changed functions and their callers, then the private typed helper owns actual slot compatibility and exact messages, the original validator owns traversal/Zod accumulation, all unchanged schema/composition exports/order remain, and there are no forwarding/dummy helpers, unrelated modules, weakened diagnostics/tests or analyzer configuration changes | Full r3 diff plus incremental/full experiment review, root independent source spots                                |
| R3-06   | Given all 99 retained criteria, when accounting final-input gate evidence, then every row is mapped to current primary source/test evidence or an explicitly pending root-hosted obligation, input closure proves any reused receipt applicable, and changed consuming gates are rerun without claiming old-head hosted success covers this candidate                                                                        | Commands, changed-input ledger, full gate evidence and immutable hashes                                            |
| R3-CS01 | Given a root-accepted local repair committed/pushed to the next exact PR head, when root obtains fresh CodeScene and all applicable hosted checks, then the single warning is removed, eight improvements preserved, all analyzer gates green, no new unhealthy code, all applicable CI green and PR596 ready/OPEN as frozen I5-11/CH-11 require                                                                             | **FUTURE root-only hosted evidence**; no local score or uncommitted hosted acceptance                              |

### Implementation and verification sequence

1. Root approves the formatted packet/hash, verifies exact base and frozen contract hashes, and dispatches the existing implementer. Record actual source/test inputs before edits. Inspect nearest guidance and live schema/helper/consumer code; do not use prior confidence verdicts.
2. Implement only the substantive compatibility responsibility split. Add the two independent meaningful diagnostic cases and success controls through real schemas. Preserve existing tests/assertions; do not add tests that merely repeat private helper implementation.
3. Format actual changed files with `pnpm exec oxfmt --write <actual paths>`; run `git diff --check`, `pnpm lint`, `pnpm typecheck`, `pnpm --filter shared typecheck`, `pnpm --filter backend typecheck`, `pnpm --filter frontend typecheck`.
4. Focused declaration/consumer shared command: `pnpm --filter shared test src/domain/ruleset/Ruleset.test.ts src/action-submission/actionEligibility.test.ts src/action-submission/fleetBoundaryIndependent.test.ts src/action-submission/persistedJourney.test.ts src/turn-resolution/fleetOperations.test.ts src/turn-resolution/colonization.test.ts src/turn-resolution/resolveTurn.test.ts`. Existing saved-binding tests exercise the real early guard; no private production exports are added.
5. Focused backend constructor command: `pnpm --filter backend test --project unit src/lib/rulesets/CoreRulesets.unit.test.ts`. As the shared parser is consumed by public loads, run applicable focused router/worker files from r1/r2, including `pnpm --filter backend test --project integration src/api/gameplay/gameplay.router.integration.test.ts src/turn-processing/TurnProcessor.integration.test.ts src/api/gameplay/combat.integration.test.ts src/api/gameplay/colonization.integration.test.ts`, before required full backend coverage. Use normal configuration and public seams.
6. Required full shared command pair remains `pnpm --filter shared test` **and** `pnpm --filter shared test:coverage`. Verify real shared LCOV. Full backend `pnpm --filter backend test:coverage` must prove normal types/unit/integration/concurrency projects and LCOV; no timeout/retry/project/coverage relief. Run serially relative to other heavy suites.
7. Required frontend consuming gates remain `pnpm --filter frontend build`, `pnpm --filter frontend storybook:build`, `pnpm --filter frontend storybook:test`, and `pnpm --filter frontend e2e --add-reporter=list`; root/roles follow the frozen skill/TTY/ownership/setup/cleanup rules. Focused unified E2E is available for concrete diagnosis via `pnpm --filter frontend e2e playwright/specs/fleetOperations.spec.ts --add-reporter=list`. No planner launches these. No frontend source/story/POM edit is needed.
8. Fresh tester and reviewer receive this approved packet, frozen contracts, source/tests and primary evidence, then audit the final changed input independently. Tester writes tests only; reviewer reviews the complete05 artifact/full experiment scope as frozen I5-09 requires, as well as this narrow delta. Findings return to the existing implementer and require affected revalidation/fresh review. Root independently spots the three/nineteen issue arrays, missing/wrong precedence, duplicate role multiplicity, safeCreate Failure order, actual constructor/load graph, and no accidental policy change before local acceptance.
9. Root accepts final local gates/reports/scope, commits/pushes, then owns the new exact-head CodeScene and all applicable hosted receipt. I5-11, CH-11 and R3-CS01 stay **future** until that new committed/pushed head exists and passes. If hosted fails, use primary new rows to plan meaningful repair; local success cannot waive it. Existing PR596 remains the sole delivery target; no merge/automerge/duplicate PR/bot request.

### Consuming-input proof and gate freshness

A package directory remaining textually unchanged does **not** prove its consuming gate unchanged. Record each receipt's actual base/candidate identity, tracked and untracked source/test paths, transitive workspace dependencies, configuration/lock/runtime inputs, command/project scope and final exit/artifact identity. Use `git diff --name-status 375eedf2966c06a7811fea846c37baffc46e88dc`, full diff and `git ls-files --others --exclude-standard`; exclude only explicit nonconsumed reports/packet files, with rationale. Record hashes without exposing service secrets.

For this planned source change, backend typed constructors, repository/gameplay/worker/DTO parser paths consume `ActionDefinitionSchema`; frontend build/typechecking and test ruleset/stories consume shared definitions, and full E2E consumes the backend's parser through its actual server. Their relevant input closure therefore changes even though backend/frontend authored files do not. The new source must receive applicable final consuming checks; successful base375 hosted backend/E2E is baseline evidence only. Do not call those gates genuinely unchanged or reuse their old-head results as candidate acceptance.

A genuinely unchanged receipt may be reused only when its full consumed input closure is demonstrably identical and the frozen mandatory gate has already passed for that same input, or root records a precise applicable proof. A report-only/packet-only update after green source checks does not require gratuitous suite repetition. Any code/test/config/runtime dependency change or demonstrated failure invalidates affected reuse. This is input accounting, not a reduction of any frozen gate. No environment value is changed to make checks pass.

All shell/file work remains in the absolute authorized checkout with `require_escalated` and a user-authorized-worktree justification. Preserve isolated database/service ownership and unrelated listeners. Storybook build uses exact reviewed prefix `[pnpm, --filter, frontend, storybook:build]`; E2E uses its skill, TTY, process-only reporting preferences, Clerk setup and terminal-exit/owned-cleanup evidence. Shared/backend have no build command to invent.

## Risks, decisions and blockers

No genuine accepted-ADR or settled-design contradiction was found. Risks are accidental issue reordering, collapsing repeated bad references, substituting target-role names for tags, broadening accepted declarations, losing composition errors after target errors, incidental path changes at nested JSON load, and claiming a local structural argument proves the hosted metric. The explicit three/nineteen-object oracles and unchanged complete suite contracts address them. Retain the existing module and all coherent r2 validators. Any additional responsibility/module requires demonstrated need and root-approved scope; no speculative framework.

No gameplay defect is inferred. Root approval, final candidate implementation/tests/review and future exact-head hosted results remain outstanding. The planner claims only source-based planning and hash verification, not test execution or delivery acceptance.

## Handoff reports

Reports remain separate under `../reports/`, owned by assigned roles/root; this planner writes none.

- Implementer: exact files/base/input identity, private helper request/output/responsibility and complete caller list, diagnostic preservation and R3/99-ID mapping, commands/exits/counts/coverage artifacts, scope/remaining gaps. Distinguish present primary hosted facts from future-head obligations.
- Tester: independent three/nineteen full issue objects at both boundaries, retained diagnostic/constructor/continuation tests, one evidence row per 99 inherited IDs and R3 rows, commands/projects/counts/exits, test-only scope and demonstrated reproduction findings.
- Reviewer: full r3 source/test delta plus frozen full-increment/experiment review, concrete responsibility/value assessment and complete schema/consumer order/type/path audit; actionable findings with file/line/impact/contract/ADR basis or explicit current-input no-findings verdict. No metric guess.
- Root: approved version/hash, final findings/dispositions, independent source/literal/input-closure spots, local gate receipt, unchanged frozen hashes, accepted commit/pushed head, then new exact-head complete hosted receipt/readiness. Prior input's passing review does not approve a materially changed candidate.

Stop condition for this planner: write and format this assigned packet, read-only whitespace/hash/scope checks, report its path/SHA256/blockers to root, then stop. Implementation begins only after root approval.
