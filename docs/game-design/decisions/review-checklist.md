# GDDR Review Checklist

Use this checklist in Phase 3 to validate a GDDR before finalizing it. It reviews records written from `000-gddr-template.md`; do not add top-level sections just to satisfy a checklist item.

## Template fit

- [ ] The GDDR uses `Status`, `Context`, `Decision`, `Pros`, and `Cons`.
- [ ] There are no placeholder questions left from the template.
- [ ] The filename follows the `NNN-slug.md` convention.
- [ ] Important alternatives, boundaries, risks, and follow-up work fit inside the existing sections.

## Status

- [ ] The status clearly says whether the decision is planned or implemented.
- [ ] Deprecated or superseded decisions explain the replacement or reason.
- [ ] The status matches the actual state of the game, not only the desired future state.

## Context

- [ ] A reader can understand the game problem without prior context.
- [ ] The desired player experience or behavior is clear.
- [ ] Related implemented and planned mechanics are named.
- [ ] Relevant alternatives and tradeoffs are included when they explain the decision.
- [ ] Context describes the design problem before selling the solution.

## Decision

- [ ] The chosen mechanic or design rule is specific enough to guide future work.
- [ ] The decision explains what it allows players or the game to do.
- [ ] Scope boundaries and non-goals are clear when needed.
- [ ] The decision fits with related mechanics, or explicitly changes their relationship.

## Pros

- [ ] The positive effect on game depth is explained.
- [ ] The record identifies what becomes easier or more desirable.
- [ ] Pros are concrete and do not merely repeat the decision.

## Cons

- [ ] Constraints, risks, and harder or less desirable outcomes are concrete.
- [ ] Accepted risks and required follow-up work are clear.

## Index

- [ ] `README.md` is updated when the GDDR is created, implemented, deprecated, or superseded.
- [ ] The record is listed under the correct status section.
- [ ] Its summary and “Use when” guidance help future contributors find it.

## Quick scoring

Count unchecked items. This is a conversation tool, not a mechanical gate.

- **All checked**: ready to finalize.
- **One or two unchecked**: discuss the gaps with the human.
- **Three or more unchecked**: return to intent capture for the unclear areas.

## Common failure modes

| Symptom                                            | Root cause                         | Fix                                                          |
| -------------------------------------------------- | ---------------------------------- | ------------------------------------------------------------ |
| The record describes code but not the game problem | Implementation led the discussion  | Explain the intended player experience and mechanic first    |
| The decision is isolated from other mechanics      | Missing game context               | Name the mechanics it affects or depends on                  |
| Pros are stated without depth or tradeoffs         | Design is not yet refined          | Ask what strategic choices, constraints, or risks it creates |
| The planned design has no implementation path      | Scope is too broad                 | Identify the smallest useful first step and later work       |
| An agent created the record unprompted             | Human decision process was skipped | Ask the human whether the candidate deserves a GDDR          |
