# Duplicated Tools Versions

## Status

Accepted

## Context

Corepack and nvm are recursive, meaning they look up for their version file. This means that we only need 1 .nvmrc file and we only need the root package.json to hold the pnpm version.

However, Railway doesn't detect this and gets the versions wrong.

## Decision

We've duplicated the .nvmrc files in frontend and backend with a symlink, so that's not too bad.

But we can't symlink a property in package.json, so we had to duplicate the packageManager field in all package.json that are being deployed by Railway.

## Consequences

More management for tools versions, but they shouldn't change that frequently.
