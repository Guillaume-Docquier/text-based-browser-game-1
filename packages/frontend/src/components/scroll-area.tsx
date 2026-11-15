import { ScrollArea as ScrollAreaPrimitive } from "@base-ui/react/scroll-area"
import { cn } from "cn"
import * as React from "react"

type ScrollAreaProps = React.ComponentProps<typeof ScrollAreaPrimitive.Root> & {
  readonly scrollbarStyle?: React.CSSProperties
}

function ScrollArea({ className, children, scrollbarStyle, ...props }: ScrollAreaProps): React.JSX.Element {
  return (
    <ScrollAreaPrimitive.Root data-slot="scroll-area" className={cn("relative", className)} {...props}>
      <ScrollAreaPrimitive.Viewport
        data-slot="scroll-area-viewport"
        className="size-full rounded-[inherit] transition-[color,box-shadow] outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-1"
      >
        <ScrollAreaPrimitive.Content>{children}</ScrollAreaPrimitive.Content>
      </ScrollAreaPrimitive.Viewport>
      <ScrollBar style={scrollbarStyle} />
      <ScrollAreaPrimitive.Corner />
    </ScrollAreaPrimitive.Root>
  )
}

function ScrollBar({ className, orientation = "vertical", ...props }: ScrollAreaPrimitive.Scrollbar.Props): React.JSX.Element {
  return (
    <ScrollAreaPrimitive.Scrollbar
      data-slot="scroll-area-scrollbar"
      data-orientation={orientation}
      orientation={orientation}
      className={cn(
        "flex touch-none p-px transition-opacity select-none opacity-0 data-hovering:opacity-100 data-scrolling:opacity-100 data-horizontal:h-2.5 data-horizontal:flex-col data-horizontal:border-t data-horizontal:border-t-transparent data-vertical:h-full data-vertical:w-2.5 data-vertical:border-l data-vertical:border-l-transparent",
        className,
      )}
      {...props}
    >
      <ScrollAreaPrimitive.Thumb
        data-slot="scroll-area-thumb"
        className="relative flex-1 rounded-full bg-muted-foreground/40 transition-colors hover:bg-muted-foreground/60"
      />
    </ScrollAreaPrimitive.Scrollbar>
  )
}

export { ScrollArea, ScrollBar }
