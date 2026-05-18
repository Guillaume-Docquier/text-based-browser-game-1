# Stubs And Mocks In Tests

## Status

Accepted

## Context

Tests need two distinct kinds of test doubles:

- test data builders for domain objects;
- alternate implementations of production dependencies.

When tests build large objects inline, they become noisy and brittle. Small model changes force widespread test edits even when changed fields are irrelevant to the behavior under test.

At the same time, replacing production implementations too aggressively with fake implementations reduces confidence and can hide integration issues.

We need a clear distinction between stubs and mocks, with naming and usage rules that keep tests maintainable while preserving confidence in real behavior.

## Decision

We standardize these two patterns:

### Stubs

Stubs are factory functions to create data objects. They produce objects with fake data, but correct shape. Using stubs allows tests to only declare the data that they care about while creating structurally valid objects.

```ts
// MyData.stub.ts
export function createMyDataStub(overrides?: Partial<MyData>): MyData {
  return {
    // default values for MyData
    default: "value",
    other: 43,
    ...overrides,
  }
}

// myData.controller.test
it("should do something when other is equal to 1", () => {
  // Arrange
  const data = createMyDataStub({ other: 1 }) // no need to define `default` when the tests doesn't care about it

  // ...
})
```

### Mocks

Mock are alternate implementations of production dependencies. This is rarely used because we prefer testing production code. Use them only when a test must control or observe dependency behavior that cannot be exercised reliably with the real implementation.

```ts
// auth.service.mock.ts
export class AuthServiceMock implements IAuthService {
  /**
   * public Player so tests can easily control it
   */
  public player: Player | undefined

  public constructor({ player }: { player?: Player } = {}) {
    this.player = player
  }

  public authenticationMiddlewares(): RequestHandler[] {
    return [
      (req, _res, next): void => {
        req.player = this.player
        next()
      },
    ]
  }
}
```

## Consequences

Tests become easier to read because the intent is explicit:

- object setup uses stubs;
- behavior replacement uses mocks.

Tests become less fragile to unrelated model changes because stubs centralize default object creation.

The codebase gains consistent file naming and discoverability for test doubles.

By favoring real implementations and using mocks sparingly, we keep stronger confidence in production behavior while still enabling focused unit tests when isolation is necessary.
