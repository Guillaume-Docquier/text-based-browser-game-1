import { cn } from "../../lib/utils"

export function Skeleton({ className, ...props }: React.ComponentProps<"div">): React.JSX.Element {
  return <div data-slot="skeleton" className={cn("animate-pulse rounded-2xl bg-muted", className)} {...props} />
}
