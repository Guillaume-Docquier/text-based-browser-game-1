import path from "node:path"
import { Command } from "commander"
import { createClusterCommand } from "./command-cluster.ts"
import { createGalaxyCommand } from "./command-galaxy.ts"
import { createSpiralCommand } from "./command-spiral.ts"

export function createMapGenProgram(): Command {
  const program = new Command().name("map-gen").description("Generate SVG previews of map generators.")
  program.addCommand(createClusterCommand())
  program.addCommand(createSpiralCommand())
  program.addCommand(createGalaxyCommand())
  program
    .command("previews")
    .description("Generate the six galaxy previews with seed 1234.")
    .option("--output-dir <directory>", "directory for the six SVGs", path.resolve(import.meta.dirname, "../preview"))
    .action(async ({ outputDir }: { outputDir: string }) => {
      for (const pattern of [createClusterCommand(), createSpiralCommand()]) {
        const name = pattern.name()
        await pattern.parseAsync(["--seed", "1234", "--output", path.join(outputDir, `${name}.svg`)], { from: "user" })
        await createGalaxyCommand().parseAsync(["--grid", name, "--seed", "1234", "--output", path.join(outputDir, `${name}-galaxy.svg`)], {
          from: "user",
        })
      }
    })
  return program
}

if (import.meta.main) {
  await createMapGenProgram().parseAsync()
}
