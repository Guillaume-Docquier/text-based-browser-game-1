/**
 * A concrete Star System location that gameplay state can reference.
 */
export type MovementTarget =
  | {
      readonly targetType: "SECTOR"
      readonly sectorId: string
    }
  | {
      readonly targetType: "BODY"
      readonly bodyId: string
    }
