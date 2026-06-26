# Reverse Proxy

## Status

Accepted

## Context

The frontend and backend are separate services. The backend does not serve the frontend files.
This allows us to deploy both independently, but it means they live on different origins, causing cors issues and making auth (clerk) harder too.

## Decision

We'll deploy a reverse proxy to put both services on the same origin.

In development, we won't need a standalone reverse proxy. We'll use vite's dev server.

In production, however, we'll deployed a Caddy Reverse Proxy from a Railway template:

- https://railway.com/deploy/7uDSyj
- https://github.com/railwayapp-templates/caddy-reverse-proxy

We didn't configure it, but it works by:

- Proxying our backend on `/api`
- Removing `/api` from the forwarded request, so we don't have to assume this in our backend routes

### Configuration

The [config.json](../../infra/reverse-proxy/config.json) file contains the configuration of the reverse proxy.

This is not truly used to configure it, just to represent it.

## Consequences

We should eventually version control the reverse proxy template to fully own it and deploy from that.

For now it's not a problem, it's fairly simple. But if we moved off of Railway, we'd need it.

We could also serve it in dev instead of using vite. Not sure if that's worth it?
