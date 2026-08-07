import { createRng, mulberry32Prng, type Rng } from "@guillaume-docquier/tools-ts"
import { Command } from "commander"
import { discGenerator } from "#lib/map/points/disc.generator.ts"
import type { Point2D } from "#lib/map/points/Point2D.ts"
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

/** Values available when rendering disc generator output. */
export type DiscRenderOptions = {
  readonly output: string
  readonly pointsGenerator: (options: { rng: Rng }) => Point2D[]
  readonly requestedPoints: number
  readonly radius: number
  readonly origin: Point2D
  readonly seed: number
}

type DiscCommandOptions = {
  readonly defaultOutputPath?: string
  readonly render?: (options: DiscRenderOptions) => Promise<void>
}

/** Creates the command that renders points generated in a disc. */
export function createDiscCommand({ defaultOutputPath = DEFAULT_OUTPUT_PATH, render = renderDisc }: DiscCommandOptions = {}): Command {
  return new Command("disc")
    .description("Generate an SVG preview of discGenerator output.")
    .option("--points <integer>", "number of points", Parser.nonNegativeInteger, DEFAULT_NB_POINTS)
    .option("--radius <number>", "generator radius", Parser.positiveNumber, DEFAULT_RADIUS)
    .option("--origin-x <number>", "origin x coordinate", Parser.number, DEFAULT_ORIGIN.x)
    .option("--origin-y <number>", "origin y coordinate", Parser.number, DEFAULT_ORIGIN.y)
    .option("--seed <integer>", "Mulberry32 seed", Parser.integer, randomUInt32())
    .option("--output <path>", "SVG output path", Parser.filePath, defaultOutputPath)
    .action(async (options: DiscOptions) => {
      const origin = { x: options.originX, y: options.originY }

      await render({
        output: options.output,
        pointsGenerator: ({ rng }) =>
          discGenerator({
            origin,
            radius: options.radius,
            nbPoints: options.points,
            rng,
          }),
        requestedPoints: options.points,
        radius: options.radius,
        origin,
        seed: options.seed,
      })
    })
}

async function renderDisc(options: DiscRenderOptions): Promise<void> {
  const points = options.pointsGenerator({ rng: createRng(mulberry32Prng(options.seed)) })

  await SvgRenderer.renderToFile({
    outputPath: options.output,
    title: "Disc generator output",
    text: [
      "Disc generator",
      `Points: ${options.requestedPoints} | Radius: ${SvgRenderer.formatNumber(options.radius)} | Standard deviation: ${SvgRenderer.formatNumber(options.radius / 4)}`,
      `Origin: (${SvgRenderer.formatNumber(options.origin.x)}, ${SvgRenderer.formatNumber(options.origin.y)}) | Seed: ${options.seed}`,
    ],
    points,
    boundary: { shape: "circle", radius: options.radius },
    origin: options.origin,
  })
}
