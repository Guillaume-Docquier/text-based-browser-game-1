import type { Planet, StarSystem } from "@api-types"
import { ArrowLeft, LocateFixed } from "lucide-react"
import { type AnimationEvent, type MouseEvent, type ReactElement, useState } from "react"
import { Button } from "@/components/button.tsx"
import { GalaxyMap } from "@/features/play/galaxy/GalaxyMap.tsx"
import { PlanetDetailsPane } from "@/features/play/galaxy/PlanetDetailsPane.tsx"
import { StarSystemMap } from "@/features/play/galaxy/StarSystemMap.tsx"
import { usePlayGameContext } from "@/features/play/PlayContext.tsx"

type GalaxyView = { type: "galaxy" } | { type: "star-system"; system: StarSystem; transition: "entering" | "exiting" }
type PlanetDetailsView = { planet: Planet; transition: "open" | "closing" }

/**
 * Displays the game's galaxy and lets the player inspect individual Star Systems.
 *
 * @returns The interactive Galaxy page.
 */
export function GalaxyPage(): ReactElement {
  const [view, setView] = useState<GalaxyView>({ type: "galaxy" })
  const [planetDetailsView, setPlanetDetailsView] = useState<PlanetDetailsView | undefined>(undefined)
  const [galaxyResetSignal, setGalaxyResetSignal] = useState(0)
  const [starSystemResetSignal, setStarSystemResetSignal] = useState(0)
  const { playerView } = usePlayGameContext()
  const selectedSystem = view.type === "star-system" ? view.system : undefined
  const isExitingStarSystem = view.type === "star-system" && view.transition === "exiting"
  const totalNbPlanets = playerView.galaxy.systems.flatMap((system) => system.planets).length

  function resetView(): void {
    if (view.type === "galaxy") {
      setGalaxyResetSignal((currentSignal) => currentSignal + 1)
      return
    }

    setStarSystemResetSignal((currentSignal) => currentSignal + 1)
  }

  function showGalaxy(): void {
    startHidingPlanetDetails()
    setView((currentView) => {
      if (currentView.type === "galaxy" || currentView.transition === "exiting") {
        return currentView
      }

      return { ...currentView, transition: "exiting" }
    })
  }

  function finishShowingGalaxy(event: AnimationEvent<HTMLDivElement>): void {
    if (event.currentTarget !== event.target || event.animationName !== "exit" || view.type !== "star-system") {
      return
    }

    setPlanetDetailsView(undefined)
    setView({ type: "galaxy" })
  }

  function showStarSystem(system: StarSystem): void {
    setPlanetDetailsView(undefined)
    setView({ type: "star-system", system, transition: "entering" })
  }

  function showPlanetDetails(planet: Planet): void {
    setPlanetDetailsView({ planet, transition: "open" })
  }

  function hidePlanetDetails(event: MouseEvent<HTMLDivElement>): void {
    if (event.target instanceof Element && event.target.closest("[data-planet-details-pane]") !== null) {
      return
    }

    startHidingPlanetDetails()
  }

  function startHidingPlanetDetails(): void {
    setPlanetDetailsView((currentView) => {
      if (currentView === undefined || currentView.transition === "closing") {
        return currentView
      }

      return { ...currentView, transition: "closing" }
    })
  }

  function finishHidingPlanetDetails(): void {
    setPlanetDetailsView((currentView) => (currentView?.transition === "closing" ? undefined : currentView))
  }

  return (
    <section className="flex min-h-[34rem] min-w-0 flex-1 flex-col">
      <div role="presentation" className="relative min-h-[34rem] flex-1 overflow-hidden bg-[#05080f]" onClick={hidePlanetDetails}>
        <div className="absolute inset-0">
          <div className="size-full" inert={selectedSystem !== undefined}>
            <GalaxyMap galaxy={playerView.galaxy} resetSignal={galaxyResetSignal} onSelectSystem={showStarSystem} />
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
                  resetSignal={starSystemResetSignal}
                  onSelectGalaxy={showGalaxy}
                  onSelectPlanet={showPlanetDetails}
                />
              </div>
            </div>
          )}
        </div>

        <div className="pointer-events-none absolute top-4 left-4 rounded-md border border-border/70 bg-background/85 px-3 py-2 shadow-lg backdrop-blur-sm">
          <h1 className="font-heading text-base font-semibold text-foreground">
            {selectedSystem === undefined ? "Galaxy" : selectedSystem.star.name}
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
            ? "Drag to pan · Scroll or pinch to zoom · Select a star to inspect"
            : "Drag to pan · Scroll or pinch to zoom"}
        </div>

        {planetDetailsView !== undefined && (
          <PlanetDetailsPane
            planet={planetDetailsView.planet}
            isClosing={planetDetailsView.transition === "closing"}
            onCloseAnimationEnd={finishHidingPlanetDetails}
          />
        )}
      </div>
    </section>
  )
}
