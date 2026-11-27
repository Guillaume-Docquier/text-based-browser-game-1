import path from "node:path"
import { Command } from "commander"
import { createClusterCommand } from "./command-cluster.ts"
import { createGalaxyCommand } from "./command-galaxy.ts"
import { createSpiralCommand } from "./command-spiral.ts"

const program = new Command().name("map-gen").description("Generate SVG previews of map generators.")

program.addCommand(createClusterCommand())
program.addCommand(createSpiralCommand())
program.addCommand(createGalaxyCommand())
program
  .command("previews")
  .description("Regenerate the six tracked galaxy previews with seed 1234.")
  .action(async () => {
    const directory = path.resolve(import.meta.dirname, "../preview")
    for (const pattern of [createClusterCommand(), createSpiralCommand()]) {
      const name = pattern.name()
      await pattern.parseAsync(["--seed", "1234", "--output", path.join(directory, `${name}.svg`)], { from: "user" })
      await createGalaxyCommand().parseAsync(["--grid", name, "--seed", "1234", "--output", path.join(directory, `${name}-galaxy.svg`)], {
        from: "user",
      })
    }
  })

await program.parseAsync()
