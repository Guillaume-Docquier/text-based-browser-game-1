import type { Planet, PlayerView } from "@api-types"
import { type ReactElement, useState } from "react"
import { BuildingType, TRADE_CENTER_INCOME } from "shared/domain/world/buildings/Building.ts"
import { constructionProblem } from "shared/domain/world/buildings/ConstructionOrder.ts"
import { planetSurface } from "shared/domain/world/planets/planetSurface.ts"
import commandCenterArt from "@/assets/buildings/command-center.png"
import tradeCenterArt from "@/assets/buildings/trade-center.png"
import { ConstructionPanel, type ConstructionPlanning } from "./ConstructionPanel.tsx"

const BUILDING_APPEARANCE = {
  [BuildingType.COMMAND_CENTER]: { name: "Command center", art: commandCenterArt },
  [BuildingType.TRADE_CENTER]: { name: "Trade center", art: tradeCenterArt },
} satisfies Record<BuildingType, { name: string; art: string }>

const RADIUS = 40
const HEX_WIDTH = Math.sqrt(3) * RADIUS
const HEX_OUTLINE = "0,-38 33,-19 33,19 0,38 -33,19 -33,-19"

export function PlanetSurface({
  planet,
  artwork,
  buildings,
  planning,
}: {
  planet: Planet
  artwork: string
  buildings: PlayerView["buildings"]
  planning?: ConstructionPlanning | undefined
}): ReactElement {
  const [selectedSite, setSelectedSite] = useState(0)
  const occupied = new Map(
    buildings.filter((building) => building.planetId === planet.id).map((building) => [building.site, building.type]),
  )
  const sites = planetSurface(planet.area).map(({ site, q, r }) => ({
    site,
    x: HEX_WIDTH * (q + r / 2),
    y: RADIUS * 1.5 * r,
  }))
  const halfWidth = Math.max(HEX_WIDTH * 1.5, ...sites.map(({ x }) => Math.abs(x) + HEX_WIDTH / 2 + 5))
  const halfHeight = Math.max(RADIUS * 2, ...sites.map(({ y }) => Math.abs(y) + RADIUS + 5))
  const selectedType = occupied.get(selectedSite)
  const order = planning?.orders.find((candidate) => candidate.planetId === planet.id)

  return (
    <section aria-label="Planet surface" className="flex min-w-0 flex-col overflow-hidden rounded-xl border border-border/70 bg-[#080e18]">
      <header className="flex items-center gap-3 border-b border-border/60 px-4 py-2">
        <img alt={planet.name} src={artwork} className="size-10 object-contain" />
        <h2 className="font-heading text-lg font-semibold">Planet surface</h2>
      </header>
      <svg
        role="group"
        aria-label="Surface hexes"
        viewBox={`${-halfWidth} ${-halfHeight} ${2 * halfWidth} ${2 * halfHeight}`}
        className="my-auto h-56 w-full sm:h-72"
      >
        {sites.map(({ site, x, y }) => {
          const type = occupied.get(site)
          const planned = order?.site === site
          const displayType = planned ? order.type : type
          const appearance = displayType === undefined ? undefined : BUILDING_APPEARANCE[displayType]
          const isSelected = site === selectedSite
          return (
            <g
              key={site}
              transform={`translate(${x} ${y})`}
              role="button"
              tabIndex={0}
              aria-pressed={isSelected}
              aria-label={`${siteName(site)}, ${planned ? "Planned trade center" : (appearance?.name ?? "Empty")}`}
              className="group/hex cursor-pointer outline-none"
              onClick={() => {
                setSelectedSite(site)
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault()
                  setSelectedSite(site)
                }
              }}
            >
              <polygon
                points={HEX_OUTLINE}
                fill={appearance === undefined ? "#142333" : "#27384a"}
                stroke={isSelected ? "#7dd3fc" : "#50647a"}
                strokeWidth={isSelected ? 3 : 1.5}
                strokeDasharray={planned ? "5 3" : undefined}
                className="group-hover/hex:stroke-sky-200 group-focus-visible/hex:stroke-white group-focus-visible/hex:stroke-[4]"
              />
              {appearance === undefined ? (
                <text textAnchor="middle" dominantBaseline="central" fill="#a2b4c6" fontSize="15" className="pointer-events-none">
                  {site + 1}
                </text>
              ) : (
                <image
                  href={appearance.art}
                  opacity={planned ? 0.5 : 1}
                  x="-25"
                  y="-26"
                  width="50"
                  height="50"
                  aria-label={appearance.name}
                  className="pointer-events-none"
                />
              )}
            </g>
          )
        })}
      </svg>
      <p role="status" aria-label="Selected site" className="border-t border-border/60 px-4 py-3 text-sm">
        <span className="font-semibold">{siteName(selectedSite)}</span>
        <span className="px-2 text-muted-foreground" aria-hidden="true">
          ·
        </span>
        {order?.site === selectedSite
          ? "Planned trade center"
          : selectedType === undefined
            ? "Empty"
            : BUILDING_APPEARANCE[selectedType].name}
        {selectedType === BuildingType.TRADE_CENTER && (
          <span className="ml-3 text-muted-foreground">{TRADE_CENTER_INCOME} credits per turn</span>
        )}
      </p>
      {planning !== undefined && (
        <ConstructionPanel
          key={`${planning.turn}-${order?.id ?? "draft"}`}
          plan={planning}
          site={selectedSite}
          problem={constructionProblem({
            planet,
            playerId: planning.playerId,
            buildings,
            orders: planning.orders,
            balance: planning.balance,
            site: selectedSite,
          })}
          order={order}
        />
      )}
    </section>
  )
}

function siteName(site: number): string {
  return site === 0 ? "Center hex" : `Hex ${site + 1}`
}
