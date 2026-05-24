import type { Body, MovementEdge, Orbit, Sector } from "#lib/db/star-systems/starSystems.repository.ts"
import { Assert } from "@guillaume-docquier/tools-ts"

const MOVEMENT_EDGE_WEIGHT = 1

export function generateMovementEdges({
  orbits,
  sectors,
  bodies,
}: {
  orbits: readonly Orbit[]
  sectors: readonly Sector[]
  bodies: readonly Body[]
}): MovementEdge[] {
  const edges = new Map<string, MovementEdge>()
  const sortedOrbits = orbits.toSorted((orbitA, orbitB) => orbitA.orbitNumber - orbitB.orbitNumber)
  const orbitNumbersById = new Map(sortedOrbits.map((orbit) => [orbit.id, orbit.orbitNumber]))
  const sortedSectors = sectors.toSorted((sectorA, sectorB) => {
    const orbitNumberA = orbitNumbersById.get(sectorA.orbitId) ?? Number.MAX_SAFE_INTEGER
    const orbitNumberB = orbitNumbersById.get(sectorB.orbitId) ?? Number.MAX_SAFE_INTEGER
    if (orbitNumberA !== orbitNumberB) {
      return orbitNumberA - orbitNumberB
    }

    return sectorA.sectorNumber - sectorB.sectorNumber
  })
  const sectorSortKeysById = new Map(sortedSectors.map((sector, index) => [sector.id, index]))
  const sortedBodies = bodies.toSorted((bodyA, bodyB) => {
    const sectorIndexA = sectorSortKeysById.get(bodyA.sectorId) ?? Number.MAX_SAFE_INTEGER
    const sectorIndexB = sectorSortKeysById.get(bodyB.sectorId) ?? Number.MAX_SAFE_INTEGER
    if (sectorIndexA !== sectorIndexB) {
      return sectorIndexA - sectorIndexB
    }

    return bodyA.bodyNumber - bodyB.bodyNumber
  })
  const sectorsByOrbitId = Map.groupBy(sortedSectors, ({ orbitId }) => orbitId)
  const bodiesBySectorId = Map.groupBy(sortedBodies, ({ sectorId }) => sectorId)

  for (const sector of sortedSectors) {
    const sectorBodies = bodiesBySectorId.get(sector.id) ?? []

    for (const body of sectorBodies) {
      addUndirectedEdge(edges, sector.movementNodeId, body.movementNodeId)
    }

    for (let fromIndex = 0; fromIndex < sectorBodies.length; fromIndex++) {
      for (let toIndex = fromIndex + 1; toIndex < sectorBodies.length; toIndex++) {
        const fromBody = sectorBodies[fromIndex]
        const toBody = sectorBodies[toIndex]
        Assert.isDefined(fromBody)
        Assert.isDefined(toBody)

        addUndirectedEdge(edges, fromBody.movementNodeId, toBody.movementNodeId)
      }
    }
  }

  for (const orbit of sortedOrbits) {
    const orbitSectors = sectorsByOrbitId.get(orbit.id) ?? []
    for (let index = 0; index < orbitSectors.length; index++) {
      const fromSector = orbitSectors[index]
      const toSector = orbitSectors[(index + 1) % orbitSectors.length]
      if (fromSector === undefined || toSector === undefined || fromSector.id === toSector.id) {
        continue
      }
      addUndirectedEdge(edges, fromSector.movementNodeId, toSector.movementNodeId)
    }
  }

  for (let orbitIndex = 0; orbitIndex < sortedOrbits.length - 1; orbitIndex++) {
    const innerOrbit = sortedOrbits[orbitIndex]
    const outerOrbit = sortedOrbits[orbitIndex + 1]
    Assert.isDefined(innerOrbit)
    Assert.isDefined(outerOrbit)

    const innerSectors = sectorsByOrbitId.get(innerOrbit.id) ?? []
    const outerSectors = sectorsByOrbitId.get(outerOrbit.id) ?? []

    for (const innerSector of innerSectors) {
      const firstOuterSector = outerSectors[(innerSector.sectorNumber - 1) * 2]
      const secondOuterSector = outerSectors[(innerSector.sectorNumber - 1) * 2 + 1]
      Assert.isDefined(firstOuterSector)
      Assert.isDefined(secondOuterSector)

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
