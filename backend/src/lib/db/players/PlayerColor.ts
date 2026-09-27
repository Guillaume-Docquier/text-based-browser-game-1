import type { Enumify } from "@guillaume-docquier/tools-ts"

/** Player colors persisted by the database. */
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

/**
 * Player color allocation priority. Early colors balance separation from one another
 * with visibility against the game's dark background.
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
