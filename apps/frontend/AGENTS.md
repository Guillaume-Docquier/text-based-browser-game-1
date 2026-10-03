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

## Player Identity

- Display the current player's username exactly like every other player's username. Do not replace it with "You" or add a badge, pill, or other marker explaining that it is the current player.

## Storybook

- Keep stories next to their components. Use `Design System/<Component>` for shared components in `src/components` and `Application/<Component>` for feature components.
- Design System appears first in the sidebar. Application is a broad section for selected feature components whose states benefit from isolated inspection; not every feature component needs a story.
- Write component assertions in story play functions using storybook/test. Run pnpm --filter frontend storybook:test for Chromium browser tests. Keep isolated UI state and presentation assertions here; E2E tests cover flows and resulting application state.
- For CSS hover and focus checks requiring native events, add colocated *.browser.test.ts specs using vitest/browser and reuse the stories through Storybook portable stories. The storybook:test command runs both the story plays and native browser specs.
- Story imports are checked by the frontend Oxlint override: use `@storybook/react-vite` for story types and `storybook/test` for instrumented assertions and test helpers. Native `*.browser.test.ts` specs continue to use Vitest browser APIs.
- Keep stories independent of live authentication and backend services. See [ADR-023](../../docs/architecture/decisions/023-storybook-for-design-system-inspection.md).
- `pnpm --filter frontend storybook:build` must be run through a reviewed, one-command Codex sandbox exception (`require_escalated` with the exact prefix `pnpm --filter frontend storybook:build`) to avoid sandbox cache write issues.

### Agent workflow

Use Storybook's maintained, project-specific guidance instead of a copied third-party skill. From `apps/frontend`, read `pnpm exec storybook skills stories` and `pnpm exec storybook skills write-story` before UI work. Run each `storybook tools <toolset> <tool>` command with `--help` before its first use; discover story IDs rather than guessing them.

1. Run `pnpm exec storybook tools docs list --withStoryIds true`, then `docs show --id <returned-component-id>` for relevant components. Reuse the existing components and verify their props. If generated docs omit an API or show an unresolved example/import, read the actual component and colocated story; use this repository's imports.
2. Develop with isolated stories and deterministic state. Import a colocated story's main component by relative path so the current metadata extractor resolves its API. Keep the existing selective story scope: add stories for meaningful shared or feature-component states, not every local JSX component or every prop combination. Explain a non-obvious scenario's purpose with a short story JSDoc comment.
3. Use `stories changed` and `stories find-by-component` to find affected stories, including consumers of shared styles or utilities. `stories changed` examines uncommitted working-tree changes; for a committed branch or PR review, inspect `git diff <base-ref>...HEAD -- apps/frontend` instead. Verify coverage against that diff and map any missing components or shared dependencies with `find-by-component`; an empty result does not prove no stories are affected.
4. Run `test run --stories '[{"storyId":"<returned-story-id>"}]'` for focused feedback; the array contains objects, not bare IDs. If Chromium is missing, run `pnpm --filter frontend exec playwright install chromium` from the repository root. Focused Storybook runs omit `storybook-native`; run `pnpm --filter frontend storybook:test` before handoff when changing components, stories, or shared UI dependencies.
5. Reuse a Storybook server from the same checkout, or start `pnpm storybook --no-open --host 127.0.0.1 --port <chosen-port> --exact-port` from `apps/frontend`. Give concurrent worktrees separate ports; the worktree setup script assigns application and database ports but does not assign a Storybook port. `--exact-port` prevents silently switching ports or prompting when the chosen port is occupied. Keep all tool commands in that checkout's frontend directory. Use `stories preview` to obtain links, inspect the affected state with browser tools, and use `review create` for a focused local review when available. Leave the server running when sharing live links.

Repository instructions take precedence over generated guidance: use pnpm, preserve the native TypeScript compiler, mock only uncontrollable boundaries through real seams, and keep the full test command covering native browser specs. Do not install or upgrade tooling as a side effect of ordinary UI work.

### Test quality

- Before adding a test, name the concrete regression and user-visible outcome it protects. Prefer one focused behavior or boundary per story. A visual example can remain a story without an extra visibility-only or enabled-only assertion.
- Drive interactions with the play context's `userEvent`; await interactions and assertions. Query by role and accessible name or label. Scope queries to `canvas`; for portals, query `canvasElement.ownerDocument.body` with `within`.
- Assert the resulting selection, value, accessible state, focus, or visible outcome. Prefer a controlled story harness over callback-spy assertions when it exposes the outcome. Assert callbacks only when the callback itself is the public contract.
- Avoid CSS classes, private data attributes, DOM ancestry, broad snapshots, arbitrary delays, and duplicated production calculations. Check styles or geometry only when that specific presentation behavior is the requirement, using the native browser project where CSS hover/focus needs real browser events.
- Keep fixtures deterministic and reuse domain stubs. Cover implemented empty, disabled, pending, invalid, or boundary states when they change behavior; do not invent defensive UI or add a Cartesian matrix of props.
- For a new regression test, verify it would fail for a plausible implementation defect. A small temporary mutation is useful when confidence is unclear; restore production code after the check. Never weaken a meaningful assertion merely to make the suite pass.

## Backend API Types

- Import named backend contract types with `import type` from `@api-types`. Do not use indexed access to extract nested API types in frontend code, or unroll/reconstruct their shapes locally.
- When a needed contract type is missing, add a named export in `apps/backend/src/api/types.ts` derived from the tRPC router output (`inferRouterOutputs<TrpcRouter>`). Derive nested types there as well, so the frontend uses the actual API output type despite Zod inference quirks.
- Do not re-export backend DTO, model, or schema-inferred types as frontend contracts. Direct re-exports are reserved for simple branded scalar types, such as IDs and `TargetTag`.
- This type-only API contract import is the exception to the app boundary. Runtime code shared with the backend belongs in `packages/`; do not import other backend modules. Frontend-only types for component state, rendering, and interactions may remain in the frontend. See ADR-007 and ADR-022.

## End-to-end Tests

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
