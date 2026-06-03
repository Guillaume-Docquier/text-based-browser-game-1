import { CircleDot, Map } from "lucide-react"
import type { ReactElement } from "react"
import { usePlayGameContext } from "./PlayContext.tsx"

export function StarSystemPage(): ReactElement {
  const { game } = usePlayGameContext()

  return (
    <section className="flex min-h-[34rem] flex-col gap-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <div className="text-xs font-medium tracking-[0.2em] text-muted-foreground uppercase">Star System</div>
          <h2 className="font-heading text-2xl font-semibold text-foreground">{game.settings.name} system</h2>
        </div>
        <div className="flex h-10 w-fit items-center gap-2 rounded-md border border-border/70 bg-card/45 px-3 text-sm font-medium text-foreground">
          <Map className="size-4 text-primary" />
          Map view
        </div>
      </div>
      <div className="relative min-h-[28rem] flex-1 overflow-hidden rounded-md border border-border/70 bg-card/40">
        <div className="absolute inset-0 opacity-70 [background-image:radial-gradient(circle,rgba(255,255,255,0.22)_1px,transparent_1px)] [background-size:34px_34px]" />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="relative size-80 max-h-[70vw] max-w-[70vw]">
            <div className="absolute inset-0 rounded-full border border-primary/25" />
            <div className="absolute inset-10 rounded-full border border-primary/20" />
            <div className="absolute inset-20 rounded-full border border-primary/15" />
            <div className="absolute top-1/2 left-1/2 size-7 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary shadow-[0_0_36px_rgba(209,129,47,0.35)]" />
            <CircleDot className="absolute top-6 left-1/2 size-5 -translate-x-1/2 text-sky-200" />
            <CircleDot className="absolute right-10 bottom-20 size-4 text-emerald-200" />
            <CircleDot className="absolute bottom-12 left-20 size-3 text-amber-100" />
          </div>
        </div>
        <div className="absolute right-4 bottom-4 rounded-md border border-border/70 bg-background/80 px-3 py-2 text-sm text-muted-foreground">
          Star System canvas
        </div>
      </div>
    </section>
  )
}
