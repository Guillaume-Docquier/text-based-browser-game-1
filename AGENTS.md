# Repository Guidelines For AI Agents

## Project Structure And Tech Stack

This repo is a TypeScript monorepo using pnpm workspaces (ADR-014) with separate deployable projects:

- `frontend/`: React 19 + TailwindCSS 4 + Shadcn + Vite 8 UI. File-based TanStack route definitions live in `src/routes/`, page/layout implementations live in `src/features/`, reusable Shadcn components and shared UI live in `src/components/`, and static assets live in `public/` and `src/assets/`.
- `backend/`: Express 5 + tRPC 11 API + tick-processing worker in TypeScript with no transpilation. API code lives in `src/api/`, tick-processing in `src/tick-processing/`, shared backend utilities in `src/lib/`, and DB schema/repositories in `src/lib/db/`.
- `shared/eslint/`: shared lint config only. Do not share runtime code between backend and frontend.
- `infra/`: deployment and reverse-proxy config.
- `docs/`: all project documentation. It includes past, present, and future tech/game designs, adrs, etc.
- `docs/adr/`: architecture decision records. Read the relevant ADRs before changing established patterns.

We use the `@guillaume-docquier/tools-ts` npm package, a small TypeScript library of utilities made by us.

## Agent skills

### Issue tracker

Issues and PRDs are tracked in GitHub Issues using the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

Use the default Matt Pocock skills triage labels without renaming. See `docs/agents/triage-labels.md`.

### Domain docs

This repo uses a single-context domain-doc layout: root `CONTEXT.md` when present, plus `docs/adr/`. See `docs/agents/domain.md`.

## Commands

Always use pnpm, never use npm.

- `pnpm i`: install node_modules for all packages.
- `pnpm checks`: runs all quality checks (lint, format, typecheck, test) on all packages.
- `pnpm --filter frontend build`: build the frontend.
- `pnpm --filter frontend checks`: run all frontend quality checks (typecheck).
- `pnpm --filter backend checks`: run all backend quality checks (typecheck, test).
- `pnpm --filter backend db:generate --name <descriptive-migration-name>`: create a Drizzle migration. Always pass `--name`.
- `pnpm --filter backend db:migrate`: apply migrations.
- `pnpm --filter backend db:seed`: seed the database.

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
- ADR-017: Use stubs when creating any data in tests. Create the stub if it doesn't exist. Use mocks for third parties that are hard to control.
- ADR-018: Assert the whole Result object in tests, not its individual properties. `expect(result).toEqual(Result.Success(expectedValue))`
- ADR-019: Do not leave expected invariants implicit, use explicit `Assert` calls.
- ADR-020: Frontend Tanstack routes should only do the routing. The UI is implemented in `frontend/src/features/` in vertical slices.

## Coding Conventions

- TypeScript ESM
- Prefer inline exports on declarations such as `export function foo()` or `export const bar = ...` instead of collecting exports in a bottom-of-file export block.
- Follow existing naming conventions:
  - React components and feature pages: PascalCase files like `TextInput.tsx`
  - Utilities: camelCase files like `timeAgo.ts`
  - Route files: TanStack Router flat-file naming like `_site.games.$gameId.tsx` or `_game.games.$gameId.play.tsx`
- Backend code relies on `erasableSyntaxOnly`, so do not use TypeScript `enum` in the backend. Use `as const` objects plus derived union types, following `backend/src/lib/gameResources.ts`.
- Do not create shared utility/helper files or folders. Create dedicated files with actual names instead of generic files.

## Testing

We test the production code. We do not use `vitest.mock()`.

We prefer end-to-end or integration tests. We use unit tests sparingly for complicated code (algorithms, high-performance code, etc.)

## Verification

Minimum verification for meaningful changes:

- `pnpm checks` (when touching all projects)
- `pnpm --filter backend checks` (when touching only backend)
- `pnpm --filter frontend checks` (when touching only frontend)
- Call out relevant extra manual verification that the user should perform for the area changed

## Commits And PRs

- Husky enforces scoped commit prefixes: `project:`, `frontend:`, `backend:`, `ci:`, `adr:`, `infra:`, `docs:`.
- Pre-commit runs `pnpm lint-staged`, for linting and formatting
- If a change affects schema, env usage, or deployment behavior, call that out explicitly in the PR.

## Env Vars

Never change environment variable values yourself. Ask the user to do it, and suggest the required change if needed.
