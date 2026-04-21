# Reverse Proxy

## Status

Accepted

## Context

The frontend and backend are separate services. The backend does not serve the frontend files.
This allows us to deploy both independently, but it means they live on different origins, causing cors issues and making auth (clerk) harder too.

## Decision

We'll deploy a reverse proxy to put both services on the same origin.

In dev, we'll leverage [Vite's proxy feature](https://vite.dev/config/server-options#server-proxy) to mimic this, requiring 0 additional infra.

## Consequences

It's a bit more infra, but simpler configurations.
