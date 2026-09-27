# Playwright page objects

Page objects expose reusable interactions and semantic locators. Keep test assertions and `test.step()` blocks in specs.

## Selecting Actions

Use `ActionsPage.toggleActionSelection(name, identifyingText?)` for every Action. When multiple cards share a name, pass visible text from the intended card as the second argument:

```ts
await actionsPage.toggleActionSelection("Build Fleet", "Standard Directive")
```

The same optional argument is available on `action()` and `selectActionButton()` for assertions. Use a card's exact visible text that distinguishes it from other cards. Do not add page-object methods for individual Action names, tiers, or other permutations.
