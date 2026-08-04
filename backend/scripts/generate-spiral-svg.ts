import { mkdir, writeFile } from "node:fs/promises"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { createRng, mulberry32Prng } from "@guillaume-docquier/tools-ts"
import type { Point2D } from "#lib/map/points/Point.ts"
import { spiralGenerator } from "#lib/map/points/spiral.generator.ts"
import { randomUInt32 } from "#lib/randomUInt32.ts"

const DEFAULT_NB_POINTS = 1000
const DEFAULT_NB_ARMS = 6
const DEFAULT_ARM_SIZE = 15
const DEFAULT_RADIUS = 50
const DEFAULT_ORIGIN = { x: 50, y: 50 }
const DEFAULT_OUTPUT_PATH = fileURLToPath(new URL("../generated/spiral.svg", import.meta.url))

const SVG_WIDTH = 900
const SVG_HEIGHT = 900
const PLOT_CENTER_X = SVG_WIDTH / 2
const PLOT_CENTER_Y = 510
const PLOT_SIZE = 720
const POINT_RADIUS = 1
const PLUS_SIZE = 10

type SpiralSvgOptions = {
  readonly nbPoints: number
  readonly radius: number
  readonly origin: Point2D
  readonly arms: {
    readonly count: number
    readonly size: number
  }
  readonly seed: number
  readonly outputPath: string
}

await main()

async function main(): Promise<void> {
  const options = parseArguments(process.argv.slice(2))
  if (options === undefined) {
    return
  }

  const points = spiralGenerator({
    origin: options.origin,
    radius: options.radius,
    nbPoints: options.nbPoints,
    arms: options.arms,
    rng: createRng(mulberry32Prng(options.seed)),
  })
  const svg = renderSpiralSvg({ points, ...options })

  await mkdir(dirname(options.outputPath), { recursive: true })
  await writeFile(options.outputPath, svg, "utf8")

  console.log(`Wrote ${options.outputPath}`)
}

function parseArguments(arguments_: readonly string[]): SpiralSvgOptions | undefined {
  let nbPoints = DEFAULT_NB_POINTS
  let radius = DEFAULT_RADIUS
  let origin = DEFAULT_ORIGIN
  let arms = {
    count: DEFAULT_NB_ARMS,
    size: DEFAULT_ARM_SIZE,
  }
  let seed = randomUInt32()
  let outputPath = DEFAULT_OUTPUT_PATH

  for (let index = 0; index < arguments_.length; index += 1) {
    const argument = arguments_[index]
    if (argument === "--help") {
      printHelp()
      return undefined
    }
    if (argument === undefined || !argument.startsWith("--")) {
      throw new Error(`Unknown argument: ${argument ?? "undefined"}`)
    }

    const separatorIndex = argument.indexOf("=")
    const optionName = separatorIndex === -1 ? argument : argument.slice(0, separatorIndex)
    const optionValue = separatorIndex === -1 ? arguments_[++index] : argument.slice(separatorIndex + 1)

    if (optionValue === undefined || optionValue.startsWith("--")) {
      throw new Error(`Missing value for ${optionName}`)
    }

    switch (optionName) {
      case "--points":
        nbPoints = parseNonNegativeInteger(optionName, optionValue)
        break
      case "--arms":
        arms = { ...arms, count: parsePositiveInteger(optionName, optionValue) }
        break
      case "--arm-size":
        arms = { ...arms, size: parsePositiveNumber(optionName, optionValue) }
        break
      case "--radius":
        radius = parsePositiveNumber(optionName, optionValue)
        break
      case "--origin-x":
        origin = { ...origin, x: parseNumber(optionName, optionValue) }
        break
      case "--origin-y":
        origin = { ...origin, y: parseNumber(optionName, optionValue) }
        break
      case "--seed":
        seed = parseInteger(optionName, optionValue)
        break
      case "--output":
        outputPath = resolve(optionValue)
        break
      default:
        throw new Error(`Unknown option: ${optionName}`)
    }
  }

  return { nbPoints, radius, origin, arms, seed, outputPath }
}

function parseNumber(optionName: string, value: string): number {
  const parsedValue = Number(value)
  if (!Number.isFinite(parsedValue)) {
    throw new Error(`${optionName} must be a finite number, received '${value}'`)
  }

  return parsedValue
}

function parseInteger(optionName: string, value: string): number {
  const parsedValue = parseNumber(optionName, value)
  if (!Number.isInteger(parsedValue)) {
    throw new Error(`${optionName} must be an integer, received '${value}'`)
  }

  return parsedValue
}

function parseNonNegativeInteger(optionName: string, value: string): number {
  const parsedValue = parseInteger(optionName, value)
  if (parsedValue < 0) {
    throw new Error(`${optionName} must be greater than or equal to zero, received '${value}'`)
  }

  return parsedValue
}

function parsePositiveInteger(optionName: string, value: string): number {
  const parsedValue = parseNonNegativeInteger(optionName, value)
  if (parsedValue === 0) {
    throw new Error(`${optionName} must be greater than zero, received '${value}'`)
  }

  return parsedValue
}

function parsePositiveNumber(optionName: string, value: string): number {
  const parsedValue = parseNumber(optionName, value)
  if (parsedValue <= 0) {
    throw new Error(`${optionName} must be greater than zero, received '${value}'`)
  }

  return parsedValue
}

function renderSpiralSvg({
  points,
  nbPoints,
  radius,
  origin,
  arms,
  seed,
}: SpiralSvgOptions & { readonly points: readonly Point2D[] }): string {
  const coordinateExtent = getCoordinateExtent({ points, radius, origin })
  const scale = PLOT_SIZE / (coordinateExtent * 2)
  const circleRadius = radius * scale
  const pointElements = points
    .map((point) => {
      const { x, y } = toSvgPoint({ point, origin, scale })
      return `    <circle cx="${formatNumber(x)}" cy="${formatNumber(y)}" r="${POINT_RADIUS}" fill="#ffeb3b" />`
    })
    .join("\n")
  const originX = PLOT_CENTER_X
  const originY = PLOT_CENTER_Y

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${SVG_WIDTH}" height="${SVG_HEIGHT}" viewBox="0 0 ${SVG_WIDTH} ${SVG_HEIGHT}">
  <title>Spiral generator output</title>
  <rect width="100%" height="100%" fill="#000000" />
  <g font-family="monospace" fill="#ffffff">
    <text x="24" y="32" font-size="20">Spiral generator</text>
    <text x="24" y="60" font-size="16">Points: ${points.length} generated (${nbPoints} requested) | Arms: ${arms.count}</text>
    <text x="24" y="86" font-size="16">Radius: ${formatNumber(radius)} | Arm size: ${formatNumber(arms.size)}</text>
    <text x="24" y="112" font-size="16">Origin: (${formatNumber(origin.x)}, ${formatNumber(origin.y)}) | Seed: ${seed}</text>
  </g>
  <circle cx="${originX}" cy="${originY}" r="${formatNumber(circleRadius)}" fill="none" stroke="#00ff66" stroke-width="2" />
  <g aria-label="Generated points">
${pointElements}
  </g>
  <g aria-label="Origin" stroke="#ff3333" stroke-width="3" stroke-linecap="square">
    <line x1="${originX - PLUS_SIZE}" y1="${originY}" x2="${originX + PLUS_SIZE}" y2="${originY}" />
    <line x1="${originX}" y1="${originY - PLUS_SIZE}" x2="${originX}" y2="${originY + PLUS_SIZE}" />
  </g>
</svg>
`
}

function getCoordinateExtent({
  points,
  radius,
  origin,
}: {
  readonly points: readonly Point2D[]
  readonly radius: number
  readonly origin: Point2D
}): number {
  const furthestPoint = points.reduce(
    (furthest, point) => Math.max(furthest, Math.abs(point.x - origin.x), Math.abs(point.y - origin.y)),
    radius,
  )

  return furthestPoint * 1.1
}

function toSvgPoint({ point, origin, scale }: { readonly point: Point2D; readonly origin: Point2D; readonly scale: number }): Point2D {
  return {
    x: PLOT_CENTER_X + (point.x - origin.x) * scale,
    y: PLOT_CENTER_Y - (point.y - origin.y) * scale,
  }
}

function formatNumber(value: number): string {
  if (Object.is(value, -0)) {
    return "0"
  }

  return Number.isInteger(value) ? `${value}` : value.toFixed(4).replace(/0+$/, "").replace(/\.$/, "")
}

function printHelp(): void {
  console.log(`Generate an SVG preview of spiralGenerator output.

Options:
  --points <integer>    Requested number of points (default: ${DEFAULT_NB_POINTS})
  --arms <integer>      Number of spiral arms (default: ${DEFAULT_NB_ARMS})
  --arm-size <number>   Spiral arm size (default: ${DEFAULT_ARM_SIZE})
  --radius <number>     Spiral radius (default: ${DEFAULT_RADIUS})
  --origin-x <number>   Origin x coordinate (default: ${DEFAULT_ORIGIN.x})
  --origin-y <number>   Origin y coordinate (default: ${DEFAULT_ORIGIN.y})
  --seed <integer>      Mulberry32 seed (default: random)
  --output <path>       SVG output path (default: ${DEFAULT_OUTPUT_PATH})
`)
}
