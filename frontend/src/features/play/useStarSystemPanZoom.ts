import { useEffect, useRef, useState, type PointerEvent, type WheelEvent } from "react"
import type { Point } from "@/features/play/starSystemGeometry.ts"

type ViewportTransform = {
  x: number
  y: number
  scale: number
}

const INITIAL_TRANSFORM: ViewportTransform = { x: 0, y: 0, scale: 1 }
const MIN_SCALE = 0.75
const MAX_SCALE = 6

export function useStarSystemPanZoom({ resetSignal }: { resetSignal: number }): {
  isPanning: boolean
  transform: string
  onPointerCancel: (event: PointerEvent<SVGSVGElement>) => void
  onPointerDown: (event: PointerEvent<SVGSVGElement>) => void
  onPointerMove: (event: PointerEvent<SVGSVGElement>) => void
  onPointerUp: (event: PointerEvent<SVGSVGElement>) => void
  onWheel: (event: WheelEvent<SVGSVGElement>) => void
} {
  const [viewportTransform, setViewportTransform] = useState(INITIAL_TRANSFORM)
  const [isPanning, setIsPanning] = useState(false)
  const pointers = useRef(new Map<number, Point>())

  useEffect(() => {
    pointers.current.clear()
    setIsPanning(false)
    setViewportTransform(INITIAL_TRANSFORM)
  }, [resetSignal])

  function onPointerDown(event: PointerEvent<SVGSVGElement>): void {
    event.currentTarget.setPointerCapture(event.pointerId)
    pointers.current.set(event.pointerId, toSvgPoint(event))
    setIsPanning(true)
  }

  function onPointerMove(event: PointerEvent<SVGSVGElement>): void {
    const previousPoint = pointers.current.get(event.pointerId)
    if (previousPoint === undefined) {
      return
    }

    const previousPointers = Array.from(pointers.current.values())
    const currentPoint = toSvgPoint(event)
    pointers.current.set(event.pointerId, currentPoint)
    const currentPointers = Array.from(pointers.current.values())

    if (currentPointers.length === 1) {
      setViewportTransform((currentTransform) => ({
        ...currentTransform,
        x: currentTransform.x + currentPoint.x - previousPoint.x,
        y: currentTransform.y + currentPoint.y - previousPoint.y,
      }))
      return
    }

    const [previousFirst, previousSecond] = previousPointers
    const [currentFirst, currentSecond] = currentPointers
    if (previousFirst === undefined || previousSecond === undefined || currentFirst === undefined || currentSecond === undefined) {
      return
    }

    const previousCenter = midpoint(previousFirst, previousSecond)
    const currentCenter = midpoint(currentFirst, currentSecond)
    const previousDistance = distance(previousFirst, previousSecond)
    const currentDistance = distance(currentFirst, currentSecond)
    if (previousDistance === 0) {
      return
    }

    setViewportTransform((currentTransform) =>
      zoomAroundPoint({
        currentTransform,
        previousPoint: previousCenter,
        currentPoint: currentCenter,
        requestedScale: currentTransform.scale * (currentDistance / previousDistance),
      }),
    )
  }

  function onPointerEnd(event: PointerEvent<SVGSVGElement>): void {
    pointers.current.delete(event.pointerId)
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    setIsPanning(pointers.current.size > 0)
  }

  function onWheel(event: WheelEvent<SVGSVGElement>): void {
    event.preventDefault()
    const point = toSvgPoint(event)
    const zoomFactor = Math.exp(-event.deltaY * 0.0015)

    setViewportTransform((currentTransform) =>
      zoomAroundPoint({
        currentTransform,
        previousPoint: point,
        currentPoint: point,
        requestedScale: currentTransform.scale * zoomFactor,
      }),
    )
  }

  return {
    isPanning,
    transform: `translate(${viewportTransform.x} ${viewportTransform.y}) scale(${viewportTransform.scale})`,
    onPointerCancel: onPointerEnd,
    onPointerDown,
    onPointerMove,
    onPointerUp: onPointerEnd,
    onWheel,
  }
}

function zoomAroundPoint({
  currentTransform,
  previousPoint,
  currentPoint,
  requestedScale,
}: {
  currentTransform: ViewportTransform
  previousPoint: Point
  currentPoint: Point
  requestedScale: number
}): ViewportTransform {
  const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, requestedScale))
  const worldPoint = {
    x: (previousPoint.x - currentTransform.x) / currentTransform.scale,
    y: (previousPoint.y - currentTransform.y) / currentTransform.scale,
  }

  return {
    x: currentPoint.x - worldPoint.x * scale,
    y: currentPoint.y - worldPoint.y * scale,
    scale,
  }
}

function toSvgPoint(event: PointerEvent<SVGSVGElement> | WheelEvent<SVGSVGElement>): Point {
  const matrix = event.currentTarget.getScreenCTM()
  if (matrix === null) {
    return { x: event.clientX, y: event.clientY }
  }

  const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse())
  return { x: point.x, y: point.y }
}

function midpoint(firstPoint: Point, secondPoint: Point): Point {
  return {
    x: (firstPoint.x + secondPoint.x) / 2,
    y: (firstPoint.y + secondPoint.y) / 2,
  }
}

function distance(firstPoint: Point, secondPoint: Point): number {
  return Math.hypot(secondPoint.x - firstPoint.x, secondPoint.y - firstPoint.y)
}
