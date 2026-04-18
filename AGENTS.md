# Repository Guidelines

## Project Structure

This repo is a lightweight monorepo with separate deployable projects:

- `frontend/`: React 19 + Vite UI. File-based routes live in `src/routes/`, shared UI in `src/design-system/`, static assets in `public/` and `src/assets/`.
- `backend/`: Express + tRPC API plus tick-processing code. API code lives in `src/api/`, tick-processing in `src/tick-processing/`, shared backend utilities in `src/lib/`, and DB schema/repositories in `src/lib/db/`.
- `shared/eslint/`: shared lint config only. Do not share runtime code between backend and frontend.
- `infra/`: deployment and reverse-proxy config.
- `adr/`: architecture decision records. Read the relevant ADRs before changing established patterns.

## Commands

- `pnpm project:setup`: setup all packages
- `pnpm project:checks`: sanitiy checks for all packages
- `pnpm lint:fix`: run ESLint.
- `pnpm format:fix`: run Prettier.
- `pnpm --dir frontend dev`: start the Vite frontend with watch mode.
- `pnpm --dir frontend build`: build the frontend.
- `pnpm --dir frontend typecheck`: frontend TypeScript check.
- `pnpm --dir backend dev`: run the backend with watch mode.
- `pnpm --dir backend start`: run the backend without watch mode.
- `pnpm --dir backend typecheck`: backend TypeScript check.
- `pnpm --dir backend db:generate --name <descriptive-migration-name>`: create a Drizzle migration. Always pass `--name`.
- `pnpm --dir backend db:migrate`: apply migrations.
- `pnpm --dir backend db:seed`: seed the database.

## Architecture Rules

These come from the ADRs and should be treated as default constraints, not suggestions:

- Never throw for expected errors. Return `Result` values instead. Wrap third-party calls that may throw with `Result.tryCatch`. Only fatal crash-the-process errors may throw.
- Use explicit `Assert` calls for invariants.
- No import side effects outside app entrypoints. Do not create stateful objects in module global scope; pass dependencies through arguments.
- Keep backend layering strict:
  - Routers are the only layer that knows about Express/tRPC.
  - Repositories are the only layer that knows about Drizzle/Postgres.
  - Controllers contain business logic between routers and repositories.
- Only dedicated service/repository boundaries may talk to third parties directly:
  - Clerk only in auth services.
  - Drizzle only in repositories.
- For tRPC routers, preserve the local factory pattern used for DI and type inference:
  - export `type TrpcRouter = ReturnType<typeof createTrpcRouter>`
  - create the router in a function, not in global scope
- Tick processing should stay decoupled from the web server so it can be extracted later. The web server may depend on worker code; worker code should not depend on the web server.
- Worker threads are intended to be long-lived. Do not introduce designs that repeatedly crash/spawn workers unless explicitly required.

## Shared Code

- Do not add new cross-project runtime sharing inside this monorepo unless there is already a clear established pattern for it.
- Shared utilities are intentionally published through `@guillaume-docquier/tools-ts` rather than imported from another local app/package.
- Shared TypeScript types between backend and frontend are acceptable when they are type-only and fit the existing tRPC setup.

## Coding Conventions

- TypeScript ESM
- Follow existing naming conventions:
  - React components: PascalCase files like `TextInput.tsx`
  - Utilities: camelCase files like `timeAgo.ts`
  - Route files: TanStack Router naming like `games.$gameId.tsx`
- Backend code relies on `erasableSyntaxOnly`, so do not use TypeScript `enum` in the backend. Use `as const` objects plus derived union types, following `backend/src/lib/gameResources.ts`.

## Testing And Verification

There is no dedicated test runner configured yet. Minimum verification for meaningful changes:

- `pnpm lint`
- `pnpm --dir frontend typecheck`
- `pnpm --dir backend typecheck`
- relevant manual verification for the area changed

## Commits And PRs

- Husky enforces scoped commit prefixes: `project:`, `frontend:`, `backend:`, `ci:`, `adr:`, `infra:`.
- Pre-commit runs `pnpm lint-staged`, so keep changes focused.
- If a change affects schema, env usage, or deployment behavior, call that out explicitly in the PR.

## Env Vars

Never change environment variable values yourself. Ask the user to do it, and suggest the required change if needed.
