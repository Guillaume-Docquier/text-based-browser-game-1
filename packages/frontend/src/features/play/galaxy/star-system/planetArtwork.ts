import type { Planet } from "@api-types"
import { SUN_ID, type SOL_PLANETS } from "shared/domain/world/Sol.ts"
import type { StarId } from "shared/domain/world/stars/StarId.ts"
import earth from "@/assets/planets/earth.png"
import jupiter from "@/assets/planets/jupiter.png"
import mars from "@/assets/planets/mars.png"
import mercury from "@/assets/planets/mercury.png"
import neptune from "@/assets/planets/neptune.png"
import saturn from "@/assets/planets/saturn.png"
import uranus from "@/assets/planets/uranus.png"
import venus from "@/assets/planets/venus.png"
import { PLANET_BIOME_IMAGES } from "@/features/play/galaxy/star-system/planetBiomeImages.ts"

const SOL_ART = {
  Mercury: mercury,
  Venus: venus,
  Earth: earth,
  Mars: mars,
  Jupiter: jupiter,
  Saturn: saturn,
  Uranus: uranus,
  Neptune: neptune,
} satisfies Record<(typeof SOL_PLANETS)[number]["name"], string>
const artByName = new Map<string, string>(Object.entries(SOL_ART))

export function planetArtwork(planet: Planet, starId: StarId): string {
  return (starId === SUN_ID ? artByName.get(planet.name) : undefined) ?? PLANET_BIOME_IMAGES[planet.biome]
}
