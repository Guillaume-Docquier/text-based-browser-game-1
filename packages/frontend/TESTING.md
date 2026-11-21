# Frontend testing

We have 3 ways to test the frontend:

- Playwright e2e tests
- Storybook stories
- Vitest Browser mode

Playwright E2E tests verify application flows. Storybook stories describe component states. Vitest browser tests verify isolated component behavior.

The architecture decisions are recorded in [ADR-023](../../docs/architecture/decisions/023-storybook-for-design-system-inspection.md) and [ADR-024](../../docs/architecture/decisions/024-playwright-for-frontend-end-to-end-tests.md).

## Choosing the right scope

Before adding a test, decide what behavior you want to check and how the test will tell whether it works. Choose the simplest type of test that can check that behavior. Check whether an existing test already covers it. A component does not need every kind of test, and each prop combination does not need a separate case.

| Need                                                                                 | Use                                          | Location                                    | Example                                                                        |
| ------------------------------------------------------------------------------------ | -------------------------------------------- | ------------------------------------------- | ------------------------------------------------------------------------------ |
| Verify routes, authentication, backend integration, persistence, or multiple players | Playwright E2E test                          | `playwright/specs/*.spec.ts`                | A readiness change reaches the backend and becomes visible to another player   |
| Inspect a meaningful component state                                                 | Static Storybook story                       | Colocated `*.stories.tsx`                   | Turn button in normal, locked-in, pending, or resolving state                  |
| Try a component interaction manually                                                 | Stateful Storybook story                     | An `Interactive` export in the stories file | Click the turn button to lock in and cancel                                    |
| Demonstrate a state that requires interaction to reach                               | Storybook story with a short `play` function | Colocated `*.stories.tsx`                   | Open a menu and leave it open for inspection                                   |
| Verify isolated interaction or presentation behavior                                 | Vitest browser test                          | Colocated `*.browser.test.tsx`              | Hover reveals the action; keyboard activation toggles lock-in; Tab moves focus |

If what you are trying to test does not fit in the above, raise it to the human.

## Guidelines for automated tests

- Test concrete, implemented behavior through visible results, values, accessible state, focus, or persisted application state.
- Keep coverage proportional to the behavior. Use a round trip when it protects a useful sequence: change state, leave the control, return, and reverse the change. Avoid separate tests that repeat the same behavior without protecting another regression.
- Use deterministic fixtures. Hardcode expected displayed values and row orders; do not reproduce production logic by sorting captured values or using custom comparators to derive expectations.
- Prefer role-based locators. Use test IDs only when no stable semantic locator exists.
- Await interactions and retrying locator assertions. Avoid arbitrary delays and assertions tied to DOM ancestry or CSS class names. Check CSS or geometry when presentation behavior is the requirement.
- Use negative assertions for real alternative states or required disappearance. Do not invent loading, error, retry, or other UI solely to assert that it is absent.
- Assert callbacks only when the callback itself is the public contract. Prefer a stateful component or real application flow when it exposes the result.

## Playwright: application flows

Use E2E tests when the regression depends on the real application. End-to-end tests are best used when they test user flows, not UI behavior. Assert the resulting application state.

- Use the existing `alice` and `bob` fixtures for authentication. Never authenticate through `test.use()`.
- Structure tests with descriptive `test.step()` blocks that reflect user behavior. Do not use AAA sections.
- Page objects own selectors, reusable interactions, and routes. Call methods that express user intent, such as `page.navbar.signOut()`. Navigation methods return the destination page object.
- Expose semantic locators for assertions only. Tests must perform interactions through page-object methods. Prefer locator assertions over boolean state methods for automatic waiting and diagnostics.
- Put reusable page-specific actions on the corresponding page object. Do not create `utils` or `helpers` directories for behavior that belongs to a page. Use a precisely named shared module only for behavior that spans pages.
- Use component objects for cohesive shared UI, not individual elements.
- Follow the [Playwright page-object conventions](playwright/AGENTS.md), including branded locators at page-object method boundaries.

Run E2E tests with `pnpm --filter frontend e2e`.

## Storybook: component states and render tests

Use stories for states that benefit from isolated inspection. The `render` Vitest project renders each story and runs its play function, if present. A story without assertions still gets a render test.

- Keep stories next to their components. Use `Design System/<Component>` for shared components in `src/components` and `Application/<Component>` for selected feature components. Design System appears first in the sidebar; not every feature component needs a story.
- Keep visual examples static. Cover meaningful implemented states without enumerating every prop combination or adding assertions solely because a story exists.
- Put a stateful `Interactive` story first for components with meaningful user actions. Show the result of each action through native behavior or state in the example. For display-only components, put a static story with a descriptive name first.
- Use `play` when the sequence demonstrates a useful state, and leave the component in that state. Put sequences that exist only for verification in browser tests. Opening a story should not cycle through hover, focus, typing, and clicks just to check behavior.
- Import story types from `@storybook/react-vite` and instrumented assertions and test helpers from `storybook/test`. The frontend Oxlint override checks these imports.
- Keep stories independent of live authentication and backend services. Use deterministic fixtures.

Run storybook tests with `pnpm --filter frontend test:render`.

## Vitest browser mode: isolated interactions

Use the `interactions` project for sequences that verify component behavior, including hover, keyboard navigation, selection, validation, and state changes.

- Reuse stories with `composeStories` from `@storybook/react-vite`. The shared [setup file](.storybook/vitest.setup.ts) applies Storybook preview annotations and styles.
- Import `describe`, `it`, and `expect` from `vitest`, and native interactions and locators from `vitest/browser`. Test CSS `:hover` through native browser input.
- Structure tests with descriptive `page.mark()` blocks that reflect user behavior. Do not use AAA sections.
- Use focused tests with explicit expectations. Table-driven cases are useful when behavior and assertions are identical. Do not branch between different requirements or test environments inside a test.
- Keep test controls and decorators in the test file. Establish a known pointer and focus position for each case; native pointer position can persist between tests.
- Use `expect.element` or `expect.poll` for retrying assertions. Vitest's `toBeVisible` treats `opacity: 0` as visible; use an opacity-aware visibility check when transparent content is the behavior under test.

Run browser mode tests with `pnpm --filter frontend test:interactions`.
