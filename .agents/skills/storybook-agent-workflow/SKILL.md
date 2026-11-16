---
name: storybook-agent-workflow
description: Use Storybook's maintained guidance for frontend component, story, style, theme, and browser component-test work in Cosmic Empires. Excludes Playwright E2E-only work.
---

# Storybook agent workflow

Read [frontend TESTING.md](../../../packages/frontend/TESTING.md) for testing scope and guidelines. These instructions and the overrides below take precedence over upstream guidance, as required by [ADR-031](../../../docs/architecture/decisions/031-storybook-agent-workflows.md).

## Load maintained guidance

From this checkout's `packages/frontend`, read the installed skills and run subsequent `pnpm exec storybook tools <toolset> <tool>` commands:

```powershell
pnpm exec storybook skills stories
pnpm exec storybook skills write-story
```

Use pnpm for upstream command examples. Read a tool's `--help` when its arguments are unclear. Use installed tooling without upgrading dependencies.

## Repository overrides

- Follow frontend TESTING.md for selective story coverage, static examples, play functions, and standalone browser tests. Visual examples do not automatically need assertions; cover implemented states without inventing defensive UI or exhaustive prop combinations.
- Tests must detect a specific failure through an observable outcome. Prefer a controlled story harness over callback spies; assert callbacks when the callback itself is the public contract. Check CSS or geometry only when presentation behavior is the requirement.
- Reuse deterministic domain stubs and mock only boundaries that cannot be exercised reliably, following [ADR-017](../../../docs/architecture/decisions/017-stubs-and-mocks.md).
- Generated docs are advisory. When APIs or examples are missing or unresolved, inspect the component and colocated story. Import a story's main component by relative path so metadata extraction resolves its API.
- `stories changed` examines uncommitted changes. For committed work, inspect `git diff <base-ref>...HEAD -- packages/frontend`. Map affected components and shared dependencies with `stories find-by-component`; an empty result does not establish that no stories are affected.

## Validate and share

For focused story feedback, use `test run --stories '[{"storyId":"<returned-story-id>"}]'`. Storybook's test tool excludes `*.browser.test.tsx`. Before handing off component, story, or shared UI dependency changes, run `pnpm --filter frontend test` to cover both projects, overriding upstream's prohibition on package scripts.

Reuse a server from this checkout, or start one from `packages/frontend`:

```powershell
pnpm storybook --no-open
```

Do not specify a port, let storybook give you one that's available. Inspect affected states in a browser, use `stories preview` for links and `review create` for a focused local review when available. Leave the server running when sharing live links.

For compiler changes, missing Chromium, portal queries, or native interaction isolation, read the relevant section of [repository notes](references/repository-notes.md).
