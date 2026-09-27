import type { PlayerColor } from "@api-types"

/** StarCraft II inspired colors for backend-owned player color tokens. */
export const PLAYER_COLOR_HEX = {
  TURQUOISE: "#00CDB7",
  RED: "#B4141E",
  BLUE: "#0042FF",
  TEAL: "#1CA7EA",
  PURPLE: "#540081",
  YELLOW: "#EBE129",
  ORANGE: "#FE8A0E",
  GREEN: "#168000",
  LIGHT_PINK: "#CCA6FC",
  VIOLET: "#1F01C9",
  LIGHT_GREY: "#525494",
  DARK_GREEN: "#106246",
  BROWN: "#4E2A04",
  LIGHT_GREEN: "#96FF91",
  DARK_GREY: "#232323",
  PINK: "#E55BB0",
} as const satisfies Record<PlayerColor, `#${string}`>

export const UNCLAIMED_COLOR_HEX = "#636363"

/** Formats a player color token for display. */
export function formatPlayerColor(color: PlayerColor): string {
  return color
    .toLowerCase()
    .split("_")
    .map((word) => `${word.charAt(0).toUpperCase()}${word.slice(1)}`)
    .join(" ")
}
