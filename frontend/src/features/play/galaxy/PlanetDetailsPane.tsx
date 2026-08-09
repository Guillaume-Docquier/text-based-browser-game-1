import type { Planet } from "@api-types"
import type { AnimationEvent, ReactElement } from "react"
import { cn } from "@/lib/cn.ts"

/**
 * Displays the generated characteristics of a selected Planet.
 *
 * @param planet - The Planet selected on the Star System map.
 * @param isClosing - Whether the pane is currently sliding out.
 * @param onCloseAnimationEnd - Removes the pane after its closing animation.
 * @returns A floating Planet details pane.
 */
export function PlanetDetailsPane({
  planet,
  isClosing,
  onCloseAnimationEnd,
}: {
  planet: Planet
  isClosing: boolean
  onCloseAnimationEnd: () => void
}): ReactElement {
  const attributes = [
    { label: "Fertility", value: planet.fertility },
    { label: "Metal", value: planet.metal },
    { label: "Fuel", value: planet.fuel },
    { label: "Energy", value: planet.energy },
  ]

  function finishClosing(event: AnimationEvent<HTMLElement>): void {
    if (!isClosing || event.currentTarget !== event.target || event.animationName !== "exit") {
      return
    }

    onCloseAnimationEnd()
  }

  return (
    <aside
      data-planet-details-pane
      aria-atomic="true"
      aria-label={`${planet.name} details`}
      aria-live="polite"
      className={cn(
        "absolute top-16 right-4 bottom-4 z-20 w-[min(22rem,calc(100%-2rem))] overflow-y-auto rounded-xl border border-border/70 bg-background/90 shadow-2xl backdrop-blur-md duration-200",
        isClosing
          ? "pointer-events-none animate-out fade-out-0 slide-out-to-right-8 fill-mode-forwards"
          : "animate-in fade-in-0 slide-in-from-right-8",
      )}
      onAnimationEnd={finishClosing}
    >
      <header className="border-b border-border/60 px-5 py-4">
        <p className="text-xs font-medium tracking-[0.18em] text-muted-foreground uppercase">Planet profile</p>
        <h2 className="mt-1 font-heading text-2xl font-semibold text-foreground">{planet.name}</h2>
        <div className="mt-3 flex flex-wrap gap-2 text-xs font-medium">
          <span className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-2.5 py-1 text-cyan-100">
            <span className="sr-only">Biome: </span>
            {formatCategory(planet.biome)}
          </span>
          <span className="rounded-full border border-border/70 bg-muted/50 px-2.5 py-1 text-foreground">
            <span className="sr-only">Size: </span>
            {formatCategory(planet.size)}
          </span>
        </div>
      </header>

      <div className="space-y-6 px-5 py-5">
        <section aria-labelledby="planet-attributes-heading">
          <h3 id="planet-attributes-heading" className="text-xs font-semibold tracking-[0.14em] text-muted-foreground uppercase">
            Planet attributes
          </h3>
          <dl className="mt-3 grid grid-cols-2 gap-2">
            {attributes.map((attribute) => (
              <div key={attribute.label} className="rounded-lg border border-border/50 bg-muted/30 px-3 py-2.5">
                <dt className="text-xs text-muted-foreground">{attribute.label}</dt>
                <dd className="mt-0.5 font-heading text-lg font-semibold text-foreground">{attribute.value}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section aria-labelledby="planet-capacity-heading">
          <h3 id="planet-capacity-heading" className="text-xs font-semibold tracking-[0.14em] text-muted-foreground uppercase">
            Capacity
          </h3>
          <dl className="mt-3 divide-y divide-border/50 rounded-lg border border-border/50 bg-muted/20 px-3">
            <PlanetFact label="Max population" value={planet.maxPopulation.toLocaleString()} />
            <PlanetFact label="Area" value={`${planet.area.toLocaleString()} slots`} />
          </dl>
        </section>

        <section aria-labelledby="planet-location-heading">
          <h3 id="planet-location-heading" className="text-xs font-semibold tracking-[0.14em] text-muted-foreground uppercase">
            Location
          </h3>
          <dl className="mt-3 rounded-lg border border-border/50 bg-muted/20 px-3">
            <PlanetFact label="Coordinates" value={planet.coordinates} />
          </dl>
        </section>
      </div>
    </aside>
  )
}

function PlanetFact({ label, value }: { label: string; value: string }): ReactElement {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="text-right text-sm font-medium text-foreground">{value}</dd>
    </div>
  )
}

function formatCategory(category: string): string {
  return `${category.at(0) ?? ""}${category.slice(1).toLowerCase()}`
}
