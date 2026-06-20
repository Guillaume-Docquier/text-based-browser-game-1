# Cosmic Supremacy

This project is a multiplayer browser strategy game played at a pace of 1 turn a day for a few months.

The goal is to build a game that's as fun as persistent browser games, but that doesn't reward being the most active player.

See @GLOSSARY.md for useful term definitions.

## Current status

The project is only getting started, and we are building strong foundations. We've built the infrastructure, deployed on Railway, established the tech that we will use, and developed testing strategies for the backend.

Code quality and architecture design choices matter more than speed of execution.

We have 0 users. When dealing with database schema changes, we never need to backfill. We can always reset the db.

## Project Structure And Tech Stack

This repo is a TypeScript monorepo using pnpm workspaces (ADR-014) with separate deployable projects:

- `frontend/`: React 19 + TailwindCSS 4 + Shadcn + Vite 8 UI. File-based TanStack route definitions live in `src/routes/`, page/layout implementations live in `src/features/`, reusable Shadcn components and shared UI live in `src/components/`, and static assets live in `public/` and `src/assets/`.
- `backend/`: Express 5 + tRPC 11 API + tick-processing worker in TypeScript with no transpilation. API code lives in `src/api/`, tick-processing in `src/tick-processing/`, shared backend utilities in `src/lib/`, and DB schema/repositories in `src/lib/db/`.
- `infra/`: deployment and reverse-proxy config.
- `docs/`: all project documentation. It includes past, present, and future tech/game designs, adrs, etc.
- `docs/adr/`: architecture decision records. Read the relevant ADRs before changing established patterns.

Leverage the `@guillaume-docquier/tools-ts` npm package as much as possible. This is a TypeScript library of utilities made by us. Their README.md contains a high-level view of the available utilities.

We use oxfmt for formatting and oxlint for type-aware linting. They are configured at the root of the project.

## Architecture Rules

The below rules are derived from `docs/adr/`. When applying the concepts, you should read the related ADR for more context.

- ADR-006: Only dedicated service/repository boundaries may talk to third parties directly:
  - Clerk only in auth services.
  - Drizzle only in repositories.
- ADR-007: The only allowed shared code between backend and frontend are the tRPC router types from `backend/src/api/types`.
- ADR-008: No import side effects outside app entry points. Do not create stateful objects in the module global scope; pass dependencies through arguments.
  - For tRPC routers, preserve the local factory pattern used for DI and type inference:
    - export `type TrpcRouter = ReturnType<typeof createTrpcRouter>`
    - create the router in a function, not in global scope
- ADR-009: Always write return types, except for tRPC and Tanstack Router, since they are built to leverage inference.
- ADR-010: Keep backend layering strict:
  - Routers are the only layer that knows about Express/tRPC.
  - Repositories are the only layer that knows about Drizzle/Postgres. They never contain zod schemas. They export WriteModel and ReadModel types.
  - Controllers contain business logic between routers and repositories. They export DTO zod schemas and types.
  - Controllers can have access to a `tx` object through `createTransaction` but should only pass it to repositories, never use it to query/write to db. This abstraction leakage is because Drizzle transactions have the same API as db objects.
- ADR-011: Tick processing should stay decoupled from the web server so it can be extracted later. The web server may depend on worker code; worker code should not depend on the web server.
- ADR-013: Never throw for expected errors. Return `Result` values instead. Wrap third-party calls that may throw with `Result.tryCatch`. Only fatal crash-the-process errors may be thrown.
- ADR-015: Use Zod for parsing, not validation. Do not use zod functions that cannot translate to TypeScript types. `.int()`, `.email()`, most `.refine()`, etc are forbidden.
- ADR-016: Use repositories in tests, not the db. The db can only be used in repository tests since it is a direct dependency.
- ADR-017: Use stubs when creating any data in tests. Create the stub if it doesn't exist in a file next to the type for discovery and reusability. Use mocks for third parties that are hard to control.
- ADR-018: Assert the whole Result object in tests, not its individual properties. `expect(result).toEqual(Result.Success(expectedValue))`
- ADR-019: Do not leave expected invariants implicit, use explicit `Assert` calls.
- ADR-020: Frontend Tanstack routes should only do the routing. The UI is implemented in `frontend/src/features/` in vertical slices.
- ADR-021: All Typescript schema column names should be `camelCased` but renamed to `snake_cased` for postgres via the `name` argument of column builders.

## Coding Conventions

- TypeScript ESM
- Prefer inline exports on declarations such as `export function foo()` or `export const bar = ...` instead of collecting exports in a bottom-of-file export block.
- Follow existing naming conventions:
  - React components and feature pages: PascalCase files like `TextInput.tsx`
  - Utilities: camelCase files like `timeAgo.ts`
  - Route files: TanStack Router flat-file naming like `_site.games.$gameId.tsx` or `_game.games.$gameId.play.tsx`
- Backend code relies on `erasableSyntaxOnly`, so do not use TypeScript `enum` in the backend. Use `as const` objects and the `Enumify` type helper to create the enum type.
- Do not create shared utility/helper files or folders. Create dedicated files with actual names instead of generic files.
- When importing a value and a type of the same name from the same package (e.g `Range` or `Result`), just import the value. Do not import the type to rename it.

## Drizzle Gotchas

- Do not call `tx.rollback()`. It throws at runtime, but TypeScript does not know that, so it breaks control-flow narrowing. Throw `new TransactionRollback(...)` from `backend/src/lib/errors.ts` instead.
- Do not return results from transactions. Throw `TransactionRollback` to abort the transaction, or return the value directly.

## Commands

Always use pnpm, never use npm.

- `pnpm i`: install node_modules for all packages.
- `pnpm checks`: runs all quality checks (lint, format, typecheck, test) on all packages.
- `pnpm --filter frontend build`: build the frontend.
- `pnpm --filter frontend checks`: run all frontend quality checks (typecheck).
- `pnpm --filter backend checks`: run all backend quality checks (typecheck, test).
- `pnpm --filter backend db:generate --name <descriptive-migration-name>`: create a Drizzle migration. Always pass `--name`.

## Testing

We test the production code. We do not use `vitest.mock()`.

We prefer end-to-end or integration tests. We use unit tests sparingly for complex scenarios (algorithm verification, validating race conditions, regression tests, etc.)

For example, backend tests should test through the API. Some repository tests can be useful when we want to validate that transactions behave the way we want. We shouldn't be testing basic table mutation or query, that's done via the API.

## Verification

Minimum verification for meaningful changes:

- `pnpm checks` (when touching all projects)
- `pnpm --filter backend checks` (when touching only backend)
- `pnpm --filter frontend checks` (when touching only frontend)
- Do not start Vite or attempt visual/browser verification. The project is not set up for agent-driven visual verification yet.
- Call out relevant extra manual verification that the user should perform for the area changed

## Commits And PRs

- Husky enforces scoped commit prefixes: `project:`, `frontend:`, `backend:`, `ci:`, `adr:`, `infra:`, `docs:`.
- Pre-commit runs `pnpm lint-staged`, for linting and formatting
- If a change affects schema, env usage, or deployment behavior, call that out explicitly in the PR.

## Env Vars

Never change environment variable values yourself. Ask the user to do it, and suggest the required change if needed.

## Source Code Reference

Source code for dependencies is cached at `~/.opensrc/`.

Use `opensrc path` inside other commands to read source:

```bash
rg "pattern" $(opensrc path <package>)
cat $(opensrc path <package>)/path/to/file
```
