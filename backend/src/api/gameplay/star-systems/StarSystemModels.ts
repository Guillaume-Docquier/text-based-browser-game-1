import type { Range } from "@guillaume-docquier/tools-ts"
import type { MovementNodeId } from "#lib/db/gameplay/MovementNodeId.ts"
import type { BodyType } from "#lib/db/star-systems/BodyType.ts"

export type NewStarSystemModel = {
  orbits: NewOrbitModel[]
  sectors: NewSectorModel[]
  bodies: NewBodyModel[]
  movementEdges: NewMovementEdgeModel[]
}

export type NewOrbitModel = {
  id: string
  orbitNumber: number
}

export type NewSectorModel = {
  id: MovementNodeId
  orbitId: string
  sectorNumber: number
  angleRange: Range
}

export type NewBodyModel = {
  id: MovementNodeId
  sectorId: MovementNodeId
  bodyNumber: number
  bodyType: BodyType
  name: string
}

export type NewMovementEdgeModel = {
  fromNodeId: MovementNodeId
  toNodeId: MovementNodeId
  weight: number
}

export type StarSystemModel = {
  /**
   * Star system as a tree
   */
  orbits: OrbitModel[]
  /**
   * Movement edges by movement node id
   */
  movementEdges: Record<MovementNodeId, MovementEdgeModel[]>
}

export type OrbitModel = {
  id: string
  number: number
  coordinates: string
  sectors: SectorModel[]
}

export type SectorModel = {
  id: MovementNodeId
  number: number
  coordinates: string
  angleRange: Range
  bodies: BodyModel[]
}

export type BodyModel = {
  id: MovementNodeId
  number: number
  coordinates: string
  name: string
  type: BodyType
}

export type MovementEdgeModel = {
  fromNodeId: MovementNodeId
  toNodeId: MovementNodeId
  weight: number
}
