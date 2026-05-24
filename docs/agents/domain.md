# Domain Docs

This repo uses a single-context domain-doc layout.

## Before exploring, read these

- `CONTEXT.md` at the repo root, if it exists.
- `docs/adr/` for decisions that touch the area being changed.
- Relevant docs under `docs/` for current product, game, and architecture context.

If `CONTEXT.md` does not exist, proceed silently. Do not suggest creating it upfront. The producer skill (`/grill-with-docs`) creates it lazily when terms or decisions get resolved.

## Consumer rules

Use the vocabulary from `CONTEXT.md` when naming domain concepts in issues, plans, tests, and refactor proposals.

If a needed concept is missing from the glossary, either reconsider whether the project uses that language or note the gap for `/grill-with-docs`.

If your output contradicts an ADR, surface that conflict explicitly instead of silently overriding it.
