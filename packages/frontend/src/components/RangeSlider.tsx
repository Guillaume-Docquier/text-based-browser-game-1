import { Slider as SliderPrimitive } from "@base-ui/react/slider"
import { cn } from "cn"
import * as React from "react"

export function RangeSlider({
  className,
  value,
  thumbLabels,
  ...props
}: Omit<SliderPrimitive.Root.Props<[number, number]>, "defaultValue" | "value"> & {
  value: [number, number]
  thumbLabels: [string, string]
}): React.JSX.Element {
  return (
    <SliderPrimitive.Root
      data-slot="range-slider"
      value={value}
      thumbCollisionBehavior="none"
      className={cn("relative flex w-full touch-none items-center select-none data-disabled:opacity-50", className)}
      {...props}
    >
      <SliderPrimitive.Control className="relative flex h-4 w-full items-center">
        <SliderPrimitive.Track data-slot="range-slider-track" className="relative h-1.5 w-full grow overflow-hidden rounded-full bg-muted">
          <SliderPrimitive.Indicator data-slot="range-slider-range" className="absolute h-full bg-primary" />
        </SliderPrimitive.Track>
        {value.map((_, index) => (
          <SliderPrimitive.Thumb
            data-slot="range-slider-thumb"
            index={index}
            aria-label={thumbLabels[index]}
            className="block size-4 shrink-0 rounded-full border border-primary bg-background shadow-sm ring-ring/30 transition-shadow hover:ring-4 has-focus-visible:ring-4 has-focus-visible:outline-none data-disabled:pointer-events-none data-disabled:opacity-50"
            key={thumbLabels[index]}
          />
        ))}
      </SliderPrimitive.Control>
    </SliderPrimitive.Root>
  )
}
