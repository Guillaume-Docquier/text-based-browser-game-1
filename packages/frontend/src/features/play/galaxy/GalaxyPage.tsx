import type { Planet } from "@api-types"
import { useNavigate } from "@tanstack/react-router"
import { ArrowLeft, LocateFixed } from "lucide-react"
import { type AnimationEvent, type ReactElement, useState } from "react"
import { SUN_ID } from "shared/domain/world/Sol.ts"
import type { StarId } from "shared/domain/world/stars/StarId.ts"
import { Button } from "@/components/button.tsx"
import { GalaxyMap } from "@/features/play/galaxy/GalaxyMap.tsx"
import { StarSystemMap } from "@/features/play/galaxy/star-system/StarSystemMap.tsx"
import { usePlayGameContext } from "@/features/play/PlayContext.tsx"

export function GalaxyPage({ starId }: { starId: StarId | undefined }): ReactElement {
  const { gameDetails, playerView } = usePlayGameContext()
  const navigate = useNavigate()
  const [exitingStarId, setExitingStarId] = useState<StarId>()
  const [galaxyResetSignal, setGalaxyResetSignal] = useState(0)
  const [starSystemResetSignal, setStarSystemResetSignal] = useState(0)
  const selectedSystem = playerView.galaxy.systems.find(({ star }) => star.id === starId)
  const isExitingStarSystem = starId !== undefined && exitingStarId === starId
  const totalNbPlanets = playerView.galaxy.systems.flatMap((system) => system.planets).length

  function resetView(): void {
    if (selectedSystem === undefined) {
      setGalaxyResetSignal((currentSignal) => currentSignal + 1)
      return
    }

    setStarSystemResetSignal((currentSignal) => currentSignal + 1)
  }

  function selectSystem(id: StarId | undefined): void {
    void navigate({ to: "/games/$gameId/play/galaxy", params: { gameId: gameDetails.id }, search: id === undefined ? {} : { starId: id } })
  }

  function selectPlanet(planet: Planet): void {
    void navigate({ to: "/games/$gameId/play/planet/$planetId", params: { gameId: gameDetails.id, planetId: planet.id } })
  }

  function showGalaxy(): void {
    setExitingStarId(starId)
  }

  function finishShowingGalaxy(event: AnimationEvent<HTMLDivElement>): void {
    if (event.currentTarget === event.target && event.animationName === "exit" && isExitingStarSystem) {
      setExitingStarId(undefined)
      selectSystem(undefined)
    }
  }

  return (
    <section className="flex min-h-[34rem] min-w-0 flex-1 flex-col">
      <div role="presentation" className="relative min-h-[34rem] flex-1 overflow-hidden bg-[#05080f]">
        <div className="absolute inset-0">
          <div className="size-full" inert={selectedSystem !== undefined}>
            <GalaxyMap
              galaxy={playerView.galaxy}
              currentPlayerId={playerView.player.id}
              resetSignal={galaxyResetSignal}
              onSelectSystem={(system) => {
                selectSystem(system.star.id)
              }}
            />
          </div>
          {selectedSystem !== undefined && (
            <div
              className={`absolute inset-0 bg-[#05080f] ${
                isExitingStarSystem ? "animate-out fade-out-0 duration-300 fill-mode-forwards" : ""
              }`}
              onAnimationEnd={finishShowingGalaxy}
            >
              <div
                className={`size-full duration-300 ${
                  isExitingStarSystem ? "animate-out zoom-out-95 fill-mode-forwards" : "animate-in fade-in-0 zoom-in-95"
                }`}
              >
                <StarSystemMap
                  system={selectedSystem}
                  players={gameDetails.players}
                  resetSignal={starSystemResetSignal}
                  onSelectGalaxy={showGalaxy}
                  onSelectPlanet={selectPlanet}
                />
              </div>
            </div>
          )}
        </div>

        <div className="pointer-events-none absolute top-4 left-4 rounded-md border border-border/70 bg-background/85 px-3 py-2 shadow-lg backdrop-blur-sm">
          <h1 className="font-heading text-base font-semibold text-foreground">
            {selectedSystem === undefined ? "Galaxy" : selectedSystem.star.id === SUN_ID ? "Sol" : selectedSystem.star.name}
          </h1>
          <p className="text-xs text-muted-foreground">
            {selectedSystem === undefined ? "" : `Coordinates: ${selectedSystem.star.coordinates}`}
          </p>
          <p className="text-xs text-muted-foreground">
            {selectedSystem === undefined
              ? `${playerView.galaxy.systems.length.toLocaleString()} Stars | ${totalNbPlanets.toLocaleString()} Planets`
              : `1 Star | ${selectedSystem.planets.length} ${selectedSystem.planets.length === 1 ? "planet" : "planets"}`}
          </p>
        </div>

        <div className="absolute top-4 right-4 flex gap-2">
          {selectedSystem !== undefined && (
            <Button className="bg-background/85 backdrop-blur-sm" size="sm" variant="outline" onClick={showGalaxy}>
              <ArrowLeft />
              Galaxy
            </Button>
          )}
          <Button className="bg-background/85 backdrop-blur-sm" size="sm" variant="outline" onClick={resetView}>
            <LocateFixed />
            Reset view
          </Button>
        </div>

        <div className="pointer-events-none absolute bottom-4 left-4 rounded-md border border-border/70 bg-background/85 px-2.5 py-1.5 text-xs text-muted-foreground backdrop-blur-sm">
          {selectedSystem === undefined
            ? "Drag to pan · Scroll or pinch to zoom · Select a region to center or a star to inspect"
            : "Drag to pan · Scroll or pinch to zoom"}
        </div>
      </div>
    </section>
  )
}
