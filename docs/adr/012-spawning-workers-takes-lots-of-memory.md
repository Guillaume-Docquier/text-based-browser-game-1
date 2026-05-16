# Spawning Workers Takes Lots of Memory

## Status

Lesson Learned

## Context

Repeatedly crashing and respawning a worker caused inflated memory/CPU usage. Keeping the worker long-lived significantly reduced resource usage.

## Decision

Do not design workers to churn. Keep workers long-lived unless a restart is required.

Retain local memory profiling utility (`printMemoryUsage`) for future diagnostics.

## Consequences

Lower runtime cost and more stable resource behavior.
