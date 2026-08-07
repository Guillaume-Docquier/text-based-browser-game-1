import { createRng, mulberry32Prng, type Rng } from "@guillaume-docquier/tools-ts"
import { Command } from "commander"
import { galaxyGenerator } from "#lib/map/galaxy.generator.ts"
import type { Point2D } from "#lib/map/points/Point2D.ts"
import { createDiscCommand, type DiscRenderOptions } from "./command-disc.ts"
import { createSpiralCommand, type SpiralRenderOptions } from "./command-spiral.ts"
import { Parser } from "./Parser.ts"
import { SvgRenderer } from "./SvgRenderer.ts"

const DEFAULT_DISC_OUTPUT_PATH = Parser.filePath("generated/galaxy-disc.svg")
const DEFAULT_SPIRAL_OUTPUT_PATH = Parser.filePath("generated/galaxy-spiral.svg")

/** Creates the command that renders galaxies generated from the supported point generators. */
export function createGalaxyCommand(): Command {
  return new Command("galaxy")
    .description("Generate an SVG preview of galaxyGenerator output.")
    .addCommand(createDiscCommand({ defaultOutputPath: DEFAULT_DISC_OUTPUT_PATH, render: renderDiscGalaxy }))
    .addCommand(createSpiralCommand({ defaultOutputPath: DEFAULT_SPIRAL_OUTPUT_PATH, render: renderSpiralGalaxy }))
}

async function renderDiscGalaxy(options: DiscRenderOptions): Promise<void> {
  await renderGalaxy({
    outputPath: options.output,
    generatorName: "discGenerator",
    pointsGenerator: options.pointsGenerator,
    requestedPoints: options.requestedPoints,
    radius: options.radius,
    origin: options.origin,
    seed: options.seed,
    details: [`Standard deviation: ${SvgRenderer.formatNumber(options.radius / 4)}`],
  })
}

async function renderSpiralGalaxy(options: SpiralRenderOptions): Promise<void> {
  await renderGalaxy({
    outputPath: options.output,
    generatorName: "spiralGenerator",
    pointsGenerator: options.pointsGenerator,
    requestedPoints: options.requestedPoints,
    radius: options.radius,
    origin: options.origin,
    seed: options.seed,
    details: [`Arms: ${options.arms}`, `Arm size: ${SvgRenderer.formatNumber(options.armSize)}`],
  })
}

async function renderGalaxy({
  outputPath,
  generatorName,
  pointsGenerator,
  requestedPoints,
  radius,
  origin,
  seed,
  details,
}: {
  readonly outputPath: string
  readonly generatorName: string
  readonly pointsGenerator: (options: { rng: Rng }) => Point2D[]
  readonly requestedPoints: number
  readonly radius: number
  readonly origin: Point2D
  readonly seed: number
  readonly details: readonly string[]
}): Promise<void> {
  const size = radius * 2
  let generatedPointCount = 0
  const galaxy = galaxyGenerator({
    size,
    rng: createRng(mulberry32Prng(seed)),
    pointsGenerator: ({ rng }) => {
      const points = pointsGenerator({ rng })
      generatedPointCount = points.length
      return points
    },
  })
  const systemPoints = galaxy.systems.map((system) => system.star)

  await SvgRenderer.renderToFile({
    outputPath,
    title: `Galaxy generator output using ${generatorName}`,
    text: [
      `Galaxy generator using ${generatorName}`,
      `Systems: ${systemPoints.length} generated from ${generatedPointCount} points (${requestedPoints} requested)`,
      `Size: ${SvgRenderer.formatNumber(size)} | Radius: ${SvgRenderer.formatNumber(radius)} | ${details.join(" | ")}`,
      `Origin: (${SvgRenderer.formatNumber(origin.x)}, ${SvgRenderer.formatNumber(origin.y)}) | Seed: ${seed}`,
    ],
    points: systemPoints,
    boundary: { shape: "square", size },
    origin,
  })
}
