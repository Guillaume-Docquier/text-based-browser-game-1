# Use Server-Sent Events over HTTP/2

## Status

Proposed in [#451](https://github.com/Guillaume-Docquier/text-based-browser-game-1/issues/451).

## Context

Open play tabs need current turn status and Readiness even while players are idle. Polling the full player view repeats work and delays updates. Server-Sent Events (SSE) provide a persistent HTTP response for updates from the server to the browser.

Chromium typically allows six HTTP/1.1 connections per origin across tabs. Each SSE response occupies one connection for its lifetime. Six open streams can delay short requests such as Lock in. HTTP/2 multiplexes independent streams on a shared connection. Each connection still has a concurrent stream limit.

## Decision

Use same-origin SSE for live server-to-browser updates. Subscriptions use the existing API authentication. Client mutations use regular HTTP requests.

Require HTTPS and HTTP/2 on the browser-facing connection at the Railway public edge and in Vite for local development and Playwright. The proxy can forward requests to Express over HTTP/1.1.

The public proxy must forward SSE events as they arrive. A browser reconnects when the connection closes or goes silent. Each new stream sends the current snapshot, so the browser can resume after an edge timeout without replaying missed events.

## Consequences

Open tabs can receive updates while short API requests share the same origin. Development requires a trusted localhost certificate. Playwright verifies HTTP/2 on the subscription response. After deployment, use a signed-in browser at the Railway public endpoint to confirm that the subscription uses `h2` and delivers an update while its response remains open.

See [Railway public networking](https://docs.railway.com/networking/public-networking/specs-and-limits), [HTTP/2](https://www.rfc-editor.org/rfc/rfc9113.html), [Caddy streaming](https://caddyserver.com/docs/caddyfile/directives/reverse_proxy#streaming).
