# API slices

Each slice contains a router, one use case per operation, and a repository. The router defines the input and output schemas and calls a single use case through `toTrpcOutput`.

- Put the business logic for one operation in its use case. Pass the query or command as the first argument and server-authoritative data as the second. Omit arguments the operation does not need.
- Keep the query or command schema and its derived type in the companion `*.query.ts` or `*.command.ts` file. Keep operation errors, the rollback error subclass and the response-code mapper together in `*.error.ts`.
- Repositories own database access and provide the queries and writes their use cases need. The API owns its frontend projections. Shared domain models live in the shared package.
- Derive named frontend contract types from the router output in [types.ts](types.ts). See the [package boundaries](../../../../ARCHITECTURE.md#package-boundaries).

See [ADR-033](../../../../docs/architecture/decisions/033-router-use-case-repository.md) for the slice design and [ADR-009](../../../../docs/architecture/decisions/009-trpc-return-types.md) for the tRPC router return-type exception.
