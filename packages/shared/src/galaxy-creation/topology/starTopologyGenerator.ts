import type { XY } from "@guillaume-docquier/tools-ts"

export type StarTopology = XY

export function starTopologyGenerator({ x, y }: XY): StarTopology {
  return { x, y }
}
