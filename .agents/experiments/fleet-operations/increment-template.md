# Increment packet template

The planner creates one file per increment under increments/. The orchestrator reviews and approves it before dispatch. This is the shared contract supplied unchanged to fresh implementer, tester, and reviewer contexts. Revisions require orchestrator approval and must reach all affected roles.

## Identity

- Increment ID/title:
- Absolute worktree root and branch:
- Base commit (the previous accepted increment):
- Approved plan version:
- Goal and explicit non-goals:
- Required persona and exact model/effort:
- Authoritative scope: ../requirements.md
- Allowed write scope:

## Evidence and proposed change

- Current behavior with relevant files/symbols:
- Documentation and accepted ADRs consulted:
- Proposed data and persistence changes:
- Shared eligibility functions and each consuming boundary:
- Ruleset effects, constraints, inputs, and concrete balance parameters:
- Continuation/payment/locking/arrival/merge behavior:
- Migration strategy and isolated database implications:
- Implementation steps and affected frontend/API contracts:
- Risks, default decisions, and genuinely unresolved blockers:

## Acceptance contract

Assign IDs (for example M2-01) to independently observable Given/When/Then scenarios. Include exact expected strengths, distances, costs, ownership, lock states, and prevented outcomes where relevant. Cover boundaries, competing submissions, persistence, and ruleset variation. Do not calculate expected results by copying the proposed implementation.

For each criterion identify a suitable verification layer and command. Include the orchestrator's independent spot checks and applicable quality gates.

## Handoff reports

Record reports in a separate reports/ directory so later fresh reviewers are not primed by previous conclusions. The orchestrator tracks those reports in run-state.md.

- Implementer: changed files, criterion-to-test mapping, commands/exit codes, known gaps.
- Tester: test changes, criteria covered, demonstrated defects/reproduction steps, commands/exit codes, test-only scope confirmation.
- Reviewer: full increment diff reviewed, actionable findings with file/line/impact and acceptance/ADR basis, or explicit no-findings verdict.
- Orchestrator: accepted plan version, report references, finding dispositions, exact verification evidence, final diff scope.
- Commit: produced only after all gates pass; record SHA in run-state.md after committing.

Findings are tracked by ID. A fix must identify the addressed findings and be revalidated. A passing report for an older diff does not approve a newer change.
