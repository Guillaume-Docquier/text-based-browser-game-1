# Galaxy Creation tests

## Generator snapshots

Because galaxy generation is procedural and large scale, it is hard to assert in code that the overall generated galaxy makes sense. It is easier to inspect visually sometimes.

When an intentional generator change alters a snapshot, run `pnpm map-gen:previews` to regenerate the [tracked previews](previews/). Each galaxy command produces an overview and a sample of star systems. Inspect the SVG before updating the expected Vitest snapshots.
