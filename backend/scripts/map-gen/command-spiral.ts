import { createRng, mulberry32Prng } from "@guillaume-docquier/tools-ts"
import { Command } from "commander"
import { spiralGenerator } from "#lib/map/points/spiral.generator.ts"
import { randomUInt32 } from "#lib/randomUInt32.ts"
import { Parser } from "./Parser.ts"
import { SvgRenderer } from "./SvgRenderer.ts"

const DEFAULT_NB_POINTS = 1000
const DEFAULT_NB_ARMS = 6
const DEFAULT_ARM_SIZE = 15
const DEFAULT_RADIUS = 50
const DEFAULT_ORIGIN = { x: 50, y: 50 }
const DEFAULT_OUTPUT_PATH = Parser.filePath("generated/spiral.svg")

type SpiralOptions = {
  readonly points: number
  readonly radius: number
  readonly originX: number
  readonly originY: number
  readonly seed: number
  readonly output: string
  readonly arms: number
  readonly armSize: number
}

/** Creates the command that renders points generated in spiral arms. */
export function createSpiralCommand(): Command {
  return new Command("spiral")
    .description("Generate an SVG preview of spiralGenerator output.")
    .option("--points <integer>", "number of points", Parser.nonNegativeInteger, DEFAULT_NB_POINTS)
    .option("--radius <number>", "generator radius", Parser.positiveNumber, DEFAULT_RADIUS)
    .option("--origin-x <number>", "origin x coordinate", Parser.number, DEFAULT_ORIGIN.x)
    .option("--origin-y <number>", "origin y coordinate", Parser.number, DEFAULT_ORIGIN.y)
    .option("--seed <integer>", "Mulberry32 seed", Parser.integer, randomUInt32())
    .option("--output <path>", "SVG output path", Parser.filePath, DEFAULT_OUTPUT_PATH)
    .option("--arms <integer>", "number of spiral arms", Parser.positiveInteger, DEFAULT_NB_ARMS)
    .option("--arm-size <number>", "spiral arm size", Parser.positiveNumber, DEFAULT_ARM_SIZE)
    .action(async (options: SpiralOptions) => {
      const origin = { x: options.originX, y: options.originY }
      const points = spiralGenerator({
        origin,
        radius: options.radius,
        nbPoints: options.points,
        arms: {
          count: options.arms,
          size: options.armSize,
        },
        rng: createRng(mulberry32Prng(options.seed)),
      })

      await SvgRenderer.renderToFile({
        outputPath: options.output,
        title: "Spiral generator output",
        text: [
          "Spiral generator",
          `Points: ${points.length} generated (${options.points} requested) | Arms: ${options.arms}`,
          `Radius: ${SvgRenderer.formatNumber(options.radius)} | Arm size: ${SvgRenderer.formatNumber(options.armSize)}`,
          `Origin: (${SvgRenderer.formatNumber(origin.x)}, ${SvgRenderer.formatNumber(origin.y)}) | Seed: ${options.seed}`,
        ],
        points,
        radius: options.radius,
        origin,
      })
    })
}
