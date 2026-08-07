import { createRng, mulberry32Prng, type Rng } from "@guillaume-docquier/tools-ts"
import { Command } from "commander"
import { galaxyGenerator } from "#lib/map/galaxy.generator.ts"
import type { Point2D } from "#lib/map/points/Point2D.ts"
import { createClusterCommand, type ClusterRenderOptions } from "./command-cluster.ts"
import { createSpiralCommand, type SpiralRenderOptions } from "./command-spiral.ts"
import { Parser } from "./Parser.ts"
import { SvgRenderer } from "./SvgRenderer.ts"

const DEFAULT_CLUSTER_OUTPUT_PATH = Parser.filePath("generated/galaxy-cluster.svg")
const DEFAULT_SPIRAL_OUTPUT_PATH = Parser.filePath("generated/galaxy-spiral.svg")

type GalaxyOptions = {
  readonly grid?: boolean
}

/** Creates the command that renders galaxies generated from the supported point generators. */
export function createGalaxyCommand(): Command {
  const command = new Command("galaxy")
    .description("Generate an SVG preview of galaxyGenerator output.")
    .option("--grid", "render the galaxy coordinate grid")

  return command
    .addCommand(
      createClusterCommand({
        defaultOutputPath: DEFAULT_CLUSTER_OUTPUT_PATH,
        render: async (options) => {
          await renderClusterGalaxy(options, command.opts<GalaxyOptions>())
        },
      }),
    )
    .addCommand(
      createSpiralCommand({
        defaultOutputPath: DEFAULT_SPIRAL_OUTPUT_PATH,
        render: async (options) => {
          await renderSpiralGalaxy(options, command.opts<GalaxyOptions>())
        },
      }),
    )
}

async function renderClusterGalaxy(options: ClusterRenderOptions, galaxyOptions: GalaxyOptions): Promise<void> {
  await renderGalaxy({
    outputPath: options.output,
    generatorName: "Cluster",
    pointsGenerator: options.pointsGenerator,
    requestedPoints: options.requestedPoints,
    radius: options.radius,
    origin: options.origin,
    seed: options.seed,
    renderGrid: galaxyOptions.grid ?? false,
    details: [`Standard deviation: ${SvgRenderer.formatNumber(options.radius / 4)}`],
  })
}

async function renderSpiralGalaxy(options: SpiralRenderOptions, galaxyOptions: GalaxyOptions): Promise<void> {
  await renderGalaxy({
    outputPath: options.output,
    generatorName: "Spiral",
    pointsGenerator: options.pointsGenerator,
    requestedPoints: options.requestedPoints,
    radius: options.radius,
    origin: options.origin,
    seed: options.seed,
    renderGrid: galaxyOptions.grid ?? false,
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
  renderGrid,
  details,
}: {
  readonly outputPath: string
  readonly generatorName: string
  readonly pointsGenerator: (options: { rng: Rng }) => Point2D[]
  readonly requestedPoints: number
  readonly radius: number
  readonly origin: Point2D
  readonly seed: number
  readonly renderGrid: boolean
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
  const planetPoints = galaxy.systems.flatMap((system) => system.planets)
  const planetCountsPerSystem = galaxy.systems.map((system) => system.planets.length)
  const minPlanetsPerSystem = planetCountsPerSystem.length === 0 ? 0 : Math.min(...planetCountsPerSystem)
  const maxPlanetsPerSystem = planetCountsPerSystem.length === 0 ? 0 : Math.max(...planetCountsPerSystem)
  const averagePlanetsPerSystem = systemPoints.length === 0 ? 0 : planetPoints.length / systemPoints.length

  await SvgRenderer.renderToFile({
    outputPath,
    title: `${generatorName} galaxy generator output`,
    text: [
      `${generatorName} galaxy generator`,
      `Systems: ${systemPoints.length} generated from ${generatedPointCount} points (${requestedPoints} requested)`,
      `Planets: ${planetPoints.length} | Per system: ${minPlanetsPerSystem} min / ${maxPlanetsPerSystem} max / ${SvgRenderer.formatNumber(averagePlanetsPerSystem, 2)} avg`,
      `Size: ${SvgRenderer.formatNumber(size)} | Radius: ${SvgRenderer.formatNumber(radius)} | ${details.join(" | ")}`,
      `Origin: (${SvgRenderer.formatNumber(origin.x)}, ${SvgRenderer.formatNumber(origin.y)}) | Seed: ${seed}`,
    ],
    points: systemPoints,
    foregroundPointLayers: [{ ariaLabel: "Planets", points: planetPoints, radius: 1 / 4, fill: "#00ffff" }],
    boundary: { shape: "square", size },
    ...(renderGrid ? { grid: { size } } : {}),
    origin,
  })
}
