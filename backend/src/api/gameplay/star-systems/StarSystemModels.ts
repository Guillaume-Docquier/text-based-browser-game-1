import type { Range } from "@guillaume-docquier/tools-ts"
import type { MovementTargetId } from "#lib/db/gameplay/MovementTargetId.ts"
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
  id: MovementTargetId
  orbitId: string
  sectorNumber: number
  angleRange: Range
}

export type NewBodyModel = {
  id: MovementTargetId
  sectorId: MovementTargetId
  bodyNumber: number
  bodyType: BodyType
  name: string
}

export type NewMovementEdgeModel = {
  fromTargetId: MovementTargetId
  toTargetId: MovementTargetId
  weight: number
}

export type StarSystemModel = {
  /**
   * Star system as a tree
   */
  orbits: OrbitModel[]
  /**
   * Movement edges by movement target id
   */
  movementEdges: Record<MovementTargetId, MovementEdgeModel[]>
}

export type OrbitModel = {
  id: string
  number: number
  coordinates: string
  sectors: SectorModel[]
}

export type SectorModel = {
  id: MovementTargetId
  number: number
  coordinates: string
  angleRange: Range
  bodies: BodyModel[]
}

export type BodyModel = {
  id: MovementTargetId
  number: number
  coordinates: string
  name: string
  type: BodyType
}

export type MovementEdgeModel = {
  fromTargetId: MovementTargetId
  toTargetId: MovementTargetId
  weight: number
}
