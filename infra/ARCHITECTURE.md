# Infrastructure

Run services developed in this repository directly during development. Use Docker for third-party services such as Postgres. See [ADR-002](../docs/architecture/decisions/002-avoid-docker-for-dev.md).

In development, Vite serves the browser over HTTPS with HTTP/2 and proxies API requests to the backend over HTTP. The Railway public edge serves HTTPS with HTTP/2 in production. Caddy forwards `/api` requests to the backend and strips the prefix. [config.json](reverse-proxy/config.json) records the proxy configuration. See [ADR-005](../docs/architecture/decisions/005-reverse-proxy.md) and [ADR-037](../docs/architecture/decisions/037-use-server-sent-events-over-http-2.md).
