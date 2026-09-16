# Frontend Instructions

The frontend uses React with the compiler, TailwindCSS, TanStack Router, Shadcn, Clerk auth, Vite, Playwright, and Storybook.

## Structure

| Directory        | Description                                                                         |
| ---------------- | ----------------------------------------------------------------------------------- |
| `src/routes`     | File-based TanStack routes. Routes only route and import pages from `src/features`. |
| `src/features`   | Vertical feature slices.                                                            |
| `src/components` | Shared design-system components.                                                    |
| `src/lib/api`    | API client and live hooks. Callers do not depend directly on tRPC or React Query.   |
| `.storybook`     | Storybook configuration. Stories live next to their components.                     |
| `playwright`     | End-to-end tests using page objects and Clerk authentication.                       |

## Commands

- `pnpm --filter frontend e2e`: run local end-to-end tests.
- `pnpm --filter frontend checks`: run all frontend quality checks.

## End-to-end Tests

- Structure tests with descriptive `test.step()` blocks reflecting user behavior. Do not use AAA sections.
- Page objects own selectors, reusable interactions, and routes. Tests use intent-revealing methods such as `page.navbar.signOut()`; navigation methods return the destination page object.
- Use component objects for cohesive shared UI, not individual elements.
- Expose semantic locators for assertions only. Tests must not interact with locators directly; add a page-object method instead.
- Keep all `expect` calls and `test.step()` blocks in tests. Page objects expose actions and observable state, not assertions.
- Prefer locator assertions over boolean state methods for automatic waiting and diagnostics.
- Prefer role-based locators; use test IDs only when no stable semantic locator exists.
- When testing deterministic generated data, hardcode the expected displayed values and row orders. Do not reimplement production logic in the test (for example, by sorting captured values with `toSorted` or custom comparators).
- Test concrete, observable product behavior. Do not add page-object locators or assertions for hypothetical UI that is not implemented merely to prove that it is absent.
- Use negative assertions only when the element is part of a real alternative state or its disappearance is itself required behavior. Do not invent loading, error, retry, or other defensive UI copy solely for a negative assertion.

## React Gotchas

- React Compiler is enabled. Use `useMemo` or `useCallback` only when the compiler cannot handle the case.
- Keep page components focused on data and state orchestration. Break distinct page sections and repeated or complex JSX into named local components, even when they remain in the same file, and pass those components explicit props for their rendered state.

## Player Identity

- Display the current player's username exactly like every other player's username. Do not replace it with "You" or add a badge, pill, or other marker explaining that it is the current player.
