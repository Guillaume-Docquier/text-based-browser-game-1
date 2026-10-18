# pnpm Workspaces And Shared Railway Monorepo

## Status

Accepted

Supersedes [004-duplicated-tools-versions](./004-duplicated-tools-versions.md)

### Amendment history

- 2026-09-28: Included reusable workspace packages and aligned the code-sharing consequence of [ADR-007](./007-code-sharing.md).
- 2026-10-17: Moved Railway service configuration to project-level Infrastructure as Code under [ADR-034](./034-use-railway-infrastructure-as-code.md).

## Context

The repo was deployed as an isolated monorepo: Railway services used package-level roots, and each deployable package kept its own lockfile and tool version metadata. That made Railway work, but it duplicated install logic in CI and prevented Railway from using its shared JavaScript monorepo support.

Railway supports shared JavaScript monorepos and can run package-specific commands such as `pnpm --filter backend start` from the repository root.

With a pnpm monorepo, scripts are easier to use as well because we can run recursively from the root with `pnpm -r`, like `pnpm -r test`

## Decision

Use a root `pnpm-workspace.yaml` with deployable apps under `apps/` and reusable packages under `packages/`. Keep one root lockfile and install the whole workspace from the root.

Railway service configuration lives in `.railway/railway.ts`. Their build and start commands run through workspace filters.

## Consequences

CI installs dependencies once from the workspace root and runs package checks through root scripts.

Package-level `.nvmrc` and `packageManager` duplication is no longer needed for deployed packages because Railway builds from the shared monorepo root.

Workspace packages may share code between the apps. General utilities can still come from `@guillaume-docquier/tools-ts`.
