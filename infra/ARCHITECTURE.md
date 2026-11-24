# Infrastructure

Run services developed in this repository directly during development. Use Docker for third-party services such as Postgres. See [ADR-002](../docs/architecture/decisions/002-avoid-docker-for-dev.md).

Vite proxies API requests in development. In production, Caddy forwards `/api` requests to the backend and strips the prefix. [config.json](reverse-proxy/config.json) records the proxy configuration. See [ADR-005](../docs/architecture/decisions/005-reverse-proxy.md).

## HTTP/2 in development

Vite serves the game over `https://localhost` on the configured frontend port. This lets turn-state streams and short API requests share an HTTP/2 connection. The backend listens on its existing internal HTTP port.

For a trusted certificate in your development browser, use [mkcert](https://github.com/FiloSottile/mkcert) and run these commands from the repository root after installing its local CA with `mkcert -install`.

```powershell
New-Item -ItemType Directory -Force packages/frontend/.dev-tls
mkcert -cert-file packages/frontend/.dev-tls/localhost.pem -key-file packages/frontend/.dev-tls/localhost-key.pem localhost
```

Vite generates a self-signed certificate when these files are absent. Playwright accepts it in its isolated test browser. Railway provides public HTTPS and HTTP/2 in production.
