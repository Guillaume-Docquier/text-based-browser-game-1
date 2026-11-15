# Documentation Instructions

Use [README.md](README.md) to find the smallest relevant documentation set. Do not read every document by default; verify documentation claims against live code.

Keep documentation concise and routed rather than duplicating rules. Update `glossary.md` when introducing project vocabulary with a specific meaning.

## Verification

- Run oxfmt with write on changed documentation files.
- Run `git diff --check`.
- Do not run other checks when editing only the documentation.

## Architecture Decision Records

ADRs live in `architecture/decisions/` and capture durable architecture decisions.

- Read the index and relevant accepted ADRs before changing architecture, dependencies, API design, infrastructure, or established patterns.
- Follow accepted decisions and their implementation patterns.
- If code and an accepted ADR disagree, flag the mismatch before changing direction.
- Follow `architecture/decisions/how-to.md` when proposing, creating, or updating an ADR.

## Game Design Decision Records

GDDRs live in `game-design/decisions/` and capture durable game philosophy and mechanics.

- GDDRs are human-initiated. Explain a candidate's durable impact and ask the human before creating one.
- Read and follow relevant accepted GDDRs before gameplay work.
- GDDR statuses describe design decisions. Implementation changes do not change their status.
- If implementation differs from an accepted decision, discuss the mismatch with the human before changing the record or game direction.
- Follow `game-design/decisions/how-to.md` when proposing, creating, or updating a GDDR.
