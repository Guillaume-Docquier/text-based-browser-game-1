import type { Rng, XY } from "@guillaume-docquier/tools-ts"

export function clusterGenerator({
  origin,
  radius,
  nbPoints,
  rng,
  options: { spreadFactor = 0.25 } = {},
}: {
  origin: XY
  radius: number
  nbPoints: number
  rng: Rng
  options?: {
    spreadFactor?: number | undefined
  }
}): XY[] {
  const std = radius * spreadFactor
  return Array.from({ length: nbPoints }, () => ({
    x: rng.normal(origin.x, std),
    y: rng.normal(origin.y, std),
  }))
}
