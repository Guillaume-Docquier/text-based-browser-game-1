# Cosmic Empires

Cosmic Empires is a multiplayer turn based space strategy game where games span over weeks or months.

The goal is to build a game that's as fun as persistent browser games, but that are finite and don't reward being the most active player.

## Current status

The project is only getting started, and we are focused on building strong foundations. We've built the infrastructure, deployed on Railway, established the tech that we will use, and developed testing strategies.

Code quality and architecture design choices matter more than speed of execution.

We have 0 users. When dealing with database schema changes, we never need to backfill. We can always reset the db.

## Project Structure

This is a TypeScript monorepo using pnpm workspaces.

### Key Directories

| Directory                         | Description                                                                                                        |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| apps/frontend/                    | The web application.                                                                                               |
| apps/backend/src/api/             | The API for the frontend.                                                                                          |
| apps/backend/src/turn-processing/ | The turn processing engine.                                                                                        |
| packages/                         | Workspace packages reusable by the apps.                                                                           |
| infra/                            | The IaC for 3rd parties that we use.                                                                               |
| docs/                             | Detailed project documentation. Repository-level guidance also lives in README.md, CONTRIBUTING.md, and AGENTS.md. |

### Dependencies

```
apps/frontend/ ──▶ packages/ ◀── apps/backend/
apps/frontend/ ──type-only API contracts──▶ apps/backend/src/api/types.ts
apps/backend/src/api/ ───▶ apps/backend/src/turn-processing/
```

Across workspace projects, runtime imports from the apps may only target shared packages. The frontend may import backend API contract types through `@api-types` with `import type`; it must not import backend runtime code or other backend modules. The backend must not import from the frontend, and shared packages must not import from either app, including type-only imports.

## Scoped Instructions

Before changing files in a subtree, read the nearest `AGENTS.md` in that subtree.

### CI/CD

All code changes require a pull request before merging to main. A CI enforces the quality gates there.

All merges to main are automatically deployed to Railway based on which files changed.

## Tech Stack

We use:

- pnpm to manage the pnpm and node versions (via packageJson.devEngines)
- oxfmt for formatting
- oxlint for linting
- typescript 7

### @guillaume-docquier/tools-ts

Leverage the `@guillaume-docquier/tools-ts` npm package as much as possible. This is a TypeScript library of utilities made by us. Their README.md contains a high-level view of the available utilities, read it.

## Documentation

- Read `docs/typescript-coding-standards.md` before writing TypeScript.
- Read `docs/glossary.md` for project-specific terms. Update it when introducing new vocabulary.
- Before changing architecture, read the ADR index and relevant accepted ADRs. Stop and discuss any contradiction with the human.
- Before implementing gameplay, read the relevant GDDRs and game Systems. Keep their implementation status and indexes synchronized with live behavior, and flag design mismatches before changing direction.
- New GDDRs and game Systems require explicit human approval. Follow `docs/AGENTS.md` when editing documentation.

## Commands

Always use pnpm, never use npm.

When formatting the code, always run oxfmt with write. oxfmt is deterministic, there's no point in checking before applying formatting.

If the database container is not running, call `pnpm db:up`

## Commits And PRs

- Never commit, push, or open a pull request unless the human explicitly asks for it. A request to change code or tests does not imply permission to commit, push, or open a PR.
- Pre-commit runs `pnpm lint-staged`, for linting and formatting

## Env Vars

Every service parses env vars via a zod schema very early at boot. This serves as documentation for the required env vars and as validation that the application has all the configuration needed.

Never change environment variable values yourself. Ask the user to do it, and suggest the required change if needed.

## `@guillaume-docquier/tools-ts` Gotchas

- When importing a value and a type of the same name from the same package (e.g `Range` or `Result`), just import the value. Do not import the type to rename it.
- Prefer the specialized `Range.float({ min, max })` and `Range.integer({ min, max })` constructors over `Range.create` whenever possible.
