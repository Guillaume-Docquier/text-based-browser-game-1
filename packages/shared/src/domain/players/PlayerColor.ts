import type { Enumify } from "@guillaume-docquier/tools-ts"
import { z } from "zod"

/**
 * 16 colors matching the maximum of 16 players
 */
export type PlayerColor = Enumify<typeof PlayerColor>
export const PlayerColor = {
  TURQUOISE: "TURQUOISE",
  RED: "RED",
  BLUE: "BLUE",
  TEAL: "TEAL",
  PURPLE: "PURPLE",
  YELLOW: "YELLOW",
  ORANGE: "ORANGE",
  GREEN: "GREEN",
  LIGHT_PINK: "LIGHT_PINK",
  VIOLET: "VIOLET",
  LIGHT_GREY: "LIGHT_GREY",
  DARK_GREEN: "DARK_GREEN",
  BROWN: "BROWN",
  LIGHT_GREEN: "LIGHT_GREEN",
  DARK_GREY: "DARK_GREY",
  PINK: "PINK",
} as const

export const PlayerColorSchema = z.enum(PlayerColor) satisfies z.ZodType<PlayerColor>

/**
 * Player colors in the order they should be distributed to maximize contrast.
 * It's hard to find 16 colors with good contrast, but the first 8 are pretty good.
 */
export const PLAYER_COLOR_PRIORITY = [
  PlayerColor.TURQUOISE,
  PlayerColor.PINK,
  PlayerColor.YELLOW,
  PlayerColor.ORANGE,
  PlayerColor.BLUE,
  PlayerColor.GREEN,
  PlayerColor.LIGHT_PINK,
  PlayerColor.TEAL,
  PlayerColor.LIGHT_GREEN,
  PlayerColor.RED,
  PlayerColor.LIGHT_GREY,
  PlayerColor.DARK_GREEN,
  PlayerColor.DARK_GREY,
  PlayerColor.PURPLE,
  PlayerColor.VIOLET,
  PlayerColor.BROWN,
] as const satisfies readonly PlayerColor[]
