import { Command } from "commander"
import { createClusterCommand } from "./command-cluster.ts"
import { createGalaxyCommand } from "./command-galaxy.ts"
import { createSpiralCommand } from "./command-spiral.ts"

const program = new Command().name("map-gen").description("Generate SVG previews of map generators.")

program.addCommand(createClusterCommand())
program.addCommand(createSpiralCommand())
program.addCommand(createGalaxyCommand())

await program.parseAsync()
