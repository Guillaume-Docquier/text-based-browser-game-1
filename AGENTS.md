# Repository Guidelines

## Project Structure & Module Organization

This repository is a lightweight monorepo with deployable projects by folder:

- `frontend/`: React 19 + Vite UI, file-based routes in `src/routes/`, shared UI in `src/design-system/`, static assets in `public/` and `src/assets/`.
- `backend/`: Express + tRPC API and tick-processing logic. API code lives in `src/api/`, shared backend utilities in `src/lib/`, database schema and repositories under `src/lib/db/`, and seed scripts in `scripts/db/`.
- `shared/eslint/`: shared ESLint presets used across the repo.
- `infra/`: deployment and reverse-proxy config.
- `adr/`: architecture decision records; read these before changing core patterns.

## Build, Test, and Development Commands

- `pnpm lint:fix`: run ESLint across the repo and apply automatic fixes.
- `pnpm format:fix`: apply Prettier fixes and sort package manifests.
- `pnpm --dir frontend dev`: start the Vite frontend locally in watch mode.
- `pnpm --dir frontend build`: produce the frontend production build.
- `pnpm --dir backend dev`: run the backend with `node --watch` and `.env`.
- `pnpm --dir backend typecheck` / `pnpm --dir frontend typecheck`: run TypeScript checks.
- `pnpm --dir backend db:generate`, `db:migrate`, `db:seed`: manage Drizzle migrations and seed data.

## Coding Style & Naming Conventions

TypeScript ESM is the default. Prettier enforces `semi: false` and a `printWidth` of 140. Use the existing folder conventions: React components in PascalCase files (`TextInput.tsx`), utilities in camelCase (`timeAgo.ts`), and route files following TanStack Router patterns (`games.$gameId.tsx`).

Avoid import side effects and global shared state; backend code favors DI and separation between routers, controllers, and repositories.

Never throw. Return errors as values with Result. Wrap third party calls that can throw with Result.tryCatch. See @adr/013-never-throw.md

Use explicit Assert for invariants.

## Testing Guidelines

There is no dedicated test runner configured yet. Until one is added, contributors should treat `pnpm lint`, both `typecheck` commands, and relevant manual verification as the minimum quality gate.

## Commit & Pull Request Guidelines

Husky enforces scoped commit prefixes: `project:`, `frontend:`, `backend:`, `ci:`, `adr:`, or `infra:`. Example: `backend: rollback failed transactions in repositories`. Pre-commit runs `pnpm lint-staged`, so keep commits focused. PRs should include a short description, note any env or migration changes, link the related issue when applicable, and attach screenshots for visible frontend changes.
