# Requirements coverage ledger

This maps settled requirements to increments. I1 ordinary movement/shared eligibility is accepted by the orchestrator after fresh tester-r6 PASS and full reviewer-r4 no actionable findings at snapshot2F6044C7...; its accepted commit is06954d1a35759a5fa5bd4271f0585ba3ef71c6e4. Every I1 criterion and current local gate is accounted for in the final reports/run-state. Assault, colonization, integration and latest-head PR/CI delivery remain pending.

| Requirement area                                                                             | Planned gate                                                                      |
| -------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| Ruleset-owned composition, arbitrary target/input tags, shared UI/API/resolution eligibility | I1-01/05/07/08/16; extend for Assault I2-12/13/17, Colonize I3 and integration I4 |
| Aggregate resources/strength, replacement/cancellation, turn lock, real PostgreSQL           | I1-02/03/04/14/15                                                                 |
| Stationary owned source, positive integer force, partial/full splitting                      | I1-06/07/09/13                                                                    |
| Finite source-dependent range, no-op rejection, coincident distinct planets                  | I1-05/08/16                                                                       |
| Ordinary automatic movement, costs once, persisted speed/action binding, reload              | I1-10/11/13/17                                                                    |
| Action visible/locked during transit; no edit/cancel/reuse/redirect; next-turn release       | I1-11/17, terminal paths extended I2/I3                                           |
| Friendly merge, zero cleanup, persisted source-row deletion                                  | I1-09/12/13; pending-effect identity/provenance extended I2                       |
| Chronological 20-tick arrivals, canonical seeded ties, deferred arrival intent               | I2-04/05/06/09/10/14/15; Colonize I3                                              |
| Fixed Movement -> Build -> Combat -> Colonization phase order                                | I1 preserves; I2/I3 verify interactions; I4 full scenario                         |
| Explicit Assault only; simultaneous one-shot A/D losses, all enemies                         | I2-01/02/04/05/06/07/08                                                           |
| Proportional integer defender losses with exact totals/stable fleet-ID remainders            | I2-01/02/04/05/06/07/08                                                           |
| Later assaults current survivors; dead attacker Prevented; ordinary Move no combat           | I1-12/16 negative boundary; I2-03/04/05 full behavior                             |
| Movement+Assault persists and executes exactly once through merges/release                   | I2-09/10/11/15/16                                                                 |
| Unclaimed target; configured initial and deferred strength requirement20                     | I3 (alternate requirement test ruleset variation included)                        |
| Ownership transfer, 35 -> 15 and 20 -> removed, persisted/displayed                          | I3                                                                                |
| Post-combat prevention below20/dead/claimed; no extra consumption or return                  | I3                                                                                |
| First valid arrival wins, same-tick RNG; invalid first allows valid later                    | I3                                                                                |
| Existing COLONY resource unused; no population/production/growth/new resource                | I3 docs/content; I4 final diff                                                    |
| Move+Assault+Colonize composed regression                                                    | I3 and I4                                                                         |
| Usable UI inputs/range/errors, journeys/locks, strengths/ownership                           | I1/2/3 browser scenarios and Storybook; I4 complete player flow                   |
| Native TS/app boundaries, Results, domain schemas/migrations, accepted ADRs                  | Every independent full reviewer and orchestrator diff verification                |
| Existing documentation/indexes accurately distinguish scope still planned                    | Every implementation and I4 final documentation gate                              |
| Every increment plan -> implement -> fresh test -> fresh review -> verify -> commit          | Orchestrator ledger; no bypass/self-production fixes                              |
| One open PR ready, exact latest head applicable/required CI successful                       | I4 final delivery; existing PR595 reused and attached                             |

## CI inventory inspected at preparation head

PR595 targets main from codex/fleet-operations-experiment and is draft. Preparation head acde251d had successful code-quality, frontend, e2e, backend, shared, validate-pr-title, CodeScene Code Health Review (main), and codecov/patch. Workflow run38075599891 and title run38075600016 are baseline only, not implementation acceptance.

Do not accept pending/cancelled/missing expected checks, stale-head passes, unresolved bugs, or a prior-diff role report. Any production fix is routed through an implementer, appropriate fresh verification/review and another accepted commit.

## Approved concrete I2 coverage

Approved increments/increment-02.md v3 from06954d1a combines seed arrival lifecycle and normal Assault, with all18 acceptance criteria. I2-01..09 cover literal losses, actual presence, all-arrivals/build interactions, chronological/tied owner+instance order and merge provenance. I2-10/11/15 cover bounded pending JSON, once-only continuation/payment/effects, persistence/removal and busy/release. I2-12/13 cover shared three-boundary reservations/eligibility and arbitrary composition tags/parameters. I2-14 proves canonical construction/Build RNG replay under input/DB permutations. I2-16/17 cover actual authenticated combat browser and controlled stories; I2-18 retains I1 regressions and real PostgreSQL locks. I3 colonization and I4 multiplayer integration/latest-head green PR remain mandatory pending gates.

I2 v3 SHA256EF5D87C9727A1194206E0E65FCA88E1DBF188512A2ACF57806F9F38A073EE7D2 narrows I2-06 backend evidence to genuine natural-RNG rolled-back observation, actual worker persisted state and independently labeled shared replay, including order-sensitiveC10 control. All18 criteria and I2-10 remain mandatory; producer follow-up, fresh tester/full review and root acceptance are pending.

## Current I2 test gate and v4 fixture guidance

Historical tester-r1 acceptance gate failed after its independently executed suite and mandatory-layer audit; later corrections and fresh passes are tracked below, and root acceptance remains pending. Corrected tester report SHA256496032C684D9DBA221AD8AB947022D9B7E83B815153520E02725845ECE0237B0; all18 criteria still mandatory. Root independently confirmed the genuine missing B/C/U/F vectors and recorded T-I2-01..07/O-I2-11 in reports/increment-02-test-gap-disposition.md. O-I2-12 is a source-proven unused Assault-class field/assignment, assigned to the sole implementer rather than edited by root.

Approved current packet is v4 SHA256E4118FEA9BACB30A5233B92D5D15D790FB2337F0D3E3315A35B2AE65F34FAF97. All18 normalized criterion rows are unchanged from v3. Complete planner reportCAC0F443557B0043A63587FDC3087037514B7DDE2D6DC4FB3EB4600ED25A6180 supplies authentic public exact-tick fixture/layer methods, independently source-checked by root. Actual worker persists final state and RNG; separately labeled shared replay of a copied genuine natural input establishes unpersisted intermediates/order/outcomes/permutations. Neither replaces the other. Real PostgreSQL public lifecycle/locks/captured-JSON fault-injection and literal shared oracles remain required. There is no new outcome-history endpoint or secret-RNG setup.

Historical 6D gate: I2v4/all18 gates passed at61manifest6D before the later API-test and hook changes. FreshT5 independent all18/currentfullC11/statics PASS/STOP D89C; freshFULLR4 wholeincrement/noactionables/STOP5F72 with ownC9/S31/B6/F6. Root correctedPGselected6/6 actual0/27.12s, ownpublicB6/authE4 and seven criticalshared probes attributable, finalsource6D unchanged and cleanup confirmed. OriginalselectedPGfailure preserved honestly. Explicitstaging/hooks/commit pending; allwriters STOP. I3/I4/fullnormalE/latest-head green ready PR still pending. PR595 remote preparationheadacde only; no gameplay push.

Root read-only malformed-Assault schema diagnostic452867 completed exit0: missing source mapping, source/destination mismatch, duplicate Assault and unsupported Surprise discriminant all rejected. This proves current diagnostic behavior, not a substitute for required repository S/U regressions or the composed renamed-slot F13 story. Exact command/result is preserved in evidence/increment-02-root-combat-probe/current-schema-1030.json.

Current E874 gate: approvedv4/all18 unchanged. The sole authorized API-regression extension directly covers composed edit/reuse/redirect/null-cancel rejects with otherwise-valid free-instance controls and exact public-view/journey/resources nonmutation. Current full backend12files149/111.08s and affected statics completed0; corrected enabled hookC050 completed0 with104staged entries unchanged. These are actual factual command receipts. T6's disclosed late prior-report read requires fresh unprimed T7, LIVE independent all18 audit/current focused API/chunk probe. Fresh FULL R5 and root current-byte API/staging/normal enabled Gitcommit remain pending. Current61 E874 is unaccepted/uncommitted; previous T5/R4 at6D are historical. No I3 commissioning or gameplay push; latest-green ready PR remains mandatory.

## 2026-10-11 — current I2 acceptance and final commit gate

Fresh independent T7 passed all18 and stopped; fresh FULL R5 formal report SHA2560F65B9070341E844E5EE64BB6B2D5A5644105A8546D87F2873E70BB3F19E1622 was whole-read, all61 source/test/docs paths plus hook and all18 independently reviewed, no actionable findings, STOP. Own R5 focused S4files44tests, read-only installed hook coverage probe, diff and own WRITEformat actual0. Current61 E874 and separate hookC050 unchanged, old104stage preserved. Previous persuasive reports were not read; broader commands attributed from neutral primary receipts.

Root own current renamedAPI regression completed1file/1passed/27filtered/11.59s/actual0; fullraw renamed-api-current.log SHA256A98EBEC8DC31DDEA03A4F854EAE9897803F7AE558C3E66A43FDE1C06D447C7F5 with exact command/exit. Postrun whole61 stillE874. Root independently whole-read the authorized114-line API regression and identity proof (other60 unchanged), complete current stopped role reports/raw facts, and all18 acceptance mapping. All18 PASS at approved unchanged v4/E411, with no production defect, missing mandatory layer or design/ADR contradiction. Complete current fullB149 plus unchanged-input attributed S168/U11/F61+6native/build/type/affectednormal-authE7 and root own PG6/shared7/publicB6/authE4 remain honest completed facts. Earlier failed PG/normal-commit receipts are preserved and never credited green.

Final explicit intended staging and enabled normal Gitcommit, source/hook/actual-image byte accounting remain pending; no increment SHA exists yet. Root writes only orchestration artifacts, never production/test fixes. No I3 planner is commissioned before actual accepted I2SHA. Colonization, I4 full normal integration, push/update existing PR595 and all applicable latest-head green CI remain required.
