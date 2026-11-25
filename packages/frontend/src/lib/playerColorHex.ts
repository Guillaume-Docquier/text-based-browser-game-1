import { PlayerColor } from "shared/domain/players/PlayerColor.ts"

export const PLAYER_COLOR_HEX = {
  [PlayerColor.TURQUOISE]: "#00CDB7",
  [PlayerColor.RED]: "#B4141E",
  [PlayerColor.BLUE]: "#0042FF",
  [PlayerColor.TEAL]: "#1CA7EA",
  [PlayerColor.PURPLE]: "#540081",
  [PlayerColor.YELLOW]: "#EBE129",
  [PlayerColor.ORANGE]: "#FE8A0E",
  [PlayerColor.GREEN]: "#168000",
  [PlayerColor.LIGHT_PINK]: "#CCA6FC",
  [PlayerColor.VIOLET]: "#1F01C9",
  [PlayerColor.LIGHT_GREY]: "#525494",
  [PlayerColor.DARK_GREEN]: "#106246",
  [PlayerColor.BROWN]: "#4E2A04",
  [PlayerColor.LIGHT_GREEN]: "#96FF91",
  [PlayerColor.DARK_GREY]: "#232323",
  [PlayerColor.PINK]: "#E55BB0",
} as const satisfies Record<PlayerColor, `#${string}`>

export const UNCLAIMED_COLOR_HEX = "#636363"

export function formatPlayerColor(color: PlayerColor): string {
  return color
    .toLowerCase()
    .split("_")
    .map((word) => `${word.charAt(0).toUpperCase()}${word.slice(1)}`)
    .join(" ")
}
