# Router - Use Case - Repository

## Status

Accepted

Supersedes [ADR-010](./010-router-controller-repository.md).

## Context

ADR-010 evolved a lot, we tried differents things, and settled on a structure for the API that we like.

The big problems that we had were:

- Unclear and awkward model naming
- Easy to duplicate model code
- Bad error reporting
- Unclear zod schema ownership
- Controllers that could grow very large, when most of it didn't change often

We had good things as well, that we kept:

- Clear isolation of Trpc
- Clear isolation of Drizzle
- Somewhat clear ownership of business logic

The 3 layers were good, but their wiring / responsibilites weren't as good.

## Decision

We settled on router-useCase-repository, basically the same structure, but use cases are dedicated to single routes instead of grouped into a controller.

The router and repository still have all the logic to support all the useCases. For the router, this is not a problem, they are now super streamlined. For repositories, it's borderline, but still manageable.

We streamlined how errors are flowed back and how we share models.

### Router

Router are now forced to define the input and output schema, call a single use case wrapped in `toTrpcOutput`. Every route is now a 1-liner with explicit in/out.

### Use Case

Use Cases contain the logic for 1 operation. Their first argument is a query/command, the 2nd is server authoritative data. Either argument can be omitted if there's nothing to provide. This structure enables routers to be streamlined.

Use Cases have companion files:

- USE_CASE.query.ts
- USE_CASE.command.ts
- USE_CASE.error.ts
- Related Models with their schemas (no file suffix there)

Query/Command files host the above query/command parameters. They contain the schema and schema derived type.

Error files contain an error enum for all the errors that the use case can encounter. It also contains a RollbackError that takes a use case Error argument to support errors inside transactions, where you can only throw. And the final bit is a use case Error to response code + message mapper.

When an error is encountered, it is returned as a Failure. The router then uses the mapper to return the right code and message. This structure enables routers to be streamlined.

Colocating the Error, Rollback and Mapper makes it super easy to change. When updating error codes, you don't have to edit the router, only the error file. It is a bit coupled to Trpc, but it's so minor that we don't care.

The models are just in files with their name. The big unlock was establishing shared domain models in `shared/src/domain/` that made it clear what was core to the domain and what is a projection for the frontend. Every model in `backend/src/api/` is a projection for the frontend.

### Repository

Repositories haven't changed much, but they now shared models most of the time. There's little difference between what the use case want and what the repositories return. They are meant to provide use case specific queries / mutations, so there's no point in trying to make them define their own models.

## Consequences

The routers are now dead simple, the use cases that don't change often won't be touched because they're isolated. The repositories will still have quite a bit of churn, but only when the db schema changes so that should be manageable.

It's now much clearer where to put models (domain vs api) and when they can be shared.
