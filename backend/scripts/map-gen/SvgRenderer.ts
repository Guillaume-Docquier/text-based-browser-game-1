import { mkdir, writeFile } from "node:fs/promises"
import { dirname } from "node:path"
import type { Point2D } from "#lib/map/points/Point2D.ts"

const SVG_WIDTH = 900
const SVG_HEIGHT = 900
const PLOT_CENTER_X = SVG_WIDTH / 2
const PLOT_CENTER_Y = 510
const PLOT_SIZE = 720
const POINT_RADIUS = 1

type RenderOptions = {
  readonly outputPath: string
  readonly title: string
  readonly text: readonly string[]
  readonly points: readonly Point2D[]
  readonly boundary: { readonly shape: "circle"; readonly radius: number } | { readonly shape: "square"; readonly size: number }
  readonly grid?: { readonly size: number }
  readonly origin: Point2D
}

/** Renders map generator previews as SVG files. */
export const SvgRenderer = {
  renderToFile: async (options: RenderOptions): Promise<void> => {
    await mkdir(dirname(options.outputPath), { recursive: true })
    await writeFile(options.outputPath, renderSvg(options), "utf8")

    console.log(`Wrote ${options.outputPath}`)
  },
  formatNumber: (value: number, digits = 4): string => {
    if (Object.is(value, -0)) {
      return "0"
    }

    return Number.isInteger(value) ? `${value}` : value.toFixed(digits).replace(/0+$/, "").replace(/\.$/, "")
  },
} as const

function renderSvg({ title, text, points, boundary, grid, origin }: RenderOptions): string {
  const boundaryExtent = boundary.shape === "circle" ? boundary.radius : boundary.size / 2
  const coordinateExtent = getCoordinateExtent({ points, boundaryExtent, origin })
  const scale = PLOT_SIZE / (coordinateExtent * 2)
  const textElements = text
    .map((line, index) => {
      const fontSize = index === 0 ? 20 : 16
      const y = index === 0 ? 32 : 60 + (index - 1) * 26
      return `    <text x="24" y="${y}" font-size="${fontSize}">${line}</text>`
    })
    .join("\n")
  const pointElements = points.map((point) => renderPoint({ point, radius: POINT_RADIUS, fill: "#ffeb3b", origin, scale })).join("\n")
  const originX = PLOT_CENTER_X
  const originY = PLOT_CENTER_Y
  const gridElement = grid === undefined ? "" : renderGrid({ size: grid.size, origin, scale })
  const boundaryElement = renderBoundary({ boundary, scale, originX, originY })

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${SVG_WIDTH}" height="${SVG_HEIGHT}" viewBox="0 0 ${SVG_WIDTH} ${SVG_HEIGHT}">
  <title>${title}</title>
  <rect width="100%" height="100%" fill="#000000" />
  <g font-family="monospace" fill="#ffffff">
${textElements}
  </g>
  ${gridElement}
  ${boundaryElement}
  <g aria-label="Generated points">
${pointElements}
  </g>
</svg>
`
}

function renderPoint({
  point,
  radius,
  fill,
  origin,
  scale,
}: {
  readonly point: Point2D
  readonly radius: number
  readonly fill: string
  readonly origin: Point2D
  readonly scale: number
}): string {
  const { x, y } = toSvgPoint({ point, origin, scale })
  return `    <circle cx="${SvgRenderer.formatNumber(x)}" cy="${SvgRenderer.formatNumber(y)}" r="${SvgRenderer.formatNumber(radius)}" fill="${fill}" />`
}

function renderGrid({ size, origin, scale }: { readonly size: number; readonly origin: Point2D; readonly scale: number }): string {
  const minorLines = renderGridLines({ size, origin, scale, increment: 1 })
  const majorLines = renderGridLines({ size, origin, scale, increment: 10 })

  return `<g aria-label="Coordinate grid" fill="none" stroke-width="0.5">
  <g aria-label="1-unit grid lines" stroke="#4f4f4f" opacity="0.35">
${minorLines}
  </g>
  <g aria-label="10-unit grid lines" stroke="#dfdfdf" opacity="0.35">
${majorLines}
  </g>
  </g>`
}

function renderGridLines({
  size,
  origin,
  scale,
  increment,
}: {
  readonly size: number
  readonly origin: Point2D
  readonly scale: number
  readonly increment: number
}): string {
  const lines: string[] = []

  for (let coordinate = 0; coordinate <= size; coordinate += increment) {
    const verticalStart = toSvgPoint({ point: { x: coordinate, y: 0 }, origin, scale })
    const verticalEnd = toSvgPoint({ point: { x: coordinate, y: size }, origin, scale })
    const horizontalStart = toSvgPoint({ point: { x: 0, y: coordinate }, origin, scale })
    const horizontalEnd = toSvgPoint({ point: { x: size, y: coordinate }, origin, scale })

    lines.push(
      `    <line x1="${SvgRenderer.formatNumber(verticalStart.x)}" y1="${SvgRenderer.formatNumber(verticalStart.y)}" x2="${SvgRenderer.formatNumber(verticalEnd.x)}" y2="${SvgRenderer.formatNumber(verticalEnd.y)}" />`,
      `    <line x1="${SvgRenderer.formatNumber(horizontalStart.x)}" y1="${SvgRenderer.formatNumber(horizontalStart.y)}" x2="${SvgRenderer.formatNumber(horizontalEnd.x)}" y2="${SvgRenderer.formatNumber(horizontalEnd.y)}" />`,
    )
  }

  return lines.join("\n")
}

function renderBoundary({
  boundary,
  scale,
  originX,
  originY,
}: {
  readonly boundary: RenderOptions["boundary"]
  readonly scale: number
  readonly originX: number
  readonly originY: number
}): string {
  if (boundary.shape === "circle") {
    return `<circle cx="${originX}" cy="${originY}" r="${SvgRenderer.formatNumber(boundary.radius * scale)}" fill="none" stroke="#00ff66" stroke-width="2" />`
  }

  const size = boundary.size * scale
  const x = originX - size / 2
  const y = originY - size / 2

  return `<rect x="${SvgRenderer.formatNumber(x)}" y="${SvgRenderer.formatNumber(y)}" width="${SvgRenderer.formatNumber(size)}" height="${SvgRenderer.formatNumber(size)}" fill="none" stroke="#00ff66" stroke-width="2" />`
}

function getCoordinateExtent({
  points,
  boundaryExtent,
  origin,
}: {
  readonly points: readonly Point2D[]
  readonly boundaryExtent: number
  readonly origin: Point2D
}): number {
  const furthestPoint = points.reduce(
    (furthest, point) => Math.max(furthest, Math.abs(point.x - origin.x), Math.abs(point.y - origin.y)),
    boundaryExtent,
  )

  return furthestPoint * 1.1
}

function toSvgPoint({ point, origin, scale }: { readonly point: Point2D; readonly origin: Point2D; readonly scale: number }): Point2D {
  return {
    x: PLOT_CENTER_X + (point.x - origin.x) * scale,
    y: PLOT_CENTER_Y - (point.y - origin.y) * scale,
  }
}
