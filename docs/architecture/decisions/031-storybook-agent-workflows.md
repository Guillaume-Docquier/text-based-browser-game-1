# Adopt Storybook's Maintained Tooling For Agent Component Workflows

## Status

Proposed

## Context

[ADR-023](./023-storybook-for-design-system-inspection.md) establishes Storybook for isolated component inspection and Chromium component tests. Agents also need to discover and reuse existing components, develop their states without starting application services, and obtain focused feedback. Additional tests must protect meaningful behavior while remaining maintainable through unrelated component changes.

We evaluated Storybook 10.6.1's maintained skills and tools in a separate worktree. An agent discovered SearchSelect, added a cancellation regression story, ran a focused test, and produced preview and local-review links. The test detected a temporary defect that cleared the selection on dismissal. After restoring the component, all 40 story and native browser tests, frontend typechecking, lint, and the Storybook build passed. This demonstrates a working integration; it does not establish that generated tests are automatically valuable or measure comparative agent performance.

The evaluation exposed three constraints: native TypeScript 7 lacks compiler APIs needed by Storybook's metadata extraction; aliased imports in colocated stories can omit component APIs; and affected-story discovery can return an empty result despite a relevant diff. Generated examples can also contain unresolved helpers or unsuitable imports.

Storybook's [official tooling](https://storybook.js.org/docs/ai/mcp/overview) provides discovery, documentation, tests, previews, and reviews in one maintained integration. Its [Codex plugin](https://github.com/storybookjs/storybook/blob/next/code/lib/codex-plugin/README.md) is an optional experimental installation convenience. Community bundles such as [storybook-workbench](https://github.com/strongeron/storybook-workbench) offer useful audits and state-selection guidance, but introduce a larger workflow and an additional source of instructions to maintain. Source inspection and test scripts alone remain useful fallbacks but do not provide the same integrated discovery and review workflow.

## Decision

Adopt the guidance shipped with the installed Storybook version and the official `@storybook/addon-mcp` development addon. Model Context Protocol (MCP) exposes the local Storybook tools to compatible agents; the project-scoped Storybook CLI also makes them available without requiring a globally configured plugin or fixed server port. Keep practical commands and repository overrides in [frontend AGENTS.md](../../../apps/frontend/AGENTS.md).

Agents discover components and verify their APIs before composing UI, develop meaningful isolated stories, run focused tests while iterating, and inspect previews in a browser. They use a server from the same checkout, with separate ports for concurrent worktrees. Generated documentation and affected-story lists require verification against component sources, stories, and the actual diff when incomplete or inconsistent.

Keep ADR-023's selective story scope and existing browser-test projects. A visual example need not gain an extra assertion. Each behavioral test must identify a concrete regression and assert its observable outcome through accessible queries and awaited interactions. Prefer deterministic controlled state and real seams, following [ADR-017](./017-stubs-and-mocks.md). Avoid private selectors, broad snapshots, arbitrary delays, duplicated production logic, and exhaustive prop combinations. When a regression test's value is uncertain, verify it against a plausible temporary defect and restore production code afterwards. The complete component suite remains the handoff check because focused Storybook tool runs do not include the separate native browser specs.

Use `react-docgen-typescript` for component metadata. Until the native compiler supplies the required APIs, provide the TypeScript 6 API package alongside native TypeScript 7 in the frontend: Storybook resolves the API through `typescript`, while `tsc` remains the native compiler. Use relative imports for a colocated story's main component so metadata extraction resolves its API. This compatibility arrangement supports documentation extraction and does not change the project's compiler choice.

## Consequences

Agents can discover existing components and iterate on isolated states without application authentication or backend services. Maintained upstream guidance reduces copied instructions that drift from the installed tool version. The repository's test-quality rules constrain blanket upstream recommendations about story coverage and mocking.

The frontend gains a development dependency and two TypeScript package resolutions. The compatibility arrangement changes frontend peer resolution and increases lockfile churn; upgrades must verify the native compiler, component metadata, both browser-test projects, and the Storybook build together. Revisit the arrangement when native TypeScript's APIs become compatible with Storybook.

Storybook's AI capabilities remain in preview and may change. Generated documentation and dependency-based discovery remain fallible, so source inspection and the full component suite continue to provide necessary checks. Tool availability improves feedback but does not replace review of test value or browser inspection of visual changes.

Acceptance is followed by applying the evaluated addon, metadata configuration, package aliases, story imports, and agent guidance. Routine UI work must not install or upgrade tooling as a side effect. Detailed operating instructions belong in frontend AGENTS.md; this record preserves the choice and its tradeoffs.
