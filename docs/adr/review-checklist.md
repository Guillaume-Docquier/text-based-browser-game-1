# ADR Review Checklist

Use this checklist in Phase 3 to validate an ADR before finalizing it.

The checklist reviews ADRs written from `docs/adr/000-adr-template.md`. Do not add new top-level template sections just to satisfy a checklist item.

## Template Fit

- [ ] The ADR uses the repo template sections: `Status`, `Context`, `Decision`, and `Consequences`.
- [ ] Any options, rejected alternatives, non-goals, risks, or follow-up work are captured inside those sections.
- [ ] There are no placeholder questions left from the template.
- [ ] The filename follows the existing `NNN-slug.md` convention.

## Status

- [ ] Status is set correctly.
- [ ] Superseded, deprecated, or rejected ADRs explain the replacement or reason.
- [ ] Links to related ADRs are included when they affect the decision.

## Context

- [ ] A reader with no prior context can understand why this decision exists.
- [ ] The trigger is clear: what changed, broke, or is about to break.
- [ ] Relevant constraints are explicit.
- [ ] Important existing ADRs, code patterns, dependencies, or operational facts are named.
- [ ] Alternatives or rejected options are included when they explain the decision.
- [ ] Context describes the problem before selling the solution.

## Decision

- [ ] The decision is specific enough to act on.
- [ ] The scope is bounded.
- [ ] Important non-goals are stated when omitting them would cause confusion.
- [ ] The decision does not contradict accepted ADRs unless it explicitly supersedes them.
- [ ] The wording tells future contributors what to do differently.

## Consequences

- [ ] Consequences are concrete, not aspirational.
- [ ] Both benefits and costs are represented.
- [ ] Risks are either mitigated or explicitly accepted.
- [ ] Required follow-up work is called out.
- [ ] Consequences are not just a restatement of the decision.

## Index

- [ ] `docs/adr/README.md` is updated if the ADR is accepted, deprecated, superseded, or changes how contributors should find decisions.
- [ ] The index entry summarizes the decision, not the whole ADR.
- [ ] The "Use when" guidance points contributors to the ADR at the right time.

## Quick Scoring

Count the unchecked items. This is a conversation tool, not a mechanical gate.

- **All checked**: Ship it.
- **1-2 unchecked**: Discuss the gaps with the human. Most can be fixed quickly.
- **3+ unchecked**: The ADR needs more work. Return to Phase 1 for the fuzzy areas.

## Common Failure Modes

| Symptom                                       | Root Cause               | Fix                                                       |
| --------------------------------------------- | ------------------------ | --------------------------------------------------------- |
| The ADR adds `Options` as a top-level section | Imported template habits | Fold the useful comparison into `Context` or `Decision`   |
| Only one option is discussed                  | Decision is post-hoc     | Ask what was rejected and why, then capture the reasoning |
| Context reads like a solution pitch           | Skipped problem framing  | Move the solution to `Decision`                           |
| Consequences are all positive                 | Costs were not discussed | Ask what gets harder or more constrained                  |
| "Use X" with no why                           | Missing tradeoff         | Ask why X over the realistic alternative                  |
| Index entry repeats the full ADR              | Summary is too broad     | Keep the index focused on when to consult the ADR         |
