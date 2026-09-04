import type { Enumify } from "@guillaume-docquier/tools-ts"

/** Player colors in allocation-priority order. */
export type PlayerColor = Enumify<typeof PlayerColor>
export const PlayerColor = {
  WHITE: "WHITE",
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
