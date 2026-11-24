# Propose, draft, or amend an ADR

## Propose a decision

Consider a new ADR for a durable rule about dependencies, architecture, APIs, infrastructure, or testing. A candidate should guide future work and capture a tradeoff that matters beyond the current change. A new dependency or test pattern can prompt this check. Routine implementation choices, bug fixes, and conventions already enforced by tooling belong in their existing sources.

Before drafting, inspect the relevant packages, contracts, schemas, tests, or infrastructure. Explain the candidate decision and its durable effect, then ask the human whether to record it if they have yet to request an ADR.

## Confirm intent and draft the record

Use `000-adr-template.md` in the architecture decisions directory. Gather enough information to explain what prompted the decision, what constraints apply, which alternatives were considered, why the chosen rule applies, and what gets easier or harder. Ask only about material gaps, one question at a time. Confirm the decision, scope, rationale, and tradeoffs with the human before drafting.

1. Assign the next unused number in the `NNN-slug.md` format. Check both active records and the `deprecated/` directory. Use the decision title as the filename slug, in lowercase with words separated by hyphens. If the title changes, rename the file to match, keep its number, and update the index and links.
2. Use `Proposed` until the human accepts the decision, then use `Accepted`.
3. In `Context`, explain the problem, relevant constraints, and any alternatives that help explain the choice.
4. In `Decision`, state the rule, its scope, and any exceptions that affect how contributors apply it.
5. In `Consequences`, describe the concrete benefits, costs, risks, and any required follow-up at the architecture level. Keep options and other supporting information inside the template sections. Remove all placeholders.

Review the draft with [review-checklist.md](review-checklist.md). Fix editorial gaps directly. Return unresolved decision questions to the human before finalizing the record.

## Amend or change the status of a record

Edit proposed records directly. For a material refinement to an accepted decision or a change to its status, add an `### Amendment history` subsection directly after the status if needed. Append a chronological entry dated `YYYY-MM-DD` that explains what changed and why. Update the affected sections so readers can find the current rule in the record body.

When a new decision replaces or reverses an accepted one, write a new ADR, mark the old one `Superseded`, and link the records in both directions. Explain the reason and any replacement when deprecating a decision.

Keep proposed and accepted records in the architecture decisions directory. Move rejected, deprecated, and superseded records to its `deprecated/` directory, keeping their filenames. Update incoming and outgoing links affected by a move. Update the architecture decisions index when an ADR is accepted, rejected, deprecated, superseded, or changes when contributors should consult it. Keep historical entries in the index.
