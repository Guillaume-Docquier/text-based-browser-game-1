import { mkdir, writeFile } from "node:fs/promises"
import { dirname } from "node:path"
import type { Point2D } from "#lib/map/points/Point2D.ts"

const SVG_WIDTH = 900
const SVG_HEIGHT = 900
const PLOT_CENTER_X = SVG_WIDTH / 2
const PLOT_CENTER_Y = 510
const PLOT_SIZE = 720
const POINT_RADIUS = 1
const PLUS_SIZE = 10

type RenderOptions = {
  readonly outputPath: string
  readonly title: string
  readonly text: readonly string[]
  readonly points: readonly Point2D[]
  readonly boundary: { readonly shape: "circle"; readonly radius: number } | { readonly shape: "square"; readonly size: number }
  readonly origin: Point2D
}

/** Renders map generator previews as SVG files. */
export const SvgRenderer = {
  renderToFile: async (options: RenderOptions): Promise<void> => {
    await mkdir(dirname(options.outputPath), { recursive: true })
    await writeFile(options.outputPath, renderSvg(options), "utf8")

    console.log(`Wrote ${options.outputPath}`)
  },
  formatNumber: (value: number): string => {
    if (Object.is(value, -0)) {
      return "0"
    }

    return Number.isInteger(value) ? `${value}` : value.toFixed(4).replace(/0+$/, "").replace(/\.$/, "")
  },
} as const

function renderSvg({ title, text, points, boundary, origin }: RenderOptions): string {
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
  const pointElements = points
    .map((point) => {
      const { x, y } = toSvgPoint({ point, origin, scale })
      return `    <circle cx="${SvgRenderer.formatNumber(x)}" cy="${SvgRenderer.formatNumber(y)}" r="${POINT_RADIUS}" fill="#ffeb3b" />`
    })
    .join("\n")
  const originX = PLOT_CENTER_X
  const originY = PLOT_CENTER_Y
  const boundaryElement = renderBoundary({ boundary, scale, originX, originY })

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${SVG_WIDTH}" height="${SVG_HEIGHT}" viewBox="0 0 ${SVG_WIDTH} ${SVG_HEIGHT}">
  <title>${title}</title>
  <rect width="100%" height="100%" fill="#000000" />
  <g font-family="monospace" fill="#ffffff">
${textElements}
  </g>
  ${boundaryElement}
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
