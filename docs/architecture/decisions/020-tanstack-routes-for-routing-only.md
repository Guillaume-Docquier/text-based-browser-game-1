# Tanstack Routes For Routing Only

## Status

Accepted

## Context

With Tanstack file base routing, you can't group files under `routes` because they must represent actual routes. This makes it so you'd want to put all your page's code in the route file, which doesn't scale.

## Decision

Route files should just do the routing, similar to our backend routers from ADR-010. The UI implementation will be done under `frontend/src/features/`, which leaves us all the freedom to do vertical slices and split files as we want.

## Consequences

Sometimes it might be hard to map a file to its route, but the code organization will be much better.
