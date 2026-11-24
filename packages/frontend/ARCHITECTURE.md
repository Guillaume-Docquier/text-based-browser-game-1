# Frontend architecture

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

## Player Identity

- Display the current player's username exactly like every other player's username. Do not replace it with "You" or add a badge, pill, or other marker explaining that it is the current player.

## React Gotchas

- React Compiler is enabled. Use `useMemo` or `useCallback` only when the compiler cannot handle the case.
- Keep page components focused on data and state orchestration. Break distinct page sections and repeated or complex JSX into named local components, even when they remain in the same file, and pass those components explicit props for their rendered state.

See [ADR-020](../../docs/architecture/decisions/020-tanstack-routes-for-routing-only.md) for route ownership and [ADR-009](../../docs/architecture/decisions/009-trpc-return-types.md) for the TanStack Router return-type exception.
