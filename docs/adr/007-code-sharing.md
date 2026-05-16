# Code Sharing

## Status

Accepted

## Context

Current Railway packaging and backend runtime constraints make local cross-project runtime sharing inside this monorepo impractical.

## Decision

Publish shared runtime utilities through [@guillaume-docquier/tools-ts](https://github.com/Guillaume-Docquier/tools-ts) and consume them as a package.

## Consequences

Adds a package boundary and release flow.

Keeps deploy/runtime setup simple while still enabling shared utilities.
