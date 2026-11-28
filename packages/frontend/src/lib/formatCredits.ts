import { creditDigits } from "shared/domain/games/credits.ts"

export function formatCredits(value: string | number): string {
  const [whole = "", fraction] = creditDigits(value).split(".")
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",")
  return fraction === undefined ? grouped : `${grouped}.${fraction}`
}
