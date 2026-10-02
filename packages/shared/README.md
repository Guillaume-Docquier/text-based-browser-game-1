# Shared package

The `shared` package contains persistence agnostic domain definitions and gameplay behavior used by the frontend and backend. Its behavioral areas include galaxy creation, action submission, and turn resolution. It also contains the independent Test Ruleset used by shared tests and backend test setup.

Import shared code through its explicit subpath exports, such as `shared/domain/...`, `shared/galaxy-creation/...`, or `shared/turn-resolution/...`. The package has no root barrel; application projections, API contracts, repository models, database rows, and the backend Standard Ruleset remain with their owning applications.

Run the package checks with `pnpm --filter shared checks`.
