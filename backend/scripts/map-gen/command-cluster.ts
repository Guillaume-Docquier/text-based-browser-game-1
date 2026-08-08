import { createRng, mulberry32Prng, type Rng } from "@guillaume-docquier/tools-ts"
import { Command } from "commander"
import { clusterGenerator } from "#lib/map-generation/points/cluster.generator.ts"
import type { Point2D } from "#lib/map-generation/points/Point2D.ts"
import { UInt32 } from "#lib/UInt32.ts"
import { Parser } from "./Parser.ts"
import { SvgRenderer } from "./SvgRenderer.ts"

const DEFAULT_NB_POINTS = 1000
const DEFAULT_RADIUS = 50
const DEFAULT_ORIGIN = { x: 50, y: 50 }
const DEFAULT_OUTPUT_PATH = Parser.filePath("generated/cluster.svg")

type ClusterOptions = {
  readonly points: number
  readonly radius: number
  readonly originX: number
  readonly originY: number
  readonly seed: number
  readonly output: string
}

/** Values available when rendering cluster generator output. */
export type ClusterRenderOptions = {
  readonly output: string
  readonly pointsGenerator: (options: { rng: Rng }) => Point2D[]
  readonly requestedPoints: number
  readonly radius: number
  readonly origin: Point2D
  readonly seed: number
}

type ClusterCommandOptions = {
  readonly defaultOutputPath?: string
  readonly render?: (options: ClusterRenderOptions) => Promise<void>
}

/** Creates the command that renders points generated in a cluster. */
export function createClusterCommand({
  defaultOutputPath = DEFAULT_OUTPUT_PATH,
  render = renderCluster,
}: ClusterCommandOptions = {}): Command {
  return new Command("cluster")
    .description("Generate an SVG preview of clusterGenerator output.")
    .option("--points <integer>", "number of points", Parser.nonNegativeInteger, DEFAULT_NB_POINTS)
    .option("--radius <number>", "generator radius", Parser.positiveNumber, DEFAULT_RADIUS)
    .option("--origin-x <number>", "origin x coordinate", Parser.number, DEFAULT_ORIGIN.x)
    .option("--origin-y <number>", "origin y coordinate", Parser.number, DEFAULT_ORIGIN.y)
    .option("--seed <integer>", "rng seed", Parser.integer, UInt32.random())
    .option("--output <path>", "SVG output path", Parser.filePath, defaultOutputPath)
    .action(async (options: ClusterOptions) => {
      const origin = { x: options.originX, y: options.originY }

      await render({
        output: options.output,
        pointsGenerator: ({ rng }) =>
          clusterGenerator({
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

async function renderCluster(options: ClusterRenderOptions): Promise<void> {
  const points = options.pointsGenerator({ rng: createRng(mulberry32Prng(options.seed)) })

  await SvgRenderer.renderToFile({
    outputPath: options.output,
    title: "Cluster generator output",
    text: [
      `Cluster generator (seed: ${options.seed})`,
      `Points: ${options.requestedPoints} | Standard deviation: ${SvgRenderer.formatNumber(options.radius / 4)}`,
      `Radius: ${SvgRenderer.formatNumber(options.radius)} | Origin: (${SvgRenderer.formatNumber(options.origin.x)}, ${SvgRenderer.formatNumber(options.origin.y)})`,
    ],
    points,
    boundary: { shape: "circle", radius: options.radius },
    origin: options.origin,
  })
}
