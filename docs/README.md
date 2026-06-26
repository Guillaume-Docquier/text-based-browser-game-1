# Documentation Map

Use this map to find the smallest useful documentation set for a change. Do not read every document by default; read the routing docs, then the task-specific docs, then verify against the code.

## Overview

| Need                          | Read                                                               |
| ----------------------------- | ------------------------------------------------------------------ |
| Project/product summary       | [../README.md](../README.md)                                       |
| Human contribution policy     | [../CONTRIBUTING.md](../CONTRIBUTING.md)                           |
| Agent workflow and commands   | [../AGENTS.md](../AGENTS.md)                                       |
| Common domain vocabulary      | [glossary.md](./glossary.md)                                       |
| TypeScript coding standards   | [typescript-coding-standards.md](./typescript-coding-standards.md) |
| Architecture decisions index  | [adr/README.md](./adr/README.md)                                   |
| New or changed ADR workflow   | [adr/how-to.md](./adr/how-to.md)                                   |
| Product direction             | `game-design/`                                                     |
| Product brainstorm            | `game-design/brainstorm`                                           |
| Current architecture overview | [architecture/overview.md](./architecture/overview.md)             |

## Source Of Truth

- The code is the source of truth for current behavior.
- Accepted ADRs are the source of truth for durable architecture decisions.
- `AGENTS.md` is the source of truth for agent workflow, verification, commands, and project-specific gotchas.
- Files under `game-design/brainstorm/` are design notes. They do not mean a feature is implemented.

## Before Changing Docs

- Keep docs concise and chunked. Prefer adding a routing pointer over duplicating a rule.
- Update [glossary.md](./glossary.md) when adding project vocabulary with a specific meaning.
- Update [adr/README.md](./adr/README.md) when an ADR is accepted, deprecated, superseded, or becomes relevant to a new task category.
- If code and docs disagree, inspect the live code and call out the mismatch before rewriting behavior or policy.
