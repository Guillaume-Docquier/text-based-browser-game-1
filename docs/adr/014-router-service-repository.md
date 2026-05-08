# Router - Service - Repository

## Status

Accepted

Supersedes [Router - Controller - Repository](./010-router-controller-repository.md).

## Context

ADR 010 established a useful separation between the API boundary, business logic, and persistence. The structure worked, but the name `controller` was misleading because many frameworks and teams use that word for HTTP handlers. In this repo, the HTTP/tRPC boundary is the router layer.

Issue [#126](https://github.com/Guillaume-Docquier/text-based-browser-game-1/issues/126) considered moving to one use-case per endpoint, but that would add wiring before the repo has enough complexity to benefit from it. Issue [#142](https://github.com/Guillaume-Docquier/text-based-browser-game-1/issues/142) settles the current step: rename controllers to services.

## Decision

Keep the same three-layer backend structure, with updated names:

- Routers: API layer, the only place that knows about Express/tRPC.
- Services: business logic that bridges routers and repositories.
- Repositories: persistence layer, the only place that knows about Drizzle/Postgres.

Services may coordinate multiple repositories and enforce application rules. They should not know about Express, tRPC, Drizzle, or Postgres directly.

Do not split services into one use-case module per endpoint as part of this decision. That can be revisited when the current service layer becomes too broad or too coupled.

## Consequences

The name `service` is broad, but it is less misleading in this codebase than `controller` because routers already own the API-handler role.

The existing boilerplate remains mostly unchanged. The benefit is a clearer layer name without changing runtime behavior or dependency flow.

If a service grows too large, we can extract narrower use-case helpers inside the service layer without changing the public router/service/repository architecture.
