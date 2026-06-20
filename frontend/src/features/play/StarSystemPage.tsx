import { CircleDot } from "lucide-react"
import type { ReactElement } from "react"
import { StarSystemSvg } from "./components/StarSystemSvg.tsx"
import { usePlayGameContext } from "./PlayContext.tsx"

export function StarSystemPage(): ReactElement {
  const { playerView } = usePlayGameContext()
  const { starSystem } = playerView
  const sectorCount = starSystem.orbits.reduce((count, orbit) => count + orbit.sectors.length, 0)
  const bodyCount = starSystem.orbits.reduce(
    (count, orbit) => count + orbit.sectors.reduce((orbitBodyCount, sector) => orbitBodyCount + sector.bodies.length, 0),
    0,
  )

  return (
    <section className="flex min-h-[34rem] flex-col">
      <div className="relative min-h-[28rem] flex-1 overflow-hidden rounded-md border border-border/70 bg-[#080b12]">
        <div className="absolute inset-0 opacity-60 [background-image:radial-gradient(circle,rgba(255,255,255,0.35)_0.7px,transparent_0.8px)] [background-size:31px_31px]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(31,41,55,0.15),rgba(3,7,18,0.7)_75%)]" />
        <div className="relative mx-auto aspect-square h-full max-h-[calc(100vh-13rem)] min-h-[28rem] max-w-full">
          {starSystem.orbits.length === 0 ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-muted-foreground">
              <CircleDot className="size-8" />
              This Star System has no orbits.
            </div>
          ) : (
            <StarSystemSvg starSystem={starSystem} />
          )}
        </div>
        <div className="pointer-events-none absolute bottom-4 left-4 flex items-center gap-3 rounded-md border border-border/70 bg-background/80 px-2.5 py-1.5 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-full bg-lime-600" />
            Planet
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-slate-300" />
            Moon
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-2.5 rotate-45 bg-stone-400" />
            Asteroid
          </span>
        </div>
        <div className="pointer-events-none absolute right-4 bottom-4 rounded-md border border-border/70 bg-background/80 px-2.5 py-1.5 text-xs text-muted-foreground">
          {starSystem.orbits.length} orbits · {sectorCount} sectors · {bodyCount} bodies
        </div>
      </div>
    </section>
  )
}
