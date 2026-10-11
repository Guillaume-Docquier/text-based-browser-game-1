# Requirements coverage ledger

This maps settled requirements to increments. I1 ordinary movement/shared eligibility is accepted by the orchestrator after fresh tester-r6 PASS and full reviewer-r4 no actionable findings at snapshot2F6044C7...; its commit is pending. Every I1 criterion and current local gate is accounted for in the final reports/run-state. Assault, colonization, integration and latest-head PR/CI delivery remain pending.

| Requirement area                                                                             | Planned gate                                                            |
| -------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| Ruleset-owned composition, arbitrary target/input tags, shared UI/API/resolution eligibility | I1-01/05/07/08/16; extend for Assault/Colonize I3/I4 and integration I5 |
| Aggregate resources/strength, replacement/cancellation, turn lock, real PostgreSQL           | I1-02/03/04/14/15                                                       |
| Stationary owned source, positive integer force, partial/full splitting                      | I1-06/07/09/13                                                          |
| Finite source-dependent range, no-op rejection, coincident distinct planets                  | I1-05/08/16                                                             |
| Ordinary automatic movement, costs once, persisted speed/action binding, reload              | I1-10/11/13/17                                                          |
| Action visible/locked during transit; no edit/cancel/reuse/redirect; next-turn release       | I1-11/17, terminal paths extended I2/I3/I4                              |
| Friendly merge, zero cleanup, persisted source-row deletion                                  | I1-09/12/13; pending-effect identity/provenance extended I2             |
| Chronological 20-tick arrivals, canonical seeded ties, deferred arrival intent               | I2, consuming Assault I3 and Colonize I4                                |
| Fixed Movement -> Build -> Combat -> Colonization phase order                                | I1 preserves; I2/I3/I4 verify interactions; I5 full scenario            |
| Explicit Assault only; simultaneous one-shot A/D losses, all enemies                         | I3                                                                      |
| Proportional integer defender losses with exact totals/stable fleet-ID remainders            | I3                                                                      |
| Later assaults current survivors; dead attacker Prevented; ordinary Move no combat           | I1-12/16 negative boundary; I3 full behavior                            |
| Movement+Assault persists and executes exactly once through merges/release                   | I2 mechanism; I3 acceptance                                             |
| Unclaimed target; configured initial and deferred strength requirement20                     | I4 (alternate requirement test ruleset variation included)              |
| Ownership transfer, 35 -> 15 and 20 -> removed, persisted/displayed                          | I4                                                                      |
| Post-combat prevention below20/dead/claimed; no extra consumption or return                  | I4                                                                      |
| First valid arrival wins, same-tick RNG; invalid first allows valid later                    | I4                                                                      |
| Existing COLONY resource unused; no population/production/growth/new resource                | I4 docs/content; I5 final diff                                          |
| Move+Assault+Colonize composed regression                                                    | I4 and I5                                                               |
| Usable UI inputs/range/errors, journeys/locks, strengths/ownership                           | I1/3/4 browser scenarios and Storybook; I5 complete player flow         |
| Native TS/app boundaries, Results, domain schemas/migrations, accepted ADRs                  | Every independent full reviewer and orchestrator diff verification      |
| Existing documentation/indexes accurately distinguish scope still planned                    | Every implementation and I5 final documentation gate                    |
| Every increment plan -> implement -> fresh test -> fresh review -> verify -> commit          | Orchestrator ledger; no bypass/self-production fixes                    |
| One open PR ready, exact latest head applicable/required CI successful                       | I5 final delivery; existing PR595 reused and attached                   |

## CI inventory inspected at preparation head

PR595 targets main from codex/fleet-operations-experiment and is draft. Preparation head acde251d had successful code-quality, frontend, e2e, backend, shared, validate-pr-title, CodeScene Code Health Review (main), and codecov/patch. Workflow run38075599891 and title run38075600016 are baseline only, not implementation acceptance.

Do not accept pending/cancelled/missing expected checks, stale-head passes, unresolved bugs, or a prior-diff role report. Any production fix is routed through an implementer, appropriate fresh verification/review and another accepted commit.
