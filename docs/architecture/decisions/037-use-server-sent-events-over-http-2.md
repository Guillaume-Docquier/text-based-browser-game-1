# Use SSE over HTTP/2

## Status

Accepted

## Context

We plan to use server-sent events (SSE) to send updates to the frontend without polling. SSE can reuse the same-origin API and its authentication.

However, SSE over HTTP/1.1 in Chromium defaults to six connections in the pool shared by tabs for the game origin. With one SSE subscription per play tab, six tabs can fill that pool and throttle other connections. HTTP/2 lets those requests and subscriptions use separate streams on a shared connection. [Chromium connection pool](https://chromium.googlesource.com/chromium/src/+/ef6ba930ba83b74518f3ed7d89247c4c82e84764/net/http/http_stream_pool.h), [RFC 9113, Streams and Multiplexing](https://www.rfc-editor.org/rfc/rfc9113.html#section-5).

## Decision

Use SSE when real time updates are needed and use HTTP for any mutations the frontend wants to do. Serve the deployed game origin over HTTPS with HTTP/2 on the browser-facing connection to avoid the six connections pool restrictions of HTTP/1.1.

HTTP/2 with Vite will require HTTPS, so we'll need local certificates for dev and for playwright.

## Consequences

Open play tabs can receive updates while short API requests proceed on other streams, up to the concurrent stream limit advertised by the HTTP/2 endpoint. [RFC 9113, Stream Concurrency](https://www.rfc-editor.org/rfc/rfc9113.html#section-5.1.2).

The public edge must support HTTP/2 and streaming responses. Railway supports HTTP/2 on its public HTTPS endpoint and caps the lifetime of HTTP responses, so clients must reconnect when a stream closes and receive the current turn state. [Railway public networking limits](https://docs.railway.com/networking/public-networking/specs-and-limits).
