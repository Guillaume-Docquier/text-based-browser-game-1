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

| Directory                    | Description                                                                                |
| ---------------------------- | ------------------------------------------------------------------------------------------ |
| frontend/                    | The web application.                                                                       |
| backend/src/api/             | The api for the frontend.                                                                  |
| backend/src/tick-processing/ | The tick processing engine.                                                                |
| infra/                       | The IaC for 3rd parties that we use.                                                       |
| docs/                        | All the documentation for the project. There is no documentation in the other directories. |

### Dependencies

```
frontend/ ───api-types───▶ backend/src/api/ ───orders-validation───▶ backend/src/tick-processing/
```

There are no other allowed dependencies.

Note: The orders validation code doesn't yet exist, but soon will.

### CI/CD

All code changes require a pull request before merging to main. A CI enforces the quality gates there.

All merges to main are automatically deployed to Railway based on which files changed.

## Tech Stack

We use:

- pnpm to manage the pnpm (11) and node (24) versions
- oxfmt for formatting
- oxlint for linting
- typescript 7 (dev, soon rc)

### @guillaume-docquier/tools-ts

Leverage the `@guillaume-docquier/tools-ts` npm package as much as possible. This is a TypeScript library of utilities made by us. Their README.md contains a high-level view of the available utilities, read it.

### Frontend

We use:

- React 19 with compiler
- TailwindCSS 4
- Tanstack Router
- Shadcn
- Clerk auth
- Vite 8
- Playwright
- Storybook

Key Directories:

| Directory               | Description                                                                                                        |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------ |
| frontend/src/routes     | All the tanstack routes using file based routing. Imports pages from frontend/src/features.                        |
| frontend/src/features   | Vertical slices for all features in the app.                                                                       |
| frontend/src/components | Shared components, aka the design system.                                                                          |
| frontend/src/lib/api    | API client and hooks to use it live here. Calling code doesn't even know we use trpc in the backend + react query. |
| frontend/.storybook     | Configuration for storybook. We use storybook to inspect the design system. stories live next to their components. |
| frontend/playwright     | All e2e tests. We use POM and integrate clerk auth in the tests.                                                   |

### Backend API

We use:

- Express 5
- tRPC 11
- drizzle + postgres
- Clerk auth
- Vitest 4
- pglite for in memory db during integration tests

Key Directories:

| Directory       | Description                                                                        |
| --------------- | ---------------------------------------------------------------------------------- |
| backend/src/api | All code for the API organized by vertical slices of router-controller-repository. |
| backend/src/lib | Shared code between API and tick processing, mostly DB schemas.                    |

There is no build for the backend, we run TypeScript natively on node 24+. This means we require isolated modules and cannot use certain features like enums or decorators.

### Backend Tick Processing

The tick processing module runs in a TypeScript worker hosted by the API process.

It runs there for simplicity of deployment, but is designed to be isolated so we can scale the number of workers, or extract the workers into its own runtime, or even re-write in another language.

The code is in `backend/src/tick-processing` and runs TypeScript natively on node 24+ just like the API.

## Coding standards

Read `docs/typescript-coding-standards.md` to properly follow coding standards.

## Glossary

Read `docs/glossary.md` for common terms with specific meaning in this project. When introducing new vocabulary, update the glossary.

## Architecture Decision Records (ADRs)

This repo uses ADRs in `docs/adr/` to capture important architecture decisions. Before making changes that touch architecture (new dependencies, new patterns, API design, infrastructure), check existing ADRs:

1. Read `docs/adr/README.md` for the index of decisions.
2. Read any accepted ADRs relevant to your area of work. Follow the decisions and implementation patterns they specify.
3. If you encounter a pattern in the code and wonder "why is it done this way?", check whether an ADR explains it.
4. If your work would contradict an existing accepted ADR, stop and discuss with the human before proceeding.

To propose or create a new ADR, follow `docs/adr/how-to.md`

## Commands

Always use pnpm, never use npm.

- `pnpm i`: install node_modules for all packages.
- `pnpm checks`: runs all quality checks (lint, format, typecheck, test) on all packages.
- `pnpm integration`: run local backend integration tests.
- `pnpm e2e`: run local E2E tests.
- `pnpm --filter frontend checks`: run all frontend quality checks (typecheck, build, e2e).
- `pnpm --filter backend checks`: run all backend quality checks (typecheck, integration).
- `pnpm --filter backend db:generate --name <descriptive-migration-name>`: create a Drizzle migration. Always pass `--name`.

When formatting the code, always run oxfmt with write. oxfmt is deterministic, there's no point in checking before applying formatting.

## Testing

We test the production code. We do not use `vitest.mock()`.

We prefer end-to-end and integration tests. We use unit tests sparingly for complex scenarios (algorithm verification, validating race conditions, regression tests, etc.)

Optimize assertions for useful failure output: compare semantic values instead of opaque IDs, sort unordered collections before comparison, keep test setup control flow straightforward, etc.

Do not reimplement the logic in the test to create the expected result. Be explicit and create the expected state by hand instead of computing it. This is often more code, but it avoids encoding bugs in the test.

## Verification

Minimum verification for meaningful changes:

- `pnpm checks` (when touching all projects)
- `pnpm --filter backend checks` (when touching only backend)
- `pnpm --filter frontend checks` (when touching only frontend)
- Do not start Vite/Storybook for the user or attempt visual/browser verification. The project is not set up for agent-driven visual verification yet, and the user knows how to start the app.
- Call out relevant extra manual verification that the user should perform for the area changed

## Commits And PRs

- Never commit, push, or open a pull request unless the human explicitly asks for it. A request to change code or tests does not imply permission to commit, push, or open a PR.
- Pre-commit runs `pnpm lint-staged`, for linting and formatting
- If a change affects schema, env usage, or deployment behavior, call that out explicitly in the PR.

## Env Vars

Every service parses env vars via a zod schema very early at boot. This serves as documentation for the required env vars and as validation that the application has all the configuration needed.

Never change environment variable values yourself. Ask the user to do it, and suggest the required change if needed.

## React Gotchas

- React Compiler is enabled. You probably don't need that `useMemo` or `useCallback`. Use them only when the compiler cannot do it for you.
- Extract repeated or complex JSX into local components, even when they stay in the same file.

## Drizzle Gotchas

- Do not call `tx.rollback()`. It throws at runtime, but TypeScript does not know that, so it breaks control-flow narrowing. Throw `new TransactionRollback(...)` from `backend/src/lib/errors.ts` instead.
- Do not return results from transactions. Throw `TransactionRollback` to abort the transaction, or return the value directly.
- Do not add `runInTransaction` helpers or otherwise flatten nested transaction calls. Drizzle supports transactions inside transactions. If a method must run inside an existing transaction, type its argument as a transaction; otherwise let the method create a transaction for its own unit of work.

## `@guillaume-docquier/tools-ts` Gotchas

- When importing a value and a type of the same name from the same package (e.g `Range` or `Result`), just import the value. Do not import the type to rename it.
- Prefer the specialized `Range.float({ min, max })` and `Range.integer({ min, max })` constructors over `Range.create` whenever possible.
