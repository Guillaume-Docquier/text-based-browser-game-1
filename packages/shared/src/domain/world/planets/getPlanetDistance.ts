export function getPlanetDistance(
  origin: { readonly x: number; readonly y: number },
  destination: { readonly x: number; readonly y: number },
): number {
  return Math.hypot(destination.x - origin.x, destination.y - origin.y)
}
