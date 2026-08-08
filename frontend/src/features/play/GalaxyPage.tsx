import type { StarSystem } from "@api-types"
import { ArrowLeft, LocateFixed } from "lucide-react"
import { type ReactElement, useState } from "react"
import { Button } from "@/components/button.tsx"
import { GalaxyMap } from "@/features/play/GalaxyMap.tsx"
import { usePlayGameContext } from "@/features/play/PlayContext.tsx"
import { StarSystemMap } from "@/features/play/StarSystemMap.tsx"

/**
 * Displays the game's galaxy and lets the player inspect individual Star Systems.
 *
 * @returns The interactive Galaxy page.
 */
export function GalaxyPage(): ReactElement {
  const [selectedSystem, setSelectedSystem] = useState<StarSystem | undefined>()
  const [resetSignal, setResetSignal] = useState(0)
  const { playerView } = usePlayGameContext()

  function resetView(): void {
    setResetSignal((currentSignal) => currentSignal + 1)
  }

  function showGalaxy(): void {
    setSelectedSystem(undefined)
    resetView()
  }

  return (
    <section className="flex min-h-[34rem] min-w-0 flex-1 flex-col">
      <div className="relative min-h-[34rem] flex-1 overflow-hidden bg-[#05080f]">
        <div className="absolute inset-0">
          {selectedSystem === undefined ? (
            <GalaxyMap galaxy={playerView.galaxy} resetSignal={resetSignal} onSelectSystem={setSelectedSystem} />
          ) : (
            <div className="size-full animate-in fade-in-0 zoom-in-95 duration-300">
              <StarSystemMap system={selectedSystem} resetSignal={resetSignal} onSelectGalaxy={showGalaxy} />
            </div>
          )}
        </div>

        <div className="pointer-events-none absolute top-4 left-4 rounded-md border border-border/70 bg-background/85 px-3 py-2 shadow-lg backdrop-blur-sm">
          <h1 className="font-heading text-base font-semibold text-foreground">
            {selectedSystem === undefined ? "Galaxy" : selectedSystem.star.name}
          </h1>
          <p className="text-xs text-muted-foreground">
            {selectedSystem === undefined
              ? `${playerView.galaxy.systems.length.toLocaleString()} Star Systems`
              : `${selectedSystem.planets.length} ${selectedSystem.planets.length === 1 ? "planet" : "planets"}`}
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
      </div>
    </section>
  )
}
