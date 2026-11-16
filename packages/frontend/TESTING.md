# Frontend testing

We have 3 ways to test the frontend:

- Playwright e2e tests
- Storybook stories
- Vitest Browser mode

Playwright E2E tests verify complete application flows and their resulting state. Stories describe component states. Vitest browser tests verify isolated component behavior

The architecture decisions are recorded in [ADR-023](../../docs/architecture/decisions/023-storybook-for-design-system-inspection.md) and [ADR-024](../../docs/architecture/decisions/024-playwright-for-frontend-end-to-end-tests.md).

## Choosing the right scope

Before adding a test, name the regression and the user-visible outcome it protects. Choose the smallest scope that can detect that regression. A component does not need every kind of test.

| Need                                                                                | Use                                          | Location                                    | Example                                                                               |
| ----------------------------------------------------------------------------------- | -------------------------------------------- | ------------------------------------------- | ------------------------------------------------------------------------------------- |
| Verify behavior across routes, authentication, backend requests, or persisted state | Playwright E2E test                          | `playwright/specs/*.spec.ts`                | A player's readiness change reaches the backend and becomes visible to another player |
| Inspect a meaningful component state                                                | Storybook story                              | Colocated `*.stories.tsx`                   | Turn button in normal, locked-in, pending, or resolving state                         |
| Try a component manually                                                            | Stateful Storybook story                     | An `Interactive` export in the stories file | Click the turn button to lock in and cancel                                           |
| Demonstrate a state that requires interaction to reach                              | Storybook story with a short `play` function | The stories file                            | Open a menu and leave it open for inspection                                          |
| Verify isolated interaction or presentation behavior                                | Vitest browser test                          | Colocated `*.browser.test.tsx`              | Hover reveals the action; Enter toggles lock-in; Tab moves focus correctly            |

## Playwright: full application behavior

Use E2E tests when the regression depends on the real application, including routing, authentication, backend integration, persistence, or multiple players. Assert the resulting application state. Keep E2E coverage for feature UI that has no suitable isolated component coverage.

Use the existing authenticated fixtures and page objects. Page objects own actions, navigation, and semantic locators; specs own assertions and `test.step()` blocks. Follow [the frontend instructions](AGENTS.md) and [the page-object conventions](playwright/AGENTS.md).

Keep detailed component mechanics in browser tests when they can protect the same behavior in isolation. An E2E readiness test should verify the application outcome; it does not need to repeat every hover and keyboard case for the turn button.

## Storybook: examples for inspection

- Keep visual examples static. Add stories for meaningful states, rather than every prop combination.
- Provide a stateful `Interactive` story when manual interaction is useful.
- Use `play` only when its interactions demonstrate a useful state. Leave the component in that state. Import instrumented assertions from `storybook/test` when needed.
- Put verification-only sequences in browser tests. Opening an example should not automatically cycle through hover, focus, typing, and clicks just to check behavior.
- Keep stories independent of live authentication and backend services. Use deterministic fixtures.
- Do not add test-mode branches to stories. Existing interaction stories can remain until their component needs this separation.

The `storybook` Vitest project renders the stories and runs any play functions. A story without assertions still gets a render test; this does not compare its appearance against a screenshot baseline. A visual example does not automatically need an extra visibility or enabled-state assertion.

## Vitest: isolated component verification

Use the `storybook-native` project for sequences that exist to verify behavior, including native hover, keyboard navigation, selection, validation, and component state changes.

- Reuse stories with `composeStories` from `@storybook/react-vite`. The shared [setup file](.storybook/vitest.setup.ts) applies Storybook preview annotations and styles.
- Import `describe`, `it`, and `expect` from `vitest`, and native interactions and locators from `vitest/browser`.
- Use focused tests with explicit expectations. Table-driven cases are useful when the behavior and assertions are identical; avoid branching between different requirements inside one test.
- Keep test controls and decorators in the test file. Establish a known pointer and focus position for each case; native pointer position can persist between tests.
- Assert visible results, values, accessible state, and focus. Use a stateful render when it exposes the result, and assert callbacks only when the callback itself is the public contract.
- Keep useful round trips when the sequence protects a regression: change state, leave the control, return, and reverse the change.
- Await interactions and retrying assertions such as `expect.element` or `expect.poll`. Avoid arbitrary delays and assertions tied to DOM ancestry or CSS class names.

CSS `:hover` requires native browser input. Ordinary Storybook preview code has no automation driver, so keep these checks in the browser tests. Vitest's `toBeVisible` treats `opacity: 0` as visible; use an opacity-aware visibility check when transparent content is the behavior under test. See [TurnButton.browser.test.tsx](src/features/play/components/TurnButton.browser.test.tsx).

For pure calculations or parsing, prefer focused Vitest tests in the package that owns the logic. The frontend currently has no separate Node unit-test project, and an ordinary `*.test.ts` file is not included by its browser-test glob. Do not assume such a file will run or move domain logic into the frontend to test it.
