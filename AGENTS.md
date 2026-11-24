# Cosmic Empires

Everything is in TypeScript. Never write JavaScript files if you can do it in TypeScript.

## Scoped instructions

For each directory you work in, read the existing `AGENTS.md` and `ARCHITECTURE.md` files from the repository root down to that directory. When choosing, writing, or running tests, also read the `TESTING.md` files along the same path. Apply guidance from root to leaf. A local exception overrides only the inherited rule it identifies. For changes in multiple directories, follow the path for each one.

## Project priorities

Cosmic Empires is a multiplayer turn based space strategy game where games span over weeks or months.

The goal is to build a game that's as fun as persistent browser games, but that are finite and don't reward being the most active player.

The project is only getting started, and we are focused on building strong foundations. We've built the infrastructure, deployed on Railway, established the tech that we will use, and developed testing strategies.

Code quality and architecture design choices matter more than speed of execution.

## Documentation

- Before writing TypeScript, read the [TypeScript coding standards](docs/typescript-coding-standards.md), including the code comment conventions.
- Read the [glossary](docs/glossary.md) for project terms and update it when introducing new vocabulary.
- Before changing architecture, read the [ADR index](docs/architecture/decisions/README.md) and the relevant accepted decisions. Discuss any contradiction with the human.
- Before implementing gameplay, read and follow the relevant [accepted game design decisions](docs/game-design/decisions/README.md). Discuss design mismatches with the human before changing direction. New GDDRs require explicit human approval.

When editing documentation, use the [documentation map](docs/README.md) to find relevant guidance. Keep instructions concise and link to the rule where it applies. Verify documentation claims against the code.

For documentation-only changes, run only oxfmt in write mode on the changed files and `git diff --check`.

## Commands

Always use pnpm, never use npm.

When formatting the code, always run oxfmt with write. oxfmt is deterministic, there's no point in checking before applying formatting.

If the database container is not running, call `pnpm db:up`

Never change environment variable values yourself. Ask the user to make the required change.

All code changes require a pull request before merging to main. CI enforces the quality gates there.
