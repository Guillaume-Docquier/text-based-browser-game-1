# Repository notes

## Compiler compatibility

Preserve native TypeScript 7 as the compiler and the TypeScript 6 compiler API dependency used for Storybook metadata extraction. See [ADR-031](../../../../docs/architecture/decisions/031-storybook-agent-workflows.md) before changing this configuration. Ordinary UI work does not require tooling installation or upgrades.

## Missing Chromium

If browser tests report a missing Chromium executable, run from the repository root:

```powershell
pnpm --filter frontend exec playwright install chromium
```

## Portal queries

Scope play queries to `canvas`. For content rendered through a portal, use `within(canvasElement.ownerDocument.body)` from `storybook/test`.

## Native interaction isolation

In play functions, use the play context's `userEvent`. In standalone browser tests, establish a known pointer and focus state for independent cases: native pointer position can persist between tests. Keep reset controls in test setup. See `renderStory` in [TurnButton.browser.test.tsx](../../../../packages/frontend/src/features/play/components/TurnButton.browser.test.tsx).
