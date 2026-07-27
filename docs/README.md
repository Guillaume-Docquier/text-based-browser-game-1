# Documentation Map

Use this map to find the smallest useful documentation set for a change. Do not read every document by default; read the routing docs, then the task-specific docs, then verify against the code.

## Overview

| Need                          | Read                                                                   |
| ----------------------------- | ---------------------------------------------------------------------- |
| Project summary               | [../README.md](../README.md)                                           |
| Human contribution policy     | [../CONTRIBUTING.md](../CONTRIBUTING.md)                               |
| Agent workflow and commands   | [../AGENTS.md](../AGENTS.md)                                           |
| Common domain vocabulary      | [glossary.md](./glossary.md)                                           |
| TypeScript coding standards   | [typescript-coding-standards.md](./typescript-coding-standards.md)     |
| Product direction             | `game-design/`                                                         |
| Game design decisions index   | [game-design/decisions/README.md](./game-design/decisions/README.md)   |
| New or changed GDDR workflow  | [game-design/decisions/how-to.md](./game-design/decisions/how-to.md)   |
| Architecture direction        | `architecture/`                                                        |
| Architecture decisions index  | [architecture/decisions/README.md](./architecture/decisions/README.md) |
| New or changed ADR workflow   | [architecture/decisions/how-to.md](./architecture/decisions/how-to.md) |
| Current architecture overview | [architecture/overview.md](./architecture/overview.md)                 |

It all starts with game design:

- `game-design/brainstorm/` is where we keep future and past ideas.
- `game-design/decisions/` is where we keep track of game design decisions to understand why the game is the way it is, which leads to systems.
- `game-design/systems/` is where we keep track of how the game mechanics work, in detail, and which decisions they support.

Then we derive the architecture:

- `architecture/decisions/` is where we keep track of architecture decisions to understand why the codebase is the way it is, which leads to implementation.

## Source Of Truth

- The code is the source of truth for current behavior.
- Accepted ADRs are the source of truth for durable architecture decisions.
- `AGENTS.md` is the source of truth for agent workflow, verification, commands, and project-specific gotchas.
- Files under `game-design/brainstorm/` are design notes. They do not mean a feature is implemented.

## Before Changing Docs

- Keep docs concise and chunked. Prefer adding a routing pointer over duplicating a rule.
- Update [glossary.md](./glossary.md) when adding project vocabulary with a specific meaning.
- Update [architecture/decisions/README.md](./architecture/decisions/README.md) when an ADR is accepted, deprecated, superseded, or becomes relevant to a new task category.
- If code and docs disagree, inspect the live code and call out the mismatch before rewriting behavior or policy.
