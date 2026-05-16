# Manual Production Database Management

## Status

Accepted

## Context

Migration and seed scripts exist, but automated Railway production migration flow is not yet defined.

## Decision

Run production migrations manually using existing scripts with production env configuration.

## Consequences

Higher risk of operator mistakes (for example, running commands against the wrong database).
