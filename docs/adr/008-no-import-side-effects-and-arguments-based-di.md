# No import side effects and arguments based DI

## Status

Accepted

## Context

The usual Express documentation shows the app, routers and controllers created in the global scope. This is quick to get started, but relies on stateful objects being created in the global scope.

This makes tests hard, because you have to mock imports.

It also makes code harder to reason about, because you don't declare stateful dependencies.

## Decision

Aside from the entrypoint, no stateful object should be created in the global scope. Any state should be shared via function arguments.

We can only share pure functions or immutable constants.

This makes dependencies explicit and allows us to control the lifecycle of everything.

## Consequences

Tests will be easier and we'll know at compile time if any dependency is missing.

It's a bit more boilerplate, but it's dumb and type safe boilerplate.
