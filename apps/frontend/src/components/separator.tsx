import { Separator as SeparatorPrimitive } from "@base-ui/react/separator"
import { cn } from "cn"
import * as React from "react"

export function Separator({
  className,
  orientation = "horizontal",
  decorative = true,
  ...props
}: SeparatorPrimitive.Props & { decorative?: boolean }): React.JSX.Element {
  return (
    <SeparatorPrimitive
      data-slot="separator"
      role={decorative ? "none" : "separator"}
      aria-orientation={decorative ? undefined : orientation}
      orientation={orientation}
      className={cn(
        "shrink-0 bg-border data-horizontal:h-px data-horizontal:w-full data-vertical:w-px data-vertical:self-stretch",
        className,
      )}
      {...props}
    />
  )
}
