# Duplicated Tools Versions

## Status

Superseded by [014-pnpm-workspaces-and-shared-railway-monorepo](./014-pnpm-workspaces-and-shared-railway-monorepo.md)

## Context

Corepack and nvm resolve versions recursively, so one root config should be enough. Railway detection did not honor this consistently for deployed packages.

## Decision

Duplicate `.nvmrc` in frontend/backend via symlink.

Duplicate `packageManager` in each deployed `package.json` (cannot be symlinked).

## Consequences

Slight maintenance overhead for version metadata.
