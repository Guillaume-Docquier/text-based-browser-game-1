# Code Sharing

## Status

Accepted

### Amendment history

- 2026-09-28: Allowed workspace packages to share runtime code after moving to a shared pnpm workspace; retained the frontend's type-only import of backend API contracts.
- 2026-10-01: Established the `packages/shared` package as the owner of reusable domain definitions and shared gameplay behavior, while keeping application projections, API contracts, persistence mappings, and the Standard Ruleset with their owning apps.

## Context

The frontend and backend both need reusable code. We initially published shared utilities in [@guillaume-docquier/tools-ts](https://github.com/Guillaume-Docquier/tools-ts) because Railway built each service from only its project folder, and the backend ran native TypeScript without a bundler. Those deployment constraints made local code sharing impractical.

[ADR-014](./014-pnpm-workspaces-and-shared-railway-monorepo.md) moved the services to a shared pnpm workspace. The repository now has `packages/shared`, which both apps depend on. Sharing selected code locally avoids duplicating rules that must behave consistently in both places.

## Decision

The frontend and backend may both depend on workspace packages under `packages/`. Put runtime code that needs to run in both apps in the `packages/shared` package with an explicit public API. The package owns reusable domain definitions and shared gameplay behavior such as galaxy creation, action submission, turn resolution, and the independent Test Ruleset. Its domain definitions are persistence agnostic and must not depend on either app or on application infrastructure.

Application-specific projections, API request and response contracts, repository models, database rows and mappings, and the backend's Standard Ruleset remain owned by the application that consumes or persists them. Sharing a noun or a field shape does not make those application models part of the shared package.

Across workspace projects, runtime imports from either app may only target shared packages. The frontend may import types only from the backend API contract through `@api-types` (`apps/backend/src/api/types.ts`), as described in [ADR-022](./022-frontend-api-contract-types.md). This exception does not allow runtime imports or arbitrary backend modules in the frontend.

The backend must not import from the frontend, and shared packages must not import from either app, including type-only imports. Backend API code may still depend on backend turn-processing code within the backend app.

`@guillaume-docquier/tools-ts` remains available for general utilities; publishing a package is not required just to share code within this monorepo.

## Consequences

Shared behavior can have one implementation used by both apps. Shared packages must expose code that their consumers can use in their respective runtimes, and changes to a package must be checked against both consumers.

The type-only API contract import preserves tRPC's inferred types in the frontend without bundling backend runtime code. It couples frontend typechecking to the backend API contract, so API changes must be checked against the frontend.
