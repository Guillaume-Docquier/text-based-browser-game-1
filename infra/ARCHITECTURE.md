# Infrastructure

Run services developed in this repository directly during development. Use Docker for third-party services such as Postgres. See [ADR-002](../docs/architecture/decisions/002-avoid-docker-for-dev.md).

Vite proxies API requests in development. In production, Caddy forwards `/api` requests to the backend and strips the prefix. [config.json](reverse-proxy/config.json) records the proxy configuration. See [ADR-005](../docs/architecture/decisions/005-reverse-proxy.md).
