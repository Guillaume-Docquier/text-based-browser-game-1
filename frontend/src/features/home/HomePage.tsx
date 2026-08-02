import { Link } from "@tanstack/react-router"
import { ArrowRight, ShieldCheck, TimerReset, Waypoints } from "lucide-react"
import { type ReactElement } from "react"
import { Button } from "@/components/button.tsx"
import { Card, CardContent } from "@/components/card.tsx"

export function HomePage(): ReactElement {
  return (
    <div className="flex min-h-[calc(100vh-12rem)] items-center">
      <div className="grid w-full gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(18rem,0.7fr)]">
        <Card className="overflow-hidden border border-border/60 bg-card/85 shadow-xl backdrop-blur">
          <CardContent className="flex flex-col gap-8 px-6 py-10 sm:px-10">
            <div className="space-y-4">
              <div className="inline-flex w-fit rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs uppercase tracking-[0.28em] text-primary">
                Browser strategy, without the idle fluff
              </div>
              <div className="space-y-3">
                <h1 className="max-w-4xl font-heading text-4xl font-semibold tracking-tight text-foreground sm:text-5xl lg:text-6xl">
                  Build your empire and dominate the galaxy
                </h1>
                <p className="max-w-3xl text-base leading-7 text-muted-foreground sm:text-lg">
                  Cosmic Empires is a deep text based strategy game. Build bases, develop an economy, craft specialized spaceships and
                  position your fleets. Trade technologies and intel to establish dominance.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Button asChild size="lg">
                <Link to="/games">
                  Play for free
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg">
                <Link to="/sign-up">Create account</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
        <div className="grid gap-4">
          <FeatureCard
            icon={<Waypoints className="size-5" />}
            title="Strategic positioning"
            description="Expand methodically, pressure borders, and turn movement into leverage before open war starts."
          />
          <FeatureCard
            icon={<ShieldCheck className="size-5" />}
            title="Asymmetric fleets"
            description="Mix infrastructure, logistics, and ship design choices to shape how each war is actually fought."
          />
          <FeatureCard
            icon={<TimerReset className="size-5" />}
            title="Persistent turns"
            description="Plan around the next turn, not twitch mechanics. Decisions compound even when you are offline."
          />
        </div>
      </div>
    </div>
  )
}

function FeatureCard({ icon, title, description }: { icon: ReactElement; title: string; description: string }): ReactElement {
  return (
    <Card className="border border-border/60 bg-card/75 shadow-lg backdrop-blur">
      <CardContent className="flex gap-4 px-6 py-5">
        <div className="flex size-11 shrink-0 items-center justify-center rounded-3xl bg-primary/12 text-primary">{icon}</div>
        <div className="space-y-1.5">
          <h2 className="font-heading text-lg font-medium tracking-tight text-foreground">{title}</h2>
          <p className="text-sm leading-6 text-muted-foreground">{description}</p>
        </div>
      </CardContent>
    </Card>
  )
}
