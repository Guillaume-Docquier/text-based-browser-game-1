# pnpm Workspaces And Shared Railway Monorepo

## Status

Accepted

Supersedes [004-duplicated-tools-versions](./004-duplicated-tools-versions.md)

## Context

The repo was deployed as an isolated monorepo: Railway services used package-level roots, and each deployable package kept its own lockfile and tool version metadata. That made Railway work, but it duplicated install logic in CI and prevented Railway from using its shared JavaScript monorepo support.

Railway supports shared JavaScript monorepos and can run package-specific commands such as `pnpm --filter backend start` from the repository root.

With a pnpm monorepo, scripts are easier to use as well because we can run recursively from the root with `pnpm -r`, like `pnpm -r test`

## Decision

Use a root `pnpm-workspace.yaml` with `backend` and `frontend` packages. Keep one root lockfile and install the whole workspace from the root.

Railway service configs stay next to the deployable packages, but their build and start commands run through workspace filters.

## Consequences

CI installs dependencies once from the workspace root and runs package checks through root scripts.

Package-level `.nvmrc` and `packageManager` duplication is no longer needed for deployed packages because Railway builds from the shared monorepo root.

This does not change the code-sharing decision in [007-code-sharing](./007-code-sharing.md). Runtime utilities should still come from `@guillaume-docquier/tools-ts` unless that decision is explicitly revisited.
