import { Assert } from "@guillaume-docquier/tools-ts"

/**
 * Measures rendered geometry, including CSS transitions, rather than the target transform attribute.
 */
export function distanceFromMapCenter(map: Element, target: Element): number {
  const mapBox = map.getBoundingClientRect()
  const targetBox = target.getBoundingClientRect()
  return Math.hypot(
    targetBox.x + targetBox.width / 2 - (mapBox.x + mapBox.width / 2),
    targetBox.y + targetBox.height / 2 - (mapBox.y + mapBox.height / 2),
  )
}

/**
 * Labels extend below the star, so use its circular hit area when measuring its center.
 */
export function starHitArea(star: Element): SVGCircleElement {
  const circle = star.querySelector("circle:last-of-type")
  Assert.isTrue(circle instanceof SVGCircleElement)
  return circle
}
