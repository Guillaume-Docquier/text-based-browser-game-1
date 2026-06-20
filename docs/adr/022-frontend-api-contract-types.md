# Frontend API Contract Types

## Status

Accepted

## Context

The frontend consumes backend contracts through the tRPC router types exported from `backend/src/api/types.ts`, as established by ADR-007.

Frontend features sometimes need a nested part of an API response, such as a Star System Body. Deriving that type locally with indexed access duplicates knowledge of the backend response structure:

```ts
type StarSystemBody = PlayerView["starSystem"]["orbits"][number]["sectors"][number]["bodies"][number]
```

This creates boilerplate, makes the type harder to reuse, and couples frontend feature code to the internal shape of a larger response.

## Decision

`backend/src/api/types.ts` is the catalog of named backend API contract types available to the frontend.

When the frontend needs a complete response type or a nested type from a backend contract, that type must be exported with a reusable name from `backend/src/api/types.ts`. Indexed-access derivation of backend contract types belongs in that file, not in frontend feature code.

Frontend code imports those named contract types from `@api-types`.

Frontend code may define types for frontend-only concerns, such as component state, rendering geometry, view models, and interaction state. It must not duplicate, reconstruct, or deconstruct backend contract types.

## Consequences

Frontend features have shorter and more stable type declarations. Reusable API concepts have consistent names, and changes to nested backend response structures are localized to the API type boundary.

`backend/src/api/types.ts` will contain more exported aliases, but it provides a deliberate and discoverable contract surface instead of spreading structural knowledge throughout the frontend.
