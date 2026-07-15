import type { Range } from "@guillaume-docquier/tools-ts"
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
  id: string
  orbitId: string
  sectorNumber: number
  angleRange: Range
}

export type NewBodyModel = {
  id: string
  sectorId: string
  bodyNumber: number
  bodyType: BodyType
  name: string
}

export type NewMovementEdgeModel = {
  fromTargetId: string
  toTargetId: string
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
  movementEdges: Record<string, MovementEdgeModel[]>
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
}

export type BodyModel = {
  id: string
  number: number
  coordinates: string
  name: string
  type: BodyType
}

export type MovementEdgeModel = {
  fromTargetId: string
  toTargetId: string
  weight: number
}
