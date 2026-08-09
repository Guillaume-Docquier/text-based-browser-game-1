import { useEffect, useRef, useState, type PointerEvent, type WheelEvent } from "react"

type Point = {
  x: number
  y: number
}

type ViewportTransform = Point & {
  scale: number
}

type PointerMovement = {
  pointerId: number
  previousPoint: Point
  currentPoint: Point
  pointerOrigin: Point
}

type MapGesture =
  | { type: "none" }
  | { type: "pan"; translation: Point }
  | {
      type: "pinch"
      previousCenter: Point
      currentCenter: Point
      scaleFactor: number
    }

const INITIAL_TRANSFORM: ViewportTransform = { x: 0, y: 0, scale: 1 }
const MIN_SCALE = 0.75
const MAX_SCALE = 36
const DRAG_THRESHOLD = 3

/**
 * Provides shared mouse, touch, and wheel interactions for an SVG map viewport.
 *
 * @param resetSignal - A value whose changes reset the viewport.
 * @returns SVG event handlers and the transform for the map contents.
 */
export function useMapPanZoom({ resetSignal }: { resetSignal: number }): {
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
  const pointerOrigins = useRef(new Map<number, Point>())

  useEffect(() => {
    pointers.current.clear()
    pointerOrigins.current.clear()
    setIsPanning(false)
    setViewportTransform(INITIAL_TRANSFORM)
  }, [resetSignal])

  function onPointerDown(event: PointerEvent<SVGSVGElement>): void {
    const point = toSvgPoint(event)
    pointers.current.set(event.pointerId, point)
    pointerOrigins.current.set(event.pointerId, point)
  }

  function onPointerMove(event: PointerEvent<SVGSVGElement>): void {
    const movement = getPointerMovement({ event, pointers: pointers.current, pointerOrigins: pointerOrigins.current })
    if (movement === undefined) {
      return
    }

    if (!isPanningGesture({ movement, isPanning })) {
      return
    }

    capturePointer(event)
    setIsPanning(true)

    const gesture = updatePointersAndCreateGesture({ pointers: pointers.current, movement })
    setViewportTransform((currentTransform) => applyGesture(currentTransform, gesture))
  }

  function onPointerEnd(event: PointerEvent<SVGSVGElement>): void {
    pointers.current.delete(event.pointerId)
    pointerOrigins.current.delete(event.pointerId)
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

function getPointerMovement({
  event,
  pointers,
  pointerOrigins,
}: {
  event: PointerEvent<SVGSVGElement>
  pointers: ReadonlyMap<number, Point>
  pointerOrigins: ReadonlyMap<number, Point>
}): PointerMovement | undefined {
  const previousPoint = pointers.get(event.pointerId)
  const pointerOrigin = pointerOrigins.get(event.pointerId)
  if (previousPoint === undefined || pointerOrigin === undefined) {
    return undefined
  }

  return {
    pointerId: event.pointerId,
    previousPoint,
    currentPoint: toSvgPoint(event),
    pointerOrigin,
  }
}

function isPanningGesture({ movement, isPanning }: { movement: PointerMovement; isPanning: boolean }): boolean {
  return isPanning || distance(movement.pointerOrigin, movement.currentPoint) >= DRAG_THRESHOLD
}

function capturePointer(event: PointerEvent<SVGSVGElement>): void {
  if (event.currentTarget.hasPointerCapture(event.pointerId)) {
    return
  }

  event.currentTarget.setPointerCapture(event.pointerId)
}

function updatePointersAndCreateGesture({ pointers, movement }: { pointers: Map<number, Point>; movement: PointerMovement }): MapGesture {
  const previousPointers = Array.from(pointers.values())
  pointers.set(movement.pointerId, movement.currentPoint)

  if (pointers.size === 1) {
    return {
      type: "pan",
      translation: {
        x: movement.currentPoint.x - movement.previousPoint.x,
        y: movement.currentPoint.y - movement.previousPoint.y,
      },
    }
  }

  return createPinchGesture(previousPointers, Array.from(pointers.values()))
}

function createPinchGesture(previousPointers: Point[], currentPointers: Point[]): MapGesture {
  const previousPair = firstTwoPoints(previousPointers)
  const currentPair = firstTwoPoints(currentPointers)
  if (previousPair === undefined || currentPair === undefined) {
    return { type: "none" }
  }

  const previousDistance = distance(...previousPair)
  if (previousDistance === 0) {
    return { type: "none" }
  }

  return {
    type: "pinch",
    previousCenter: midpoint(...previousPair),
    currentCenter: midpoint(...currentPair),
    scaleFactor: distance(...currentPair) / previousDistance,
  }
}

function firstTwoPoints(points: Point[]): [Point, Point] | undefined {
  const [firstPoint, secondPoint] = points
  if (firstPoint === undefined || secondPoint === undefined) {
    return undefined
  }

  return [firstPoint, secondPoint]
}

function applyGesture(currentTransform: ViewportTransform, gesture: MapGesture): ViewportTransform {
  switch (gesture.type) {
    case "none":
      return currentTransform
    case "pan":
      return {
        ...currentTransform,
        x: currentTransform.x + gesture.translation.x,
        y: currentTransform.y + gesture.translation.y,
      }
    case "pinch":
      return zoomAroundPoint({
        currentTransform,
        previousPoint: gesture.previousCenter,
        currentPoint: gesture.currentCenter,
        requestedScale: currentTransform.scale * gesture.scaleFactor,
      })
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
