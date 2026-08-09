import { mkdir, writeFile } from "node:fs/promises"
import { dirname } from "node:path"
import type { XY } from "@guillaume-docquier/tools-ts"
import { SvgRenderer } from "./SvgRenderer.ts"

const SVG_WIDTH = 900
const SVG_HEIGHT = 900
const SYSTEM_RADIUS = 50
const PANEL_PLOT_SIZE = 320
const SCALE = PANEL_PLOT_SIZE / (SYSTEM_RADIUS * 2)
const STAR_RADIUS = 8
const PLANET_RADIUS = STAR_RADIUS / 2
const PANEL_CENTERS = [
  { x: 240, y: 300 },
  { x: 660, y: 300 },
  { x: 240, y: 700 },
  { x: 660, y: 700 },
] as const

type SystemPreview = {
  readonly name: string
  readonly planets: readonly XY[]
}

type RenderOptions = {
  readonly outputPath: string
  readonly title: string
  readonly systems: readonly SystemPreview[]
}

/** Renders centered star-system previews measured in astronomical units. */
export const SystemSvgRenderer = {
  renderToFile: async (options: RenderOptions): Promise<void> => {
    await mkdir(dirname(options.outputPath), { recursive: true })
    await writeFile(options.outputPath, renderSvg(options), "utf8")

    console.log(`Wrote ${options.outputPath}`)
  },
} as const

function renderSvg({ title, systems }: RenderOptions): string {
  const systemElements = systems
    .map((system, index) => {
      const center = PANEL_CENTERS[index]
      if (center === undefined) {
        return ""
      }

      return renderSystem({ system, center })
    })
    .join("\n")

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${SVG_WIDTH}" height="${SVG_HEIGHT}" viewBox="0 0 ${SVG_WIDTH} ${SVG_HEIGHT}">
  <title>${title}</title>
  <rect width="100%" height="100%" fill="#000000" />
  <g font-family="monospace" fill="#ffffff">
    <text x="24" y="32" font-size="20">${title}</text>
    <text x="24" y="60" font-size="16">${systems.length} random systems | Units: AU | Radius: ${SYSTEM_RADIUS} AU</text>
  </g>
${systemElements}
</svg>
`
}

function renderSystem({ system, center }: { readonly system: SystemPreview; readonly center: XY }): string {
  const boundaryX = center.x - PANEL_PLOT_SIZE / 2
  const boundaryY = center.y - PANEL_PLOT_SIZE / 2
  const orbitGuides = renderOrbitGuides({ center, planets: system.planets })
  const planets = system.planets
    .map((planet) => {
      const point = toSvgPoint({ point: planet, center })
      return `    <circle cx="${SvgRenderer.formatNumber(point.x)}" cy="${SvgRenderer.formatNumber(point.y)}" r="${PLANET_RADIUS}" fill="#00ffff" />`
    })
    .join("\n")

  return `  <g aria-label="${system.name}">
    <text x="${boundaryX}" y="${boundaryY - 12}" font-family="monospace" font-size="16" fill="#ffffff">${system.name} | ${system.planets.length} planets</text>
${orbitGuides}
    <circle cx="${center.x}" cy="${center.y}" r="${SYSTEM_RADIUS * SCALE}" fill="none" stroke="#00ff66" stroke-width="2" />
    <g aria-label="Star">
      <circle cx="${center.x}" cy="${center.y}" r="${STAR_RADIUS}" fill="#ffeb3b" />
    </g>
    <g aria-label="Planets">
${planets}
    </g>
  </g>`
}

function renderOrbitGuides({ center, planets }: { readonly center: XY; readonly planets: readonly XY[] }): string {
  const circles = planets.map((planet) => {
    const orbitRadius = Math.hypot(planet.x, planet.y)
    return `      <circle cx="${center.x}" cy="${center.y}" r="${SvgRenderer.formatNumber(orbitRadius * SCALE)}" />`
  })

  return `    <g aria-label="Planet orbits" fill="none" stroke="#4f4f4f" stroke-width="0.5" opacity="0.35">
${circles.join("\n")}
    </g>`
}

function toSvgPoint({ point, center }: { readonly point: XY; readonly center: XY }): XY {
  return {
    x: center.x + point.x * SCALE,
    y: center.y - point.y * SCALE,
  }
}
