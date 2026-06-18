import type { Range } from "@guillaume-docquier/tools-ts"
import type { MovementNodeId } from "#api/gameplay/star-systems/MovementNodeId.ts"
import type { BodyType } from "#lib/db/star-systems/BodyType.ts"

export type NewStarSystemModel = {
  orbits: NewOrbitModel[]
  sectors: NewSectorModel[]
  bodies: NewBodyModel[]
  movementNodes: NewMovementNodeModel[]
  movementEdges: NewMovementEdgeModel[]
}

export type NewOrbitModel = {
  id: string
  orbitNumber: number
}

export type NewSectorModel = {
  id: string
  orbitId: string
  sectorNumber: number
  angleRange: Range
  movementNodeId: MovementNodeId
}

export type NewBodyModel = {
  id: string
  sectorId: string
  bodyNumber: number
  bodyType: BodyType
  name: string
  movementNodeId: MovementNodeId
}

export type NewMovementNodeModel = {
  id: MovementNodeId
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
  id: string
  number: number
  coordinates: string
  angleRange: Range
  bodies: BodyModel[]
  movementNodeId: MovementNodeId
}

export type BodyModel = {
  id: string
  number: number
  coordinates: string
  name: string
  type: BodyType
  movementNodeId: MovementNodeId
}

export type MovementEdgeModel = {
  fromNodeId: MovementNodeId
  toNodeId: MovementNodeId
  weight: number
}
