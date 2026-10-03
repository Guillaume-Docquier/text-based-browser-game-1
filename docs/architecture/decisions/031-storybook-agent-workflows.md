# Adopt Storybook's Maintained Tooling For Agent Component Workflows

## Status

Accepted

### Amendment history

- 2026-10-03: Route operating instructions and repository overrides through a discoverable repository skill, keeping frontend AGENTS.md focused on standing conventions.

## Context

[ADR-023](./023-storybook-for-design-system-inspection.md) establishes Storybook for isolated component inspection and browser component tests. Agents need access to component APIs and focused feedback to reuse existing components and develop meaningful states without starting application services.

Storybook's [official tooling](https://storybook.js.org/docs/ai/mcp/overview) combines component discovery and API documentation with focused tests, previews, and local reviews. We evaluated its maintained skills and tools in a separate worktree. The evaluation demonstrated that an agent could discover an existing component, develop an isolated story that detects a behavioral regression, and share previews and review links.

Storybook's component metadata extraction requires compiler APIs that native TypeScript 7 does not yet provide. The evaluation also showed that generated documentation and affected-story discovery can be incomplete.

Source inspection and test scripts remain useful fallbacks but lack the integrated discovery and review workflow. Community skill bundles add another source of instructions to maintain alongside Storybook's own guidance.

## Decision

Adopt the skills shipped with the installed Storybook version and the official `@storybook/addon-mcp` development addon for agent component workflows. Make the local tools available through Model Context Protocol (MCP) and the project-scoped Storybook CLI.

Preserve ADR-023's selective story scope and existing browser-test coverage. Behavioral tests must protect concrete regressions through observable outcomes; visual examples do not automatically require assertions. Follow [ADR-017](./017-stubs-and-mocks.md) for test doubles.

Use the TypeScript 6 compiler API for component metadata extraction while retaining native TypeScript 7 as the project's compiler. This compatibility dependency is temporary, pending native compiler API support.

Keep operating instructions and repository overrides in the [storybook-agent-workflow skill](../../../.agents/skills/storybook-agent-workflow/SKILL.md), discovered and selected through its task description.

## Consequences

Agents gain an integrated workflow for component reuse, isolated development, and review without application authentication or backend services. Maintained upstream guidance reduces instruction drift, while repository rules preserve selective coverage and meaningful tests.

The frontend carries an additional development addon and a temporary compiler API dependency. Storybook and TypeScript upgrades must preserve metadata extraction and native compilation compatibility. Revisit the compatibility dependency when native TypeScript provides the required APIs.

Storybook's AI capabilities remain in preview and may change. Generated documentation and affected-story discovery are advisory: source inspection and the full component suite remain necessary. Tooling improves feedback but still requires judgment about test value and visual correctness.
