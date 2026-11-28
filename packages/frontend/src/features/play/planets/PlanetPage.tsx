import type { Planet, StarSystem } from "@api-types"
import { Link } from "@tanstack/react-router"
import { ArrowLeft } from "lucide-react"
import type { ReactElement } from "react"
import { BuildingType } from "shared/domain/world/buildings/Building.ts"
import { hasOwnedCommandCenter } from "shared/domain/world/buildings/ConstructionOrder.ts"
import type { PlanetId } from "shared/domain/world/planets/PlanetId.ts"
import { SUN_ID } from "shared/domain/world/Sol.ts"
import { buttonVariants } from "@/components/button.tsx"
import { planetArtwork } from "@/features/play/galaxy/star-system/planetArtwork.ts"
import { usePlayGameContext } from "@/features/play/PlayContext.tsx"
import { useConstruction } from "@/lib/api/useConstruction.ts"
import { PlanetSurface } from "./PlanetSurface.tsx"

export function PlanetPage({ planetId }: { planetId: PlanetId }): ReactElement {
  const { gameDetails, playerView } = usePlayGameContext()
  const target = findPlanet(playerView.galaxy.systems, planetId)
  if (target === undefined) {
    return (
      <section className="flex flex-1 flex-col items-start gap-4 p-6">
        <h1 className="font-heading text-2xl">Planet unavailable</h1>
        <Link to="/games/$gameId/play/galaxy" params={{ gameId: gameDetails.id }} className={buttonVariants({ variant: "outline" })}>
          <ArrowLeft /> Return to Galaxy
        </Link>
      </section>
    )
  }

  const { system, planet } = target
  const owner = gameDetails.players.find(({ id }) => id === planet.ownerPlayerId)
  const ownerName = planet.ownerPlayerId === null ? "Unclaimed" : (owner?.alias ?? `Player ${planet.ownerPlayerId}`)
  const systemName = system.star.id === SUN_ID ? "Sol" : system.star.name

  const canBuild = hasOwnedCommandCenter(planet, playerView.player.id, playerView.buildings)
  const artwork = planetArtwork(planet, system.star.id)
  return (
    <article aria-labelledby="planet-name" className="flex min-w-0 flex-1 flex-col gap-5 overflow-y-auto p-4 sm:p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 id="planet-name" className="font-heading text-3xl font-semibold">
          {planet.name}
        </h1>
        <Link
          to="/games/$gameId/play/galaxy"
          params={{ gameId: gameDetails.id }}
          search={{ starId: system.star.id }}
          className={buttonVariants({ variant: "outline", size: "sm" })}
        >
          <ArrowLeft /> Return to {systemName}
        </Link>
      </header>
      <div className="grid flex-1 content-start gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(16rem,22rem)]">
        {canBuild ? (
          <ColonySurface key={planet.id} planet={planet} artwork={artwork} />
        ) : (
          <PlanetSurface key={planet.id} planet={planet} artwork={artwork} buildings={playerView.buildings} />
        )}

        <PlanetFacts planet={planet} ownerName={ownerName} />
      </div>
    </article>
  )
}

function ColonySurface({ planet, artwork }: { planet: Planet; artwork: string }): ReactElement {
  const { playerView, canTakeAction } = usePlayGameContext()
  const construction = useConstruction(playerView.gameId)
  const target = { gameId: playerView.gameId, turn: playerView.turn }
  return (
    <PlanetSurface
      planet={planet}
      artwork={artwork}
      buildings={playerView.buildings}
      planning={{
        playerId: playerView.player.id,
        turn: playerView.turn,
        balance: playerView.player.creditBalance,
        orders: playerView.constructionOrders,
        open: canTakeAction,
        pending: construction.isPending,
        error: construction.error?.message,
        submit: (site) => {
          construction.mutate({ ...target, action: "submit", planetId: planet.id, type: BuildingType.TRADE_CENTER, site })
        },
        cancel: (orderId) => {
          construction.mutate({ ...target, action: "cancel", orderId })
        },
      }}
    />
  )
}

function PlanetFacts({ planet, ownerName }: { planet: Planet; ownerName: string }): ReactElement {
  const facts = [
    ["Coordinates", planet.coordinates],
    ["Owner", ownerName],
    ["Biome", formatCategory(planet.biome)],
    ["Size", formatCategory(planet.size)],
    ["Area", `${planet.area.toLocaleString()} slots`],
    ["Metal production per mine per turn", planet.metalProduction],
    ["Remaining metal deposit", planet.remainingMetalDeposit],
  ] as const

  return (
    <section aria-labelledby="planet-attributes" className="self-start rounded-xl border border-border/70 bg-card px-5 py-4">
      <h2 id="planet-attributes" className="font-heading text-lg font-semibold">
        Planet attributes
      </h2>
      <dl className="mt-2 divide-y divide-border/60">
        {facts.map(([label, value]) => (
          <div key={label} className="flex items-baseline justify-between gap-4 py-2.5">
            <dt className="text-sm text-muted-foreground">{label}</dt>
            <dd className="break-words text-right text-sm font-medium tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}

function formatCategory(category: string): string {
  return category.charAt(0) + category.slice(1).toLowerCase()
}

function findPlanet(systems: readonly StarSystem[], planetId: PlanetId): { system: StarSystem; planet: Planet } | undefined {
  for (const system of systems) {
    const planet = system.planets.find(({ id }) => id === planetId)
    if (planet !== undefined) {
      return { system, planet }
    }
  }
  return undefined
}
