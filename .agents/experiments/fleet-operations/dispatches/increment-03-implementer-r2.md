# Increment03 existing implementer correction r2 (prepared)

PREPARED ONLY. Do not execute before root redispatch after current tester's formal STOP.

Role: existing /root/increment03_implementer, explicitly originally spawned gpt-6-luna/MAX/forknone; retain it for fixes. No subagents. Sole production/test writer ONLY on explicit redispatch.
Worktree: C:/Users/Guillaume/.codex/worktrees/fleet-operations-experiment/text-based-browser-game-1.
Branch: codex/fleet-operations-experiment.
Base:34e64fbabee094f18c4af75dbee613f8b7f6c378.
Persona: .agents/personas/fleet-implementer.md.
Frozen approved plan: .agents/experiments/fleet-operations/increments/increment-03.md v3 SHA256 EE88A85CC2FDC7CE7E0D3561153CAF74450F8E08357EAA1E53C11FE2EF950B31, ALL24 and final G unchanged.

Read root/scoped backend/frontend AGENTS, frontend contracts ADR022 and sharing ADR007, TS standards/glossary/tools-ts README, all relevant readings required by original approved packet and authoritative requirements. Respect current sole-writer boundary; preserve all tester edits/reports/evidence and old artifacts. No main, service env, unrelated edits, staging/commit/push/PR/merge/bots.

## Concrete root finding O-I3-18

I3 newly introduced StarSystem["star"]["id"] in GalaxyPage.tsx component-state declaration and findSystem argument. Frontend AGENTS and accepted ADR022 explicitly require named API contract types imported type-only from api/types.ts and reserve nested API derivation for that contract file. api/types.ts currently exports StarSystem but not a star/system identity scalar contract.

Use a named reusable identity contract exported at apps/backend/src/api/types.ts, derived from the genuine API output (or a permitted simple branded-scalar export where appropriate). Import it with import type from @api-types in GalaxyPage and use it at both sites. Choose a domain-consistent name; preserve ID-based current-view refresh and all runtime behavior. No new abstraction, schema, gameplay, documentation design change or speculative runtime regression test is needed for this type-only correction.

Validate meaningful current affected static checks (root/backend/frontend types and scoped lint; write-format only own changed files). For runtime suite attribution, distinguish type-only edits from any executable test/component/mechanic changes and retain exact neutral input identity; if any executable behavior changes, run appropriate affected tests. Other demonstrated findings, if any, require a separately explicit root dispatch; do not infer additional scope from old reports.

Own new report: .agents/experiments/fleet-operations/reports/increment-03-implementer-r2.md.
Own new evidence: .agents/experiments/fleet-operations/evidence/increment-03-implementer-r2/.
Report O-I3-18 disposition, exact changed paths/current source hashes, exact commands/actual exits and limitations, any residual G pending, explicit ALL own writes/processes STOP. Do not rewrite r1 report or manufacture a retained raw failure. Root will commission fresh independent affected testing/full review and independently accept before commit. This preparation is not dispatch or acceptance.
