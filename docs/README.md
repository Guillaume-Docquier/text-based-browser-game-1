# Documentation Map

Use this map to find the smallest useful documentation set for a change. Do not read every document by default; read the routing docs, then the task-specific docs, then verify against the code.

## Overview

| Need                          | Read                                                                   |
| ----------------------------- | ---------------------------------------------------------------------- |
| Project summary               | [../README.md](../README.md)                                           |
| Human contribution policy     | [../CONTRIBUTING.md](../CONTRIBUTING.md)                               |
| Agent workflow and commands   | [../AGENTS.md](../AGENTS.md)                                           |
| Common domain vocabulary      | [glossary.md](./glossary.md)                                           |
| Behavioral requirement format | [Skill](../.agents/skills/author-behavioral-requirements/SKILL.md)     |
| TypeScript coding standards   | [typescript-coding-standards.md](./typescript-coding-standards.md)     |
| Product direction             | `game-design/`                                                         |
| Game design decisions index   | [game-design/decisions/README.md](./game-design/decisions/README.md)   |
| New or changed GDDR workflow  | [game-design/decisions/how-to.md](./game-design/decisions/how-to.md)   |
| Architecture decisions index  | [architecture/decisions/README.md](./architecture/decisions/README.md) |
| Current architecture overview | [Root architecture](../ARCHITECTURE.md)                                |

## Game design

- `game-design/brainstorm/` is where we keep future and past ideas.
- `game-design/decisions/` is where we keep durable decisions about the game's philosophy and direction.

## Architecture

Start with the root architecture overview and follow its links to the area you are changing. The decision records explain why the project adopted those designs.

## Source Of Truth

- The code is the source of truth for current behavior.
- Accepted GDDRs are the source of truth for durable game design decisions.
- Accepted ADRs are the source of truth for durable architecture decisions.
- Scoped `ARCHITECTURE.md` files describe the design and implementation rules for their directories.
- Scoped `TESTING.md` files cover test selection, conventions and commands.
- Scoped `AGENTS.md` files cover agent workflow and verification. The [root instructions](../AGENTS.md#scoped-instructions) explain how to apply all three.
- Files under `game-design/brainstorm/` are design notes. They do not mean a feature is implemented.

## Before Changing Docs

- Keep docs concise and chunked. Prefer adding a routing pointer over duplicating a rule.
- Update [glossary.md](./glossary.md) when adding project vocabulary with a specific meaning.
- Update [architecture/decisions/README.md](./architecture/decisions/README.md) when an ADR is accepted, deprecated, superseded, or becomes relevant to a new task category.
- If code and docs disagree, inspect the live code and call out the mismatch before rewriting behavior or policy.
