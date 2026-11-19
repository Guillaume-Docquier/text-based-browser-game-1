# Playwright page objects

Page objects expose reusable interactions and semantic locators. Keep test assertions and `test.step()` blocks in specs.

## Locator types

- When a page-object method expects a specific kind of locator returned by another page-object getter, give that locator a semantic `Branded<"...", Locator>` type. Return it with `branded()` from `@guillaume-docquier/tools-ts`, and require the same type in methods that consume it. Use distinct brands for different kinds of elements, such as Galaxy planets and rows in different tables.
- Brand locators at the point where the selector establishes their meaning. Keep ordinary assertion-only locators as `Locator`; do not brand every locator exposed by a page object.
- Playwright's `first()`, `last()`, and `nth()` return an unbranded `Locator`. When tests need one element from a locator collection as input to another page-object method, expose a page-object selection method that returns the branded type. Keep the collection available for locator assertions.
- If a locator can refer to different element kinds depending on UI state, narrow its selector before branding it as one kind.
