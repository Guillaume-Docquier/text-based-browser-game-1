# Shared package

The `shared` package contains pure, persistence agnostic, isomorphic domain modules used by the frontend and backend.

Every directory under `src/` is an independent module, with its own architecture and testing.

Public domain functions take data and produce data. Callers own I/O and persistence. For example, galaxy creation returns the generated galaxy, and the backend decides how to store it.

The caller controls time and randomness. When an operation needs the current time, pass a clock and call its `now()` method at the point the operation needs it. Tests can then hold or advance time between reads. When an operation generates random values, pass the caller's seeded `Rng` through the computation. The same inputs, clock readings, and initial generator state must produce the same result.

There is no package build. Code must support isolated modules and erasable TypeScript syntax so it can run natively in Node and be bundled for the browser. Do not use features such as enums or decorators.
