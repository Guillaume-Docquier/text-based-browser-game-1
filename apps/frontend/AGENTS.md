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

## Storybook

- Keep stories next to their components. Use `Design System/<Component>` for shared components in `src/components` and `Application/<Component>` for feature components.
- Design System appears first in the sidebar. Application is a broad section for selected feature components whose states benefit from isolated inspection; not every feature component needs a story.
- Keep stories independent of live authentication and backend services. See [ADR-023](../../docs/architecture/decisions/023-storybook-for-design-system-inspection.md).

## Backend API Types

- Import named backend contract types with `import type` from `@api-types`. Do not use indexed access to extract nested API types in frontend code, or unroll/reconstruct their shapes locally.
- When a needed contract type is missing, add a named export in `apps/backend/src/api/types.ts` derived from the tRPC router output (`inferRouterOutputs<TrpcRouter>`). Derive nested types there as well, so the frontend uses the actual API output type despite Zod inference quirks.
- Do not re-export backend DTO, model, or schema-inferred types as frontend contracts. Direct re-exports are reserved for simple branded scalar types, such as IDs and `TargetTag`.
- This type-only API contract import is the exception to the app boundary. Runtime code shared with the backend belongs in `packages/`; do not import other backend modules. Frontend-only types for component state, rendering, and interactions may remain in the frontend. See ADR-007 and ADR-022.

## Commands

On native Windows in the Codex sandbox, do not run the aggregate `pnpm --filter frontend checks` command. It invokes Storybook inside a nested command that cannot use the one-command exception. Run its checks in this order, using a separate `exec_command` call for each:

1. `pnpm --filter frontend typecheck` in the default sandbox.
2. `pnpm --filter frontend build` in the default sandbox.
3. `pnpm --filter frontend storybook:build` through a reviewed, one-command Codex sandbox exception (`require_escalated` with the exact prefix `pnpm --filter frontend storybook:build`) to avoid sandbox cache write issues.
4. Run the E2E command below.

## End-to-end Tests

### Running Tests

Use `exec_command` with `tty: true`. On native Windows, also use a reviewed `require_escalated` exception with prefix `pnpm --filter frontend e2e` so Playwright can stop its servers.

Run these lines in one PowerShell command to print tests and steps and save the HTML report without automatically serving it:

```powershell
$env:PLAYWRIGHT_HTML_OPEN = "never"
$env:PLAYWRIGHT_LIST_PRINT_STEPS = "1"
pnpm --filter frontend e2e --add-reporter=list
```

Add a spec path for a focused run. Poll the terminal session until it exits; assess quiet intervals using the latest step, test timeout, and diagnostics.

### Writing Tests

- Structure tests with descriptive `test.step()` blocks reflecting user behavior. Do not use AAA sections.
- Page objects own selectors, reusable interactions, and routes. Tests use intent-revealing methods such as `page.navbar.signOut()`; navigation methods return the destination page object.
- Follow the [Playwright page-object conventions](playwright/AGENTS.md), including branded locators at page-object method boundaries and parameterized action selection instead of methods for individual Actions.
- Put reusable page-specific actions on the corresponding page object. Do not create `utils` or `helpers` directories for behavior that belongs to a page; use a precisely named shared module only for behavior that genuinely spans pages.
- Use component objects for cohesive shared UI, not individual elements.
- Expose semantic locators for assertions only. Tests must not interact with locators directly; add a page-object method instead.
- Keep all `expect` calls and `test.step()` blocks in tests. Page objects expose actions and observable state, not assertions.
- Prefer locator assertions over boolean state methods for automatic waiting and diagnostics.
- Prefer role-based locators; use test IDs only when no stable semantic locator exists.
- When testing deterministic generated data, hardcode the expected displayed values and row orders. Do not reimplement production logic in the test (for example, by sorting captured values with `toSorted` or custom comparators).
- Test concrete, observable product behavior. Do not add page-object locators or assertions for hypothetical UI that is not implemented merely to prove that it is absent.
- Use negative assertions only when the element is part of a real alternative state or its disappearance is itself required behavior. Do not invent loading, error, retry, or other defensive UI copy solely for a negative assertion.
- Never use `test.use()` to authenticate a user, use the `alice` and `bob` fixtures instead.

## React Gotchas

- React Compiler is enabled. Use `useMemo` or `useCallback` only when the compiler cannot handle the case.
- Keep page components focused on data and state orchestration. Break distinct page sections and repeated or complex JSX into named local components, even when they remain in the same file, and pass those components explicit props for their rendered state.

## Player Identity

- Display the current player's username exactly like every other player's username. Do not replace it with "You" or add a badge, pill, or other marker explaining that it is the current player.
