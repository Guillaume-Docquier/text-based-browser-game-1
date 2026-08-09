import { createRng, mulberry32Prng, type Rng, type XY } from "@guillaume-docquier/tools-ts"
import { Command } from "commander"
import { spiralGenerator } from "#lib/map-generation/points/spiral.generator.ts"
import { UInt32 } from "#lib/UInt32.ts"
import { Parser } from "./Parser.ts"
import { SvgRenderer } from "./SvgRenderer.ts"

const DEFAULT_ORIGIN = { x: 50, y: 50 }
const DEFAULT_RADIUS = 50
const DEFAULT_NB_POINTS = 1000
const DEFAULT_ARM_COUNT = 6
const DEFAULT_ARM_RADIUS = 12
const DEFAULT_OUTPUT_PATH = Parser.filePath("generated/spiral.svg")

type SpiralOptions = {
  readonly points: number
  readonly radius: number
  readonly originX: number
  readonly originY: number
  readonly seed: number
  readonly output: string
  readonly armCount: number
  readonly armRadius: number
}

/** Values available when rendering spiral generator output. */
export type SpiralRenderOptions = {
  readonly output: string
  readonly pointsGenerator: (options: { rng: Rng }) => XY[]
  readonly requestedPoints: number
  readonly radius: number
  readonly origin: XY
  readonly seed: number
  readonly armCount: number
  readonly armRadius: number
}

type SpiralCommandOptions = {
  readonly defaultOutputPath?: string
  readonly render?: (options: SpiralRenderOptions) => Promise<void>
}

/** Creates the command that renders points generated in spiral arms. */
export function createSpiralCommand({
  defaultOutputPath = DEFAULT_OUTPUT_PATH,
  render = renderSpiral,
}: SpiralCommandOptions = {}): Command {
  return new Command("spiral")
    .description("Generate an SVG preview of spiralGenerator output.")
    .option("--points <integer>", "number of points", Parser.nonNegativeInteger, DEFAULT_NB_POINTS)
    .option("--radius <number>", "generator radius", Parser.positiveNumber, DEFAULT_RADIUS)
    .option("--origin-x <number>", "origin x coordinate", Parser.number, DEFAULT_ORIGIN.x)
    .option("--origin-y <number>", "origin y coordinate", Parser.number, DEFAULT_ORIGIN.y)
    .option("--seed <integer>", "rng seed", Parser.integer, UInt32.random())
    .option("--output <path>", "SVG output path", Parser.filePath, defaultOutputPath)
    .option("--arm-count <integer>", "number of spiral arms", Parser.positiveInteger, DEFAULT_ARM_COUNT)
    .option("--arm-radius <number>", "spiral arm radius", Parser.positiveNumber, DEFAULT_ARM_RADIUS)
    .action(async (options: SpiralOptions) => {
      const origin = { x: options.originX, y: options.originY }

      await render({
        output: options.output,
        pointsGenerator: ({ rng }: { rng: Rng }) =>
          spiralGenerator({
            origin,
            radius: options.radius,
            nbPoints: options.points,
            rng,
            options: {
              armCount: options.armCount,
              armRadius: options.armRadius,
            },
          }),
        requestedPoints: options.points,
        radius: options.radius,
        origin,
        seed: options.seed,
        armCount: options.armCount,
        armRadius: options.armRadius,
      })
    })
}

async function renderSpiral(options: SpiralRenderOptions): Promise<void> {
  const points = options.pointsGenerator({ rng: createRng(mulberry32Prng(options.seed)) })

  await SvgRenderer.renderToFile({
    outputPath: options.output,
    title: "Spiral generator output",
    text: [
      `Spiral generator (seed: ${options.seed})`,
      `Points: ${points.length} generated (${options.requestedPoints} requested)`,
      `Radius: ${SvgRenderer.formatNumber(options.radius)} | Origin: (${SvgRenderer.formatNumber(options.origin.x)}, ${SvgRenderer.formatNumber(options.origin.y)})`,
      `Arm count: ${options.armCount} | Arm radius: ${SvgRenderer.formatNumber(options.armRadius)}`,
    ],
    points,
    boundary: { shape: "circle", radius: options.radius },
    origin: options.origin,
  })
}
