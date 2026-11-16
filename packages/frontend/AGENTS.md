# Frontend Instructions

The frontend uses React with the compiler, TailwindCSS, TanStack Router, Shadcn with Base UI, Clerk auth, Vite, Playwright, and Storybook.

## Structure

| Directory        | Description                                                                         |
| ---------------- | ----------------------------------------------------------------------------------- |
| `src/routes`     | File-based TanStack routes. Routes only route and import pages from `src/features`. |
| `src/features`   | Vertical feature slices.                                                            |
| `src/components` | Shared design-system components.                                                    |
| `src/lib/api`    | API client and live hooks. Callers do not depend directly on tRPC or React Query.   |
| `.storybook`     | Storybook configuration. Stories live next to their components.                     |
| `playwright`     | End-to-end tests using page objects and Clerk authentication.                       |

## Testing

When modifying tests, follow instructions from frontend/TESTING.md

## Player Identity

- Display the current player's username exactly like every other player's username. Do not replace it with "You" or add a badge, pill, or other marker explaining that it is the current player.

## Backend API Types

- Import named backend contract types with `import type` from `@api-types`. Do not use indexed access to extract nested API types in frontend code, or unroll/reconstruct their shapes locally.
- When a needed contract type is missing, add a named export in `packages/backend/src/api/types.ts` derived from the tRPC router output (`inferRouterOutputs<TrpcRouter>`). Derive nested types there as well, so the frontend uses the actual API output type despite Zod inference quirks.
- Do not re-export other backend types as frontend contracts. Direct re-exports are reserved for simple branded scalar types, such as IDs and `TargetTag`.
- This type-only API contract import is the exception to the app boundary. Runtime code shared with the backend belongs in `packages/shared/`; do not import other backend modules. Frontend-only types for component state, rendering, and interactions may remain in the frontend. See ADR-007 and ADR-022.

## React Gotchas

- React Compiler is enabled. Use `useMemo` or `useCallback` only when the compiler cannot handle the case.
- Keep page components focused on data and state orchestration. Break distinct page sections and repeated or complex JSX into named local components, even when they remain in the same file, and pass those components explicit props for their rendered state.

## Storybook Gotchas

- `pnpm --filter frontend storybook:build` must be run through a reviewed, one-command Codex sandbox exception (`require_escalated` with the exact prefix `pnpm --filter frontend storybook:build`) to avoid sandbox cache write issues.
