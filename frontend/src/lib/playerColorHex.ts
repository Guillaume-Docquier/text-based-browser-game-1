import type { PlayerColor } from "@api-types"

/** StarCraft II colors for backend-owned player color tokens. */
export const PLAYER_COLOR_HEX = {
  WHITE: "#FFFFFF",
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
