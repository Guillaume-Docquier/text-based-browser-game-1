# Reverse Proxy

## Status

Accepted

## Context

Frontend and backend are deployed separately and run on different origins. This creates CORS and authentication complexity.

## Decision

Deploy a reverse proxy so frontend and backend share one origin.

In development, use Vite proxy to mirror production routing without extra infrastructure.

## Consequences

Adds one infrastructure component, but simplifies cross-origin and auth configuration.
