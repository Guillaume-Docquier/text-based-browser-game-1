import type { ReactElement, ReactNode } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card.tsx"

interface AuthPageShellProps {
  title: string
  description: string
  children: ReactNode
}

export function AuthPageShell({ title, description, children }: AuthPageShellProps): ReactElement {
  return (
    <div className="flex min-h-[calc(100vh-8rem)] w-full items-center justify-center px-4 py-10">
      <div className="grid w-full max-w-5xl gap-8 lg:grid-cols-[1.15fr_0.85fr]">
        <section className="relative overflow-hidden rounded-[2rem] border border-border/60 bg-card/70 p-8 shadow-xl backdrop-blur md:p-10">
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/70 to-transparent" />
          <div className="space-y-6">
            <div className="inline-flex rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs uppercase tracking-[0.25em] text-primary-foreground/80">
              Cosmic Empires
            </div>
            <div className="space-y-3">
              <h1 className="font-heading text-4xl font-semibold tracking-tight md:text-5xl">{title}</h1>
              <p className="max-w-xl text-sm leading-7 text-muted-foreground md:text-base">{description}</p>
            </div>
          </div>
        </section>
        <Card className="border-border/60 bg-card/85 shadow-xl backdrop-blur">
          <CardHeader>
            <CardTitle>{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center">{children}</CardContent>
        </Card>
      </div>
    </div>
  )
}
