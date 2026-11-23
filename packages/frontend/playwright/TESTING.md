# Playwright application flows

Use E2E tests when the regression depends on the real application. End-to-end tests are best used when they test user flows, not UI behavior. Assert the resulting application state.

- E2E tests use the application like a user does. Do not simulate events or run scripts on the page that a user wouldn't do.
- Use the existing `alice` and `bob` fixtures for authentication. Never authenticate through `test.use()`.
- Structure tests with descriptive `test.step()` blocks that reflect user behavior. Do not use AAA sections.
- Page objects own selectors, reusable interactions, and routes. Call methods that express user intent, such as `page.navbar.signOut()`. Navigation methods return the destination page object.
- Expose semantic locators for assertions only. Tests must perform interactions through page-object methods. Prefer locator assertions over boolean state methods for automatic waiting and diagnostics.
- Put reusable page-specific actions on the corresponding page object. Do not create `utils` or `helpers` directories for behavior that belongs to a page. Use a precisely named shared module only for behavior that spans pages.
- Use component objects for cohesive shared UI, not individual elements.

Run E2E tests with `pnpm --filter frontend e2e`.

## Page objects

Page objects expose reusable interactions and semantic locators. Keep test assertions and `test.step()` blocks in specs.

### Locator types

- When a page-object method expects a specific kind of locator returned by another page-object getter, give that locator a semantic `Branded<"...", Locator>` type. Return it with `branded()` from `@guillaume-docquier/tools-ts`, and require the same type in methods that consume it. Use distinct brands for different kinds of elements, such as Galaxy planets and rows in different tables.
- Brand locators at the point where the selector establishes their meaning. Keep ordinary assertion-only locators as `Locator`; do not brand every locator exposed by a page object.
- Playwright's `first()`, `last()`, and `nth()` return an unbranded `Locator`. When tests need one element from a locator collection as input to another page-object method, expose a page-object selection method that returns the branded type. Keep the collection available for locator assertions.
- If a locator can refer to different element kinds depending on UI state, narrow its selector before branding it as one kind.
