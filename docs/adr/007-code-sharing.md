# Code Sharing

## Status

Accepted

## Context

We needed to share utils, like Result, Assert, Logger, etc. This has proven to be quite hard with current constraints:

- We deploy to Railway, and they build the image based on only the project folder's source code
- We run the backend as native Typescript without transpilation or bundler

We really like the above points. Low tooling, low configuration... it's simple.
However, this means that we effectively cannot share code in the monorepo.

## Decision

We've created [@guillaume-docquier/tools-ts](https://github.com/Guillaume-Docquier/tools-ts) which is published on npm to share code.

## Consequences

There's a bit of indirection, but the package publishing is fully automated and tools-ts should not change much due to the nature of those utils (small, pure, focused).

The next problem will be about dealing with api clients, which also potentially requires sharing code.  
If we use trpc, I think it'll be fine because we'd only be sharing types from backend to frontend, which are stripped when building. Fingers crossed.
