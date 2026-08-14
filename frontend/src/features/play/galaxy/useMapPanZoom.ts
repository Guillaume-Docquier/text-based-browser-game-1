import { useEffect, useRef, useState, type PointerEvent, type RefObject, type TransitionEvent } from "react"

type Point = {
  x: number
  y: number
}

type ViewportTransform = Point & {
  scale: number
}

type CenterOnOptions = {
  scale?: number
  onCentered?: () => void
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
const CENTERING_POSITION_EPSILON = 0.001
const MIN_CENTERING_DURATION_MS = 100
const MAX_CENTERING_DURATION_MS = 350
const CENTERING_SPEED_VIEWPORT_UNITS_PER_MS = 2
const CENTERING_FALLBACK_BUFFER_MS = 100

/**
 * Provides shared mouse, touch, and wheel interactions for an SVG map viewport.
 *
 * @param resetSignal - A value whose changes reset the viewport.
 * @param viewportCenter - The center of the visible SVG viewport.
 * @returns SVG event handlers and the transform for the map contents.
 */
export function useMapPanZoom({ resetSignal, viewportCenter }: { resetSignal: number; viewportCenter: Point }): {
  centeringDurationMs: number
  isCentering: boolean
  isPanning: boolean
  transform: string
  centerOn: (point: Point, options?: CenterOnOptions) => void
  onPointerCancel: (event: PointerEvent<SVGSVGElement>) => void
  onPointerDown: (event: PointerEvent<SVGSVGElement>) => void
  onPointerMove: (event: PointerEvent<SVGSVGElement>) => void
  onPointerUp: (event: PointerEvent<SVGSVGElement>) => void
  onTransformTransitionEnd: (event: TransitionEvent<SVGGElement>) => void
  viewportRef: RefObject<SVGSVGElement | null>
} {
  const [viewportTransform, setViewportTransform] = useState(INITIAL_TRANSFORM)
  const [centeringDurationMs, setCenteringDurationMs] = useState(0)
  const [isCentering, setIsCentering] = useState(false)
  const [isPanning, setIsPanning] = useState(false)
  const centeringCompletion = useRef<(() => void) | undefined>(undefined)
  const centeringTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const isCenteringRef = useRef(false)
  const pointers = useRef(new Map<number, Point>())
  const pointerOrigins = useRef(new Map<number, Point>())
  const viewportRef = useRef<SVGSVGElement>(null)

  useEffect(() => {
    const viewport = viewportRef.current
    if (viewport === null) {
      return
    }

    const onWheel = (event: WheelEvent): void => {
      event.preventDefault()
      const point = toSvgPoint({ element: viewport, clientX: event.clientX, clientY: event.clientY })
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

    viewport.addEventListener("wheel", onWheel, { passive: false })
    return (): void => {
      viewport.removeEventListener("wheel", onWheel)
    }
  }, [])

  useEffect(() => {
    if (centeringTimer.current !== undefined) {
      clearTimeout(centeringTimer.current)
      centeringTimer.current = undefined
    }
    centeringCompletion.current = undefined
    isCenteringRef.current = false
    pointers.current.clear()
    pointerOrigins.current.clear()
    setCenteringDurationMs(0)
    setIsCentering(false)
    setIsPanning(false)
    setViewportTransform(INITIAL_TRANSFORM)

    return (): void => {
      if (centeringTimer.current !== undefined) {
        clearTimeout(centeringTimer.current)
      }
    }
  }, [resetSignal])

  function onPointerDown(event: PointerEvent<SVGSVGElement>): void {
    const point = toSvgPoint({ element: event.currentTarget, clientX: event.clientX, clientY: event.clientY })
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

  function centerOn(point: Point, options: CenterOnOptions = {}): void {
    if (isCenteringRef.current) {
      return
    }

    const scale = clampScale(options.scale ?? viewportTransform.scale)
    const centeredTransform = {
      x: viewportCenter.x - point.x * scale,
      y: viewportCenter.y - point.y * scale,
      scale,
    }
    const panDistance = distance(viewportTransform, centeredTransform)
    const scaleDistance = Math.abs(viewportTransform.scale - centeredTransform.scale)
    if (panDistance <= CENTERING_POSITION_EPSILON && scaleDistance <= CENTERING_POSITION_EPSILON) {
      options.onCentered?.()
      return
    }

    const durationMs = calculateCenteringDurationMs(panDistance)
    isCenteringRef.current = true
    centeringCompletion.current = options.onCentered
    setCenteringDurationMs(durationMs)
    setIsCentering(true)
    setViewportTransform(centeredTransform)
    centeringTimer.current = setTimeout(finishCentering, durationMs + CENTERING_FALLBACK_BUFFER_MS)
  }

  function onTransformTransitionEnd(event: TransitionEvent<SVGGElement>): void {
    if (event.currentTarget !== event.target || event.propertyName !== "transform") {
      return
    }

    finishCentering()
  }

  function finishCentering(): void {
    if (!isCenteringRef.current) {
      return
    }

    if (centeringTimer.current !== undefined) {
      clearTimeout(centeringTimer.current)
      centeringTimer.current = undefined
    }
    const onCentered = centeringCompletion.current
    centeringCompletion.current = undefined
    isCenteringRef.current = false
    setIsCentering(false)
    onCentered?.()
  }

  return {
    centeringDurationMs,
    isCentering,
    isPanning,
    transform: `translate(${viewportTransform.x} ${viewportTransform.y}) scale(${viewportTransform.scale})`,
    centerOn,
    onPointerCancel: onPointerEnd,
    onPointerDown,
    onPointerMove,
    onPointerUp: onPointerEnd,
    onTransformTransitionEnd,
    viewportRef,
  }
}

function calculateCenteringDurationMs(panDistance: number): number {
  return Math.round(
    Math.min(MAX_CENTERING_DURATION_MS, Math.max(MIN_CENTERING_DURATION_MS, panDistance / CENTERING_SPEED_VIEWPORT_UNITS_PER_MS)),
  )
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
    currentPoint: toSvgPoint({ element: event.currentTarget, clientX: event.clientX, clientY: event.clientY }),
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
  const scale = clampScale(requestedScale)
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

function clampScale(scale: number): number {
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale))
}

function toSvgPoint({ element, clientX, clientY }: { element: SVGSVGElement; clientX: number; clientY: number }): Point {
  const matrix = element.getScreenCTM()
  if (matrix === null) {
    return { x: clientX, y: clientY }
  }

  const point = new DOMPoint(clientX, clientY).matrixTransform(matrix.inverse())
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
