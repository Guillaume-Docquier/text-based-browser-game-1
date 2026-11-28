# Galaxy Creation tests

## Generator snapshots

Because galaxy generation is procedural and large scale, it is hard to assert in code that the overall generated galaxy makes sense. It is easier to inspect visually sometimes.

When an intentional generator change alters a snapshot, run `pnpm map-gen:previews` to regenerate the [tracked previews](previews/). Each galaxy command produces an overview and a sample of star systems. Inspect the SVG before updating the expected Vitest snapshots.

## Behavioral requirements testing

Behavioral requirements are tested in `createGalaxy.test.ts`. Property based testing using fast-check and mutation testing using stryker-js are leveraged to provide adequate coverage and verify it.

Every requirement should be covered by a test with the test name containing the exact requirement id and the exact requirement description.

The mutation testing part is still under iteration. There are no thresholds configured and the CI step is informational until we have a good enough workflow and coverage.

Run mutation tests with `pnpm --filter shared mutation:galaxy-creation`
