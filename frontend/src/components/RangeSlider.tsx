import { Slider as SliderPrimitive } from "radix-ui"
import * as React from "react"
import { cn } from "@/lib/cn.ts"

export function RangeSlider({
  className,
  value,
  thumbLabels,
  ...props
}: Omit<React.ComponentProps<typeof SliderPrimitive.Root>, "defaultValue" | "value"> & {
  value: [number, number]
  thumbLabels: [string, string]
}): React.JSX.Element {
  return (
    <SliderPrimitive.Root
      data-slot="range-slider"
      value={value}
      className={cn("relative flex w-full touch-none items-center select-none data-disabled:opacity-50", className)}
      {...props}
    >
      <SliderPrimitive.Track data-slot="range-slider-track" className="relative h-1.5 w-full grow overflow-hidden rounded-full bg-muted">
        <SliderPrimitive.Range data-slot="range-slider-range" className="absolute h-full bg-primary" />
      </SliderPrimitive.Track>
      {value.map((_, index) => (
        <SliderPrimitive.Thumb
          data-slot="range-slider-thumb"
          aria-label={thumbLabels[index]}
          className="block size-4 shrink-0 rounded-full border border-primary bg-background shadow-sm ring-ring/30 transition-shadow hover:ring-4 focus-visible:ring-4 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50"
          key={index}
        />
      ))}
    </SliderPrimitive.Root>
  )
}
