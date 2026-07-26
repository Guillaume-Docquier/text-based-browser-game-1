# Spawning Workers Takes Lots of Memory

## Status

Accepted

## Context

Our simple Node application with main thread + 1 worker was taking a lot of memory (~250MB), which was surprising.

The application at the time was:

- main thread: Express + TRPC CRUD app with a DB connection and very few services
- 1 worker: DB connection and a logging loop on an interval, which (intentionally) crashed after 5 seconds and respawned

As it turns out, spawning the worker over an over meant that NodeJS couldn't correctly analyze the real memory footprint of our app.

Just by removing the (intentional) crash every 5 seconds, the memory usage dropped from ~250MB to ~125MB.

CPU went down from 0.2vCPU to nearly 0, same for Ingress. This is probably due to the CPU spike for creating the worker and the DB connection?

At this scale, CPU cost is 33% and RAM cost is 66%. So bringing the RAM down is quite important.

## Decision

Don't be silly, creating workers all the time costs money! (yes, we're talking cents, but it's still money out the window)

We also kept the `printMemoryUsage` utility that we used to profile this locally. It might be handy again in the future.

## Consequences

Now we know!
