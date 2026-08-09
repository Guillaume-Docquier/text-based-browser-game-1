import path from "node:path"
import { createRng, Distance, mulberry32Prng, UnitOfDistance, type Rng, type XY } from "@guillaume-docquier/tools-ts"
import { Command } from "commander"
import { galaxyGenerator } from "#lib/map-generation/galaxy.generator.ts"
import { createClusterCommand, type ClusterRenderOptions } from "./command-cluster.ts"
import { createSpiralCommand, type SpiralRenderOptions } from "./command-spiral.ts"
import { Parser } from "./Parser.ts"
import { SvgRenderer } from "./SvgRenderer.ts"
import { SystemSvgRenderer } from "./SystemSvgRenderer.ts"

const DEFAULT_CLUSTER_OUTPUT_PATH = Parser.filePath("generated/cluster-galaxy.svg")
const DEFAULT_SPIRAL_OUTPUT_PATH = Parser.filePath("generated/spiral-galaxy.svg")
const NB_SYSTEM_PREVIEWS = 4

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
    details: [`Arms: ${options.armCount}`, `Arm size: ${SvgRenderer.formatNumber(options.armRadius)}`],
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
  readonly pointsGenerator: (options: { rng: Rng }) => XY[]
  readonly requestedPoints: number
  readonly radius: number
  readonly origin: XY
  readonly seed: number
  readonly renderGrid: boolean
  readonly details: readonly string[]
}): Promise<void> {
  const size = radius * 2
  let generatedPointCount = 0
  const rng = createRng(mulberry32Prng(seed))
  const galaxy = galaxyGenerator({
    size,
    rng,
    pointsGenerator: () => {
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
      `${generatorName} galaxy generator (seed: ${seed})`,
      `Systems: ${systemPoints.length} generated from ${generatedPointCount} points (${requestedPoints} requested)`,
      `Planets: ${planetPoints.length} | Per system: ${minPlanetsPerSystem} min / ${maxPlanetsPerSystem} max / ${SvgRenderer.formatNumber(averagePlanetsPerSystem, 2)} avg`,
      `Radius: ${SvgRenderer.formatNumber(radius)} | Origin: (${SvgRenderer.formatNumber(origin.x)}, ${SvgRenderer.formatNumber(origin.y)})`,
      details.join(" | "),
    ],
    points: systemPoints,
    boundary: { shape: "square", size },
    ...(renderGrid ? { grid: { size } } : {}),
    origin,
  })

  const sampledSystems = rng.draw(galaxy.systems, Math.min(NB_SYSTEM_PREVIEWS, galaxy.systems.length)).drawn
  await SystemSvgRenderer.renderToFile({
    outputPath: addFileNameSuffix(outputPath, "-systems"),
    title: `${generatorName} galaxy system samples`,
    systems: sampledSystems.map((system) => ({
      name: system.star.name,
      planets: system.planets.map((planet) => ({
        x: lightYearsToAstronomicalUnits(planet.x - system.star.x),
        y: lightYearsToAstronomicalUnits(planet.y - system.star.y),
      })),
    })),
  })
}

function lightYearsToAstronomicalUnits(value: number): number {
  return Distance.in(Distance.create(value, UnitOfDistance.LIGHT_YEARS), UnitOfDistance.ASTRONOMICAL_UNITS)
}

function addFileNameSuffix(filePath: string, suffix: string): string {
  const extension = path.extname(filePath)
  return path.join(path.dirname(filePath), `${path.basename(filePath, extension)}${suffix}${extension}`)
}
