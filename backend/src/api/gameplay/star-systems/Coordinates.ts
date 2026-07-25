/**
 * Coordinates follow an Orbit:Sector:Body format, with 2 digits per part
 * e.g:
 * - 02 (Orbit 2)
 * - 02:11 (Orbit 2, Sector 11)
 * - 02:11:05 (Orbit 2, Sector 11, Body 5)
 */
export type Coordinates = string

/**
 * Can be one of:
 * - orbit
 * - orbit + sector
 * - orbit + sector + body
 *
 * This signature uses optional + never to make it easier to implement
 */
export type StarSystemEntities =
  | { orbitNumber: number; sectorNumber?: never; bodyNumber?: never }
  | { orbitNumber: number; sectorNumber: number; bodyNumber?: never }
  | { orbitNumber: number; sectorNumber: number; bodyNumber: number }

/**
 * Converts star system entities to their coordinates.
 */
export function toCoordinates({ orbitNumber, sectorNumber, bodyNumber }: StarSystemEntities): Coordinates {
  return [orbitNumber, sectorNumber, bodyNumber]
    .filter((entityNumber) => entityNumber !== undefined)
    .map(toCoordinatesSegment)
    .join(COORDINATES_SEGMENT_SEPARATOR)
}

const COORDINATES_SEGMENT_SEPARATOR = ":"

function toCoordinatesSegment(entityNumber: number): string {
  return entityNumber.toString().padStart(2, "0")
}
