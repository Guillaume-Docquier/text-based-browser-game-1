# Frontend API Contract Types

## Status

Accepted

### Amendment history

- 2026-09-28: Clarified that named backend API contract imports remain the type-only exception to the app boundary in amended ADR-007.

## Context

The frontend consumes backend contracts through the tRPC router types exported from `apps/backend/src/api/types.ts`. [ADR-007](./007-code-sharing.md) allows this type-only import from the backend API while requiring runtime code shared between apps to live in workspace packages.

Frontend features sometimes need a nested part of an API response, such as a Star System Body. Deriving that type locally with indexed access duplicates knowledge of the backend response structure:

```ts
type StarSystemBody = PlayerView["starSystem"]["orbits"][number]["sectors"][number]["bodies"][number]
```

This creates boilerplate, makes the type harder to reuse, and couples frontend feature code to the internal shape of a larger response.

## Decision

`apps/backend/src/api/types.ts` is the catalog of named backend API contract types available to the frontend.

When the frontend needs a complete response type or a nested type from a backend contract, that type must be exported with a reusable name from `apps/backend/src/api/types.ts`. Indexed-access derivation of backend contract types belongs in that file, not in frontend feature code.

Frontend code imports those named contract types with `import type` from `@api-types`. It must not import runtime code or other backend modules through this exception.

Frontend code may define types for frontend-only concerns, such as component state, rendering geometry, view models, and interaction state. It must not duplicate, reconstruct, or deconstruct backend contract types.

## Consequences

Frontend features have shorter and more stable type declarations. Reusable API concepts have consistent names, and changes to nested backend response structures are localized to the API type boundary.

`apps/backend/src/api/types.ts` contains exported aliases derived from the tRPC router output, providing a discoverable contract surface without spreading structural knowledge throughout the frontend. The type-only dependency makes backend API changes visible to frontend typechecking.
