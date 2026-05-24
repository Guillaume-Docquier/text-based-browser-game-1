import type { Body, MovementEdge, Orbit, Sector } from "#lib/db/star-systems/starSystems.repository.ts"

const MOVEMENT_EDGE_WEIGHT = 1

export function generateMovementEdges({ orbits, sectors, bodies }: { orbits: Orbit[]; sectors: Sector[]; bodies: Body[] }): MovementEdge[] {
  const edges = new Map<string, MovementEdge>()
  const sectorsByOrbitId = Map.groupBy(sectors, ({ orbitId }) => orbitId)
  const bodiesBySectorId = Map.groupBy(bodies, ({ sectorId }) => sectorId)

  for (const sector of sectors) {
    const sectorBodies = bodiesBySectorId.get(sector.id) ?? []

    for (const body of sectorBodies) {
      addUndirectedEdge(edges, sector.movementNodeId, body.movementNodeId)
    }

    for (let fromIndex = 0; fromIndex < sectorBodies.length; fromIndex++) {
      for (let toIndex = fromIndex + 1; toIndex < sectorBodies.length; toIndex++) {
        const fromBody = sectorBodies[fromIndex]
        const toBody = sectorBodies[toIndex]
        if (fromBody === undefined || toBody === undefined) {
          throw new Error("Could not build same-sector Body edge")
        }
        addUndirectedEdge(edges, fromBody.movementNodeId, toBody.movementNodeId)
      }
    }
  }

  for (const orbit of orbits) {
    const orbitSectors = (sectorsByOrbitId.get(orbit.id) ?? []).toSorted((sectorA, sectorB) => sectorA.sectorNumber - sectorB.sectorNumber)
    for (let index = 0; index < orbitSectors.length; index++) {
      const fromSector = orbitSectors[index]
      const toSector = orbitSectors[(index + 1) % orbitSectors.length]
      if (fromSector === undefined || toSector === undefined || fromSector.id === toSector.id) {
        continue
      }
      addUndirectedEdge(edges, fromSector.movementNodeId, toSector.movementNodeId)
    }
  }

  for (let orbitIndex = 0; orbitIndex < orbits.length - 1; orbitIndex++) {
    const innerOrbit = orbits[orbitIndex]
    const outerOrbit = orbits[orbitIndex + 1]
    if (innerOrbit === undefined || outerOrbit === undefined) {
      throw new Error("Could not build radial Sector edge")
    }

    const innerSectors = (sectorsByOrbitId.get(innerOrbit.id) ?? []).toSorted(
      (sectorA, sectorB) => sectorA.sectorNumber - sectorB.sectorNumber,
    )
    const outerSectors = (sectorsByOrbitId.get(outerOrbit.id) ?? []).toSorted(
      (sectorA, sectorB) => sectorA.sectorNumber - sectorB.sectorNumber,
    )

    for (const innerSector of innerSectors) {
      const firstOuterSector = outerSectors[(innerSector.sectorNumber - 1) * 2]
      const secondOuterSector = outerSectors[(innerSector.sectorNumber - 1) * 2 + 1]
      if (firstOuterSector === undefined || secondOuterSector === undefined) {
        throw new Error("Outer Orbit does not have double the inner Orbit Sector count")
      }

      addUndirectedEdge(edges, innerSector.movementNodeId, firstOuterSector.movementNodeId)
      addUndirectedEdge(edges, innerSector.movementNodeId, secondOuterSector.movementNodeId)
    }
  }

  return [...edges.values()]
}

function addUndirectedEdge(edges: Map<string, MovementEdge>, fromNodeId: string, toNodeId: string): void {
  addDirectedEdge(edges, fromNodeId, toNodeId)
  addDirectedEdge(edges, toNodeId, fromNodeId)
}

function addDirectedEdge(edges: Map<string, MovementEdge>, fromNodeId: string, toNodeId: string): void {
  edges.set(`${fromNodeId}->${toNodeId}`, { fromNodeId, toNodeId, weight: MOVEMENT_EDGE_WEIGHT })
}
