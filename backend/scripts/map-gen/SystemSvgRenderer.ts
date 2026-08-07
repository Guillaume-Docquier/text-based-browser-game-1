import { mkdir, writeFile } from "node:fs/promises"
import { dirname } from "node:path"
import type { Point2D } from "#lib/map/points/Point2D.ts"
import { SvgRenderer } from "./SvgRenderer.ts"

const SVG_WIDTH = 900
const SVG_HEIGHT = 900
const SYSTEM_BOUNDARY_SIZE = 100
const SYSTEM_BOUNDARY_EXTENT = SYSTEM_BOUNDARY_SIZE / 2
const PANEL_PLOT_SIZE = 320
const SCALE = PANEL_PLOT_SIZE / SYSTEM_BOUNDARY_SIZE
const STAR_RADIUS = 4
const PLANET_RADIUS = STAR_RADIUS / 4
const PANEL_CENTERS = [
  { x: 240, y: 300 },
  { x: 660, y: 300 },
  { x: 240, y: 700 },
  { x: 660, y: 700 },
] as const

type SystemPreview = {
  readonly planets: readonly Point2D[]
}

type RenderOptions = {
  readonly outputPath: string
  readonly title: string
  readonly systems: readonly SystemPreview[]
  readonly withGrid: boolean
}

/** Renders centered star-system previews measured in astronomical units. */
export const SystemSvgRenderer = {
  renderToFile: async (options: RenderOptions): Promise<void> => {
    await mkdir(dirname(options.outputPath), { recursive: true })
    await writeFile(options.outputPath, renderSvg(options), "utf8")

    console.log(`Wrote ${options.outputPath}`)
  },
} as const

function renderSvg({ title, systems, withGrid }: RenderOptions): string {
  const systemElements = systems
    .map((system, index) => {
      const center = PANEL_CENTERS[index]
      if (center === undefined) {
        return ""
      }

      return renderSystem({ system, center, index, withGrid })
    })
    .join("\n")

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${SVG_WIDTH}" height="${SVG_HEIGHT}" viewBox="0 0 ${SVG_WIDTH} ${SVG_HEIGHT}">
  <title>${title}</title>
  <rect width="100%" height="100%" fill="#000000" />
  <g font-family="monospace" fill="#ffffff">
    <text x="24" y="32" font-size="20">${title}</text>
    <text x="24" y="60" font-size="16">${systems.length} random systems | Units: AU | Boundary: ${SYSTEM_BOUNDARY_SIZE} AU</text>
  </g>
${systemElements}
</svg>
`
}

function renderSystem({
  system,
  center,
  index,
  withGrid,
}: {
  readonly system: SystemPreview
  readonly center: Point2D
  readonly index: number
  readonly withGrid: boolean
}): string {
  const grid = withGrid ? renderGrid(center) : ""
  const boundaryX = center.x - PANEL_PLOT_SIZE / 2
  const boundaryY = center.y - PANEL_PLOT_SIZE / 2
  const planets = system.planets
    .map((planet) => {
      const point = toSvgPoint({ point: planet, center })
      return `    <circle cx="${SvgRenderer.formatNumber(point.x)}" cy="${SvgRenderer.formatNumber(point.y)}" r="${PLANET_RADIUS}" fill="#00ffff" />`
    })
    .join("\n")

  return `  <g aria-label="System ${index + 1}">
    <text x="${boundaryX}" y="${boundaryY - 12}" font-family="monospace" font-size="16" fill="#ffffff">System ${index + 1} | ${system.planets.length} planets</text>
${grid}
    <rect x="${boundaryX}" y="${boundaryY}" width="${PANEL_PLOT_SIZE}" height="${PANEL_PLOT_SIZE}" fill="none" stroke="#00ff66" stroke-width="2" />
    <g aria-label="Star">
      <circle cx="${center.x}" cy="${center.y}" r="${STAR_RADIUS}" fill="#ffeb3b" />
    </g>
    <g aria-label="Planets">
${planets}
    </g>
  </g>`
}

function renderGrid(center: Point2D): string {
  const minorLines = renderGridLines({ center, increment: 1 })
  const majorLines = renderGridLines({ center, increment: 10 })

  return `    <g aria-label="Coordinate grid" fill="none" stroke-width="0.5">
      <g aria-label="1 AU grid lines" stroke="#4f4f4f" opacity="0.35">
${minorLines}
      </g>
      <g aria-label="10 AU grid lines" stroke="#dfdfdf" opacity="0.35">
${majorLines}
      </g>
    </g>`
}

function renderGridLines({ center, increment }: { readonly center: Point2D; readonly increment: number }): string {
  const lines: string[] = []
  const start = -SYSTEM_BOUNDARY_EXTENT
  const end = SYSTEM_BOUNDARY_EXTENT

  for (let coordinate = start; coordinate <= end; coordinate += increment) {
    const x = center.x + coordinate * SCALE
    const y = center.y - coordinate * SCALE

    lines.push(
      `        <line x1="${SvgRenderer.formatNumber(x)}" y1="${center.y - PANEL_PLOT_SIZE / 2}" x2="${SvgRenderer.formatNumber(x)}" y2="${center.y + PANEL_PLOT_SIZE / 2}" />`,
      `        <line x1="${center.x - PANEL_PLOT_SIZE / 2}" y1="${SvgRenderer.formatNumber(y)}" x2="${center.x + PANEL_PLOT_SIZE / 2}" y2="${SvgRenderer.formatNumber(y)}" />`,
    )
  }

  return lines.join("\n")
}

function toSvgPoint({ point, center }: { readonly point: Point2D; readonly center: Point2D }): Point2D {
  return {
    x: center.x + point.x * SCALE,
    y: center.y - point.y * SCALE,
  }
}
