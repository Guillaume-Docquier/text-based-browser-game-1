import { createRng, mulberry32Prng } from "@guillaume-docquier/tools-ts"
import { Command } from "commander"
import { discGenerator } from "#lib/map/points/disc.generator.ts"
import { randomUInt32 } from "#lib/randomUInt32.ts"
import { Parser } from "./Parser.ts"
import { SvgRenderer } from "./SvgRenderer.ts"

const DEFAULT_NB_POINTS = 1000
const DEFAULT_RADIUS = 50
const DEFAULT_ORIGIN = { x: 50, y: 50 }
const DEFAULT_OUTPUT_PATH = Parser.filePath("generated/disc.svg")

type DiscOptions = {
  readonly points: number
  readonly radius: number
  readonly originX: number
  readonly originY: number
  readonly seed: number
  readonly output: string
}

/** Creates the command that renders points generated in a disc. */
export function createDiscCommand(): Command {
  return new Command("disc")
    .description("Generate an SVG preview of discGenerator output.")
    .option("--points <integer>", "number of points", Parser.nonNegativeInteger, DEFAULT_NB_POINTS)
    .option("--radius <number>", "generator radius", Parser.positiveNumber, DEFAULT_RADIUS)
    .option("--origin-x <number>", "origin x coordinate", Parser.number, DEFAULT_ORIGIN.x)
    .option("--origin-y <number>", "origin y coordinate", Parser.number, DEFAULT_ORIGIN.y)
    .option("--seed <integer>", "Mulberry32 seed", Parser.integer, randomUInt32())
    .option("--output <path>", "SVG output path", Parser.filePath, DEFAULT_OUTPUT_PATH)
    .action(async (options: DiscOptions) => {
      const origin = { x: options.originX, y: options.originY }
      const points = discGenerator({
        origin,
        radius: options.radius,
        nbPoints: options.points,
        rng: createRng(mulberry32Prng(options.seed)),
      })

      await SvgRenderer.renderToFile({
        outputPath: options.output,
        title: "Disc generator output",
        text: [
          "Disc generator",
          `Points: ${options.points} | Radius: ${SvgRenderer.formatNumber(options.radius)} | Standard deviation: ${SvgRenderer.formatNumber(options.radius / 4)}`,
          `Origin: (${SvgRenderer.formatNumber(origin.x)}, ${SvgRenderer.formatNumber(origin.y)}) | Seed: ${options.seed}`,
        ],
        points,
        radius: options.radius,
        origin,
      })
    })
}
