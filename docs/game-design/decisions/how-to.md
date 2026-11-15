# How to write Game Design Decision Records (GDDR)

GDDRs capture durable decisions about the game's philosophy and mechanics. Keep them short. Temporary prototype experiments, balance changes, and implementation details do not need a GDDR.

If game balance or implementation details would make a GDDR inaccurate, then the GDDR contains details it should not. Those details should be reworded to be more generic, or removed.

## Creating a GDDR

GDDRs are human-initiated. Agents must get explicit human approval before creating one.

1. Read the [index](README.md) and relevant decisions.
2. Use [000-gddr-template.md](000-gddr-template.md) with the next `NNN-slug.md` filename.
3. Explain the problem in `Context`, the chosen direction in `Decision`, and the main benefits and tradeoffs in `Pros` and `Cons`.
4. Check that the record matches the human's decision, has no placeholders, and identifies any conflict with accepted decisions for human review.
5. Add the record to the index under its status with a short summary and useful routing guidance.

## Statuses

- `Accepted`: the decision guides game design.
- `Rejected`: the decision was considered and declined.
- `Deprecated`: the decision no longer applies.
- `Superseded`: another decision replaces it; link the replacement.

Statuses describe design decisions. Implementation progress does not change them.

## Updating a GDDR

Keep changes in the existing template sections. Explain why a decision is rejected, deprecated, or superseded. When replacing a decision, link both records and obtain human approval before creating the replacement.

Update the index whenever a record is added or its status, summary, or relevant design areas change.
