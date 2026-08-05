import { Command } from "commander"
import { createDiscCommand } from "./command-disc.ts"
import { createSpiralCommand } from "./command-spiral.ts"

const program = new Command().name("map-gen").description("Generate SVG previews of point generators.")

program.addCommand(createDiscCommand())
program.addCommand(createSpiralCommand())

await program.parseAsync()
