# Deterministic Data-Driven Rules Engine

## Status

Planned

- [ ] Phases
- [ ] Mechanics
- [ ] Actions
- [ ] Rulesets

## Context

Players need a large enough Action catalogue to express distinct strategies while still being able to understand why a Turn resolved as it did. If every Action has bespoke rules, similar behavior will drift, interactions will become difficult to reason about, and adding content will make the game less predictable rather than deeper.

Designers also need to combine familiar rules into new Actions and tune a game without rewriting its resolution logic. In the future, the same foundation should support alternate game modes without making each mode a separate implementation.

## Decision

Actions declaratively compose reusable Mechanics. An Action Definition describes its presentation, choices, and ordered Mechanics rather than owning bespoke resolution code.

A Ruleset defines the available Action Definitions and their configured Mechanics. The engine defines the supported Phases and their fixed order. It also assigns each supported Mechanic type to a Phase and defines deterministic ordering and tie-breaking rules within that Phase. Composition is ordered: one Mechanic may change the state or Effects that later Mechanics observe, cancel, or modify.

The initial scope gives each game one persisted Ruleset. That Ruleset is fixed when the game starts so every Turn in that game continues to use the same rules. Initially, games may all use the same developer-authored default Ruleset.

Any random outcome that affects the game must be generated deterministically from persisted game data. Given the same Ruleset and game inputs, Turn Resolution produces the same outcome and can be replayed or explained.

Player-authored Rulesets and multiple simultaneous games using different alternate modes are future capabilities. A single game still resolves under one fixed Ruleset rather than combining multiple Rulesets.

## Pros

- Players can learn reusable Mechanics and apply that knowledge across many Actions.
- Designers can add, remove, and tune Actions by composing established behavior.
- Explicit ordering makes simultaneous choices more predictable and explainable.
- Deterministic resolution supports replay, debugging, and trustworthy outcome logs.
- Persisted Rulesets give games stable rules while leaving a path to alternate modes and player-authored content.

## Cons

- A finite Mechanic vocabulary may not express every desirable Action cleanly; one-off behavior can pressure the engine toward excessive abstraction.
- Ordered composition creates interaction risks when an earlier Mechanic changes, cancels, or invalidates a later one.
- Rulesets and Action submissions require strong validation so invalid combinations cannot enter or corrupt a game.
- Compatibility and versioning may eventually be required for long-running games, but are deliberately deferred until the engine has a concrete migration need.
- Deterministic random outcomes require carefully specified seeds, ordering, and tie-breakers to remain reproducible.
