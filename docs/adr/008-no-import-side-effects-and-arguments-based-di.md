# No import side effects and arguments based DI

## Status

Accepted

## Context

Global-scope object creation hides dependencies and makes tests rely on import mocking.

## Decision

Outside entrypoints, do not create stateful objects in module global scope. Pass stateful dependencies via function arguments.

Only pure functions and immutable constants may be shared at module scope.

## Consequences

Dependencies and lifecycle become explicit and type-checked.

Slightly more boilerplate, but easier testing and reasoning.
