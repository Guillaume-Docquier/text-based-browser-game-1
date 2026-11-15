# Playwright page objects

Page objects expose reusable interactions and semantic locators. Keep test assertions and `test.step()` blocks in specs.

## Locator types

- When a page-object method expects a specific kind of locator returned by another page-object getter, give that locator a semantic `Branded<"...", Locator>` type. Return it with `branded()` from `@guillaume-docquier/tools-ts`, and require the same type in methods that consume it. Use distinct brands for different kinds of elements, such as Galaxy planets, fleet markers, and rows in different tables.
- Brand locators at the point where the selector establishes their meaning. Keep ordinary assertion-only locators as `Locator`; do not brand every locator exposed by a page object.
- Playwright's `first()`, `last()`, and `nth()` return an unbranded `Locator`. When tests need one element from a locator collection as input to another page-object method, expose a page-object selection method that returns the branded type. Keep the collection available for locator assertions.
- If a locator can refer to different element kinds depending on UI state, narrow its selector before branding it as one kind. See `GalaxyPage.foregroundPlanet` for a foreground body narrowed to a planet.

## Selecting Actions

Use `ActionsPage.toggleActionSelection(name, identifyingText?)` for every Action. When multiple cards share a name, pass visible text from the intended card as the second argument:

```ts
await actionsPage.toggleActionSelection("Build Fleet", "Standard Directive")
```

The same optional argument is available on `action()` and `selectActionButton()` for assertions. Use a card's exact visible text that distinguishes it from other cards. Do not add page-object methods for individual Action names, tiers, or other permutations.
