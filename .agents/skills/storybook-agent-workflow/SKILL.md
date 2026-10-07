---
name: storybook-agent-workflow
description: Use Storybook's maintained guidance for frontend component, story, style, theme, and browser component-test work in Cosmic Empires. Excludes Playwright E2E-only work.
---

# Storybook agent workflow

Read [frontend AGENTS.md](../../../apps/frontend/AGENTS.md) for standing frontend conventions. This skill supplies the operating instructions and repository overrides for [ADR-031](../../../docs/architecture/decisions/031-storybook-agent-workflows.md).

## Load maintained guidance

Before UI work, read Storybook's installed skills from `apps/frontend`:

```powershell
pnpm exec storybook skills stories
pnpm exec storybook skills write-story
```

Use their guidance with the repository overrides below. Use pnpm for upstream command examples, preserve the native TypeScript compiler and existing compiler API compatibility configuration, and do not install or upgrade tooling as a side effect of ordinary UI work.

Run each `pnpm exec storybook tools <toolset> <tool>` command with `--help` before its first use. Discover component and story IDs through the tools.

## Develop and review components

1. Run `pnpm exec storybook tools docs list --withStoryIds true`, then `docs show --id <returned-component-id>` for relevant components. Reuse existing components and verify their props. If generated docs omit an API or show an unresolved example/import, read the actual component and colocated story; use this repository's imports.
2. Develop with isolated stories and deterministic state. Import a colocated story's main component by relative path so the current metadata extractor resolves its API. Keep selective story coverage: add stories for meaningful shared or feature-component states, not every local JSX component or every prop combination. Explain a non-obvious scenario's purpose with a short story JSDoc comment.
3. Use `stories changed` and `stories find-by-component` to find affected stories, including consumers of shared styles or utilities. `stories changed` examines uncommitted working-tree changes; for a committed branch or PR review, inspect `git diff <base-ref>...HEAD -- apps/frontend` instead. Verify coverage against that diff and map missing components or shared dependencies with `find-by-component`; an empty result does not prove no stories are affected.
4. Run `test run --stories '[{"storyId":"<returned-story-id>"}]'` for focused feedback; the array contains objects, not bare IDs. If Chromium is missing, run `pnpm --filter frontend exec playwright install chromium` from the repository root. Focused Storybook runs omit `storybook-native`; run `pnpm --filter frontend storybook:test` before handoff when changing components, stories, or shared UI dependencies.
5. Reuse a Storybook server from the same checkout, or start `pnpm storybook --no-open --port <chosen-port> --exact-port` from `apps/frontend`. Give concurrent worktrees separate ports; the worktree setup script does not assign a Storybook port. `--exact-port` prevents silently switching ports or prompting when the chosen port is occupied. Keep tool commands in that checkout's frontend directory. Use `stories preview` to obtain links, inspect affected states in a browser, and use `review create` for a focused local review when available. Leave the server running when sharing live links.

## Test quality overrides

- Before adding a test, name the concrete regression and user-visible outcome it protects. Prefer one focused behavior or boundary per story. A visual example can remain a story without an extra visibility-only or enabled-only assertion.
- Drive interactions with the play context's `userEvent`; await interactions and assertions. Query by role and accessible name or label. Scope queries to `canvas`; for portals, query `canvasElement.ownerDocument.body` with `within`.
- Assert the resulting selection, value, accessible state, focus, or visible outcome. Prefer a controlled story harness over callback-spy assertions when it exposes the outcome. Assert callbacks only when the callback itself is the public contract.
- Avoid CSS classes, private data attributes, DOM ancestry, broad snapshots, arbitrary delays, and duplicated production calculations. Check styles or geometry only when that presentation behavior is the requirement, using the native browser project where CSS hover/focus needs real browser events.
- Keep fixtures deterministic and reuse domain stubs. Mock only uncontrollable boundaries through real seams, following [ADR-017](../../../docs/architecture/decisions/017-stubs-and-mocks.md). Cover implemented empty, disabled, pending, invalid, or boundary states when they change behavior; do not invent defensive UI or add a Cartesian matrix of props.
- For a new regression test, verify it would fail for a plausible implementation defect. A small temporary mutation is useful when confidence is unclear; restore production code after the check. Never weaken a meaningful assertion merely to make the suite pass.
