import { z } from "zod"
import type { ResourceType } from "#shared/domain/resources/ResourceType.ts"
import { ResourceTypeSchema } from "#shared/domain/resources/ResourceType.ts"

/**
 * The quantity of every resource that can be held by a player in a game, by the resource type.
 */
export type Resources = Record<ResourceType, number>

/**
 * Parses the complete resource bag for a player.
 */
export const ResourcesSchema = z.record(ResourceTypeSchema, z.number()) satisfies z.ZodType<Resources>
