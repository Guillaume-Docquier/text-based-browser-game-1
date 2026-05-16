# Avoid Docker for Dev

## Status

Accepted

## Context

Railway already builds deployment images. Local development already has required tooling, so containerizing app services adds overhead without clear benefit. Docker remains useful for third-party dependencies (for example, databases).

## Decision

Do not use Docker to run services we actively develop.

Use Docker for third-party infrastructure only.

Use WebStorm run configs for local app execution.

## Consequences

Non-developer runtime setup may be less convenient.

We do not optimize custom app images for dev; deployment image optimization can be added later if needed.
