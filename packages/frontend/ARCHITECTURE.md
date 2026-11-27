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

## Stale Game State and Network Failures

Turns move slowly, and players act between turns. Eventual consistency is sufficient for the frontend. Use the latest game state the frontend has received to decide which controls to enable. The backend validates each mutation against the current game state.

For example, `Lock in` may remain enabled briefly after a turn closes. If a player clicks it, the backend rejects the request. The frontend shows the rejection and updates the control when it next receives the current turn state.

Keep recovery simple. For a rare race condition or brief outage, it is acceptable for the player to wait a few seconds and refresh the page. Avoid adding synchronization logic or timing-sensitive tests solely to prevent a short window of stale UI when a refresh fully resolves the problem.

## Submitting Actions

For every player action that changes game state during a turn, including Readiness updates, send the turn number from the Player View the player acted on. Use that number even if Turn State received over SSE reports a newer turn. See [backend action validation](../backend/ARCHITECTURE.md#validating-player-actions).

## Player Identity

- Display the current player's username exactly like every other player's username. Do not replace it with "You" or add a badge, pill, or other marker explaining that it is the current player.

## React Gotchas

- React Compiler is enabled. Use `useMemo` or `useCallback` only when the compiler cannot handle the case.
- Keep page components focused on data and state orchestration. Break distinct page sections and repeated or complex JSX into named local components, even when they remain in the same file, and pass those components explicit props for their rendered state.

See [ADR-020](../../docs/architecture/decisions/020-tanstack-routes-for-routing-only.md) for route ownership and [ADR-009](../../docs/architecture/decisions/009-trpc-return-types.md) for the TanStack Router return-type exception.
