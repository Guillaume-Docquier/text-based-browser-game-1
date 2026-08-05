import { Command } from "commander"
import { createDiscCommand } from "./command-disc.ts"
import { createGalaxyCommand } from "./command-galaxy.ts"
import { createSpiralCommand } from "./command-spiral.ts"

const program = new Command().name("map-gen").description("Generate SVG previews of map generators.")

program.addCommand(createDiscCommand())
program.addCommand(createSpiralCommand())
program.addCommand(createGalaxyCommand())

await program.parseAsync()
