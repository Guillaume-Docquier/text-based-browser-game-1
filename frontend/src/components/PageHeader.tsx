import type { ReactElement, ReactNode } from "react"
import { cn } from "../lib/cn.ts"

interface PageHeaderProps {
  title: string
  description?: string
  actions?: ReactNode
  className?: string
}

export function PageHeader({ title, description, actions, className }: PageHeaderProps): ReactElement {
  return (
    <div className={cn("flex flex-col gap-4 md:flex-row md:items-end md:justify-between", className)}>
      <div className="space-y-2">
        <h1 className="font-heading text-3xl font-semibold tracking-tight text-foreground md:text-4xl">{title}</h1>
        {description === undefined ? null : <p className="max-w-2xl text-sm text-muted-foreground md:text-base">{description}</p>}
      </div>
      {actions === undefined ? null : <div className="flex flex-wrap items-center gap-3">{actions}</div>}
    </div>
  )
}
