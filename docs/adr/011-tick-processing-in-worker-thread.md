# Tick Processing in Worker Threads

## Status

Accepted

## Context

Game ticks are CPU-heavy and can vary in frequency and concurrency. We need asynchronous processing with a path to future scaling.

## Decision

Run tick processing in one worker thread within the web server for now.

Keep worker code decoupled so it can be extracted later.

Dependency direction: web server may depend on worker code; worker code must not depend on web server.

## Consequences

No efficient horizontal scaling yet because worker is co-deployed with web server.

Vertical scaling (more threads/resources) remains possible if needed.
