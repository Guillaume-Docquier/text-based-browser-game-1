export type SurfaceHex = { readonly site: number; readonly q: number; readonly r: number }

const CLOCKWISE_STEPS = [
  [-1, 1],
  [-1, 0],
  [0, -1],
  [1, -1],
  [1, 0],
  [0, 1],
] as const

export function planetSurface(area: number): SurfaceHex[] {
  if (area <= 0) {
    return []
  }

  const hexes: SurfaceHex[] = [{ site: 0, q: 0, r: 0 }]
  for (let radius = 1; hexes.length < area; radius++) {
    let q = radius
    let r = 0
    for (const [dq, dr] of CLOCKWISE_STEPS) {
      for (let step = 0; step < radius; step++) {
        hexes.push({ site: hexes.length, q, r })
        if (hexes.length === area) {
          return hexes
        }
        q += dq
        r += dr
      }
    }
  }
  return hexes
}
