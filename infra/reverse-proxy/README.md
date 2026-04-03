# Reverse Proxy

## Setup

In development, we don't need the reverse proxy. We use vite's dev server.

In production, however, we deployed a Caddy Reverse Proxy from a Railway template:

- https://railway.com/deploy/7uDSyj
- https://github.com/railwayapp-templates/caddy-reverse-proxy

We didn't configure it, but it works by:

- Proxying your backend on `/api`
- Removing `/api` from the forwarded request, so you don't have to assume this in your backend routes

## Config

The [config.json](config.json) file contains the configuration of the reverse proxy.

This is not truly used to configure it, just to represent it.

## Long term

We should copy the template here and control the reverse proxy and its configuration.

For now it's not a problem, it's fairly simple. But if we moved off of Railway, we'd need it.

We could also serve it in dev instead of using vite. Not sure if that's worth it?
