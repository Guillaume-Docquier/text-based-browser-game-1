import { z } from "zod"

export const SPEED_SCALE = 1
export const BodyRefSchema = z.object({ kind: z.enum(["star", "planet"]), id: z.string().min(1) })
export type BodyRef = z.infer<typeof BodyRefSchema>
export const TravelBodySchema = BodyRefSchema.extend({ name: z.string(), coordinates: z.string(), x: z.number(), y: z.number() })
export type TravelBody = z.infer<typeof TravelBodySchema>
export const TravelRouteSchema = z.object({
  origin: TravelBodySchema,
  destination: TravelBodySchema,
  distance: z.number().nonnegative(),
  speed: z.number().positive(),
  turns: z.int().nonnegative(),
  cost: z.number().nonnegative(),
})
export type TravelRoute = z.infer<typeof TravelRouteSchema>
export const TripSchema = z.object({ route: TravelRouteSchema, completedTurns: z.int().positive() })
export type Trip = z.infer<typeof TripSchema>
export const MoveOrderSchema = z.object({ id: z.uuid(), route: TravelRouteSchema })
export type MoveOrder = z.infer<typeof MoveOrderSchema>

export function departureSpeed(thrust: number, emptyMass: number, cargoMasses: readonly number[]): number {
  const totalMass = cargoMasses.reduce((mass, item) => mass + item, emptyMass)
  return SPEED_SCALE * Math.sqrt(thrust / totalMass)
}

export function quoteTravel(
  origin: TravelBody,
  destination: TravelBody,
  ship: { thrust: number; emptyMass: number },
  cargoMasses: readonly number[],
): TravelRoute {
  const distance = Math.hypot(destination.x - origin.x, destination.y - origin.y)
  const speed = departureSpeed(ship.thrust, ship.emptyMass, cargoMasses)
  return { origin, destination, distance, speed, turns: Math.ceil(distance / speed), cost: distance }
}

export function traveledDistance(route: TravelRoute, completedTurns: number): number {
  return completedTurns >= route.turns ? route.distance : Math.min(route.distance, completedTurns * route.speed)
}

export function tripPosition({ route, completedTurns }: Trip): { x: number; y: number } {
  const fraction = traveledDistance(route, completedTurns) / route.distance
  return {
    x: route.origin.x + (route.destination.x - route.origin.x) * fraction,
    y: route.origin.y + (route.destination.y - route.origin.y) * fraction,
  }
}
