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

| Directory                    | Description                                                                                                        |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| frontend/                    | The web application.                                                                                               |
| backend/src/api/             | The api for the frontend.                                                                                          |
| backend/src/turn-processing/ | The turn processing engine.                                                                                        |
| infra/                       | The IaC for 3rd parties that we use.                                                                               |
| docs/                        | Detailed project documentation. Repository-level guidance also lives in README.md, CONTRIBUTING.md, and AGENTS.md. |

### Dependencies

```
frontend/ ───api-types───▶ backend/src/api/ ───actions-validation───▶ backend/src/turn-processing/
```

There are no other allowed dependencies.

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

- `pnpm i`: install node_modules for all packages.
- `pnpm checks`: runs all quality checks (lint:fix, format:fix, typecheck, build, tests, etc) on all packages.

When formatting the code, always run oxfmt with write. oxfmt is deterministic, there's no point in checking before applying formatting.

## Verification

Minimum verification for meaningful changes:

- `pnpm checks` (when touching all projects)
- Use the scoped command in the nearest `AGENTS.md` when touching only one project.
- Do not start Vite/Storybook for the user or attempt visual/browser verification. The project is not set up for agent-driven visual verification yet, and the user knows how to start the app.
- Call out relevant extra manual verification that the user should perform for the area changed

## Commits And PRs

- Never commit, push, or open a pull request unless the human explicitly asks for it. A request to change code or tests does not imply permission to commit, push, or open a PR.
- When asked to open a PR, always respect the PR template defined in the repository.
- Pre-commit runs `pnpm lint-staged`, for linting and formatting
- If a change affects schema, env usage, or deployment behavior, call that out explicitly in the PR.

## Env Vars

Every service parses env vars via a zod schema very early at boot. This serves as documentation for the required env vars and as validation that the application has all the configuration needed.

Never change environment variable values yourself. Ask the user to do it, and suggest the required change if needed.

## `@guillaume-docquier/tools-ts` Gotchas

- When importing a value and a type of the same name from the same package (e.g `Range` or `Result`), just import the value. Do not import the type to rename it.
- Prefer the specialized `Range.float({ min, max })` and `Range.integer({ min, max })` constructors over `Range.create` whenever possible.
