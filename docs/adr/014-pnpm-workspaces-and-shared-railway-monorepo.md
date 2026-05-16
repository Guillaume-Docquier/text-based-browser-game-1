# pnpm Workspaces And Shared Railway Monorepo

## Status

Accepted

Supersedes [004-duplicated-tools-versions](./004-duplicated-tools-versions.md)

## Context

Previous deploy setup duplicated lockfiles/tooling metadata and prevented Railway shared monorepo workflows.

Railway supports root-level monorepo builds with package-filtered commands.

## Decision

Adopt root `pnpm-workspace.yaml` for `backend`, `frontend`, and `shared/*`.

Use one root lockfile and root workspace install.

Keep Railway service config near deployable packages, but execute build/start via workspace filters.

## Consequences

Single dependency install in CI and simpler root-level checks.

No need for duplicated package-level `.nvmrc`/`packageManager` for deployed packages.

Does not change runtime-sharing policy in [007-code-sharing](./007-code-sharing.md).
