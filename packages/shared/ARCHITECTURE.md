# Shared package

The `shared` package contains persistence agnostic domain definitions and gameplay behavior used by the frontend and backend. The package is pure and isomorphic.

The package owns [galaxy creation](src/galaxy-creation/generation/PROCEDURAL_GENERATION_PRIMER.md) and [Turn Resolution](src/turn-resolution/ARCHITECTURE.md).

There is no package build. Code must support isolated modules and erasable TypeScript syntax so it can run natively in Node and be bundled for the browser. Do not use features such as enums or decorators.
