# Turn Resolution tests

Run `pnpm --filter shared test --project turn-resolution` for the module tests. Test observable rules through `resolveTurn` and include the exact requirement ID and description in each behavioral test name. Use fast-check to exercise rules across turn states and random seeds.

Run `pnpm --filter shared mutation:turn-resolution` from the repository root. Stryker runs the module's Vitest tests against changes to its production TypeScript. Inspect the HTML or JSON report under `.stryker/reports/` in this directory. The mutation score is informational. An empty function body and type declarations produce no mutants.
