import { randomUUID } from "node:crypto"
import { eq } from "drizzle-orm"
import { Assert, type Logger, Range, Result, type Range as RangeType } from "@guillaume-docquier/tools-ts"
import { PostgresRepository } from "#lib/db/PostgresRepository.ts"
import { starSystemGenerationSettingsTable } from "#lib/db/schema.ts"
import { couldNot } from "#lib/errors.ts"

const RANGE_NUMERIC_TYPES = ["float", "integer"] as const
const RANGE_MAX_BOUND_TYPES = ["inclusive", "exclusive"] as const

export type StarSystemGenerationSettings = {
  planetDensity: RangeType
  nbPlanets: RangeType
  nbMoonsPerPlanet: RangeType
  nbAsteroidBelts: RangeType
  nbAsteroidsPerSector: RangeType
  seed: number
}

export type StarSystemGenerationSettingsReadModel = StarSystemGenerationSettings & {
  id: string
  createdAt: Date
}

type StarSystemGenerationSettingsRow = typeof starSystemGenerationSettingsTable.$inferSelect
type StarSystemGenerationSettingsInsert = typeof starSystemGenerationSettingsTable.$inferInsert

export class StarSystemGenerationSettingsRepository extends PostgresRepository {
  private readonly logger: Logger

  public constructor({ logger, db }: { logger: Logger; db: PostgresRepository["db"] }) {
    super({ db })
    this.logger = logger.child({ scope: "star-system-generation-settings-repository" })
  }

  public async create(
    generationSettings: StarSystemGenerationSettings,
    db: PostgresRepository["db"] = this.db,
  ): Promise<Result<StarSystemGenerationSettingsReadModel, string>> {
    const createResult = await Result.tryCatch(async () => {
      const rows = await db.insert(starSystemGenerationSettingsTable).values(toInsert(generationSettings)).returning()
      Assert.isTrue(rows.length === 1)
      Assert.isDefined(rows[0])

      return toReadModel(rows[0])
    })

    if (Result.isFailure(createResult)) {
      this.logger.error("Could not create Star System generation settings", { generationSettings, error: createResult.error })
      return Result.Failure(couldNot("create Star System generation settings"))
    }

    return createResult
  }

  public async getById(
    { id }: { id: string },
    db: PostgresRepository["db"] = this.db,
  ): Promise<Result<StarSystemGenerationSettingsReadModel | undefined, string>> {
    const getResult = await Result.tryCatch(async () => {
      const rows = await db.select().from(starSystemGenerationSettingsTable).where(eq(starSystemGenerationSettingsTable.id, id))
      Assert.isTrue(rows.length <= 1)

      const row = rows[0]
      if (row === undefined) {
        return undefined
      }

      return toReadModel(row)
    })

    if (Result.isFailure(getResult)) {
      this.logger.error("Could not get Star System generation settings", { id, error: getResult.error })
      return Result.Failure(couldNot("get Star System generation settings"))
    }

    return getResult
  }
}

function toInsert(generationSettings: StarSystemGenerationSettings): StarSystemGenerationSettingsInsert {
  return {
    id: randomUUID(),
    planetDensityNumericType: generationSettings.planetDensity.numericType,
    planetDensityMaxBoundType: generationSettings.planetDensity.maxBoundType,
    planetDensityMin: generationSettings.planetDensity.min,
    planetDensityMax: generationSettings.planetDensity.max,
    nbPlanetsNumericType: generationSettings.nbPlanets.numericType,
    nbPlanetsMaxBoundType: generationSettings.nbPlanets.maxBoundType,
    nbPlanetsMin: generationSettings.nbPlanets.min,
    nbPlanetsMax: generationSettings.nbPlanets.max,
    nbMoonsPerPlanetNumericType: generationSettings.nbMoonsPerPlanet.numericType,
    nbMoonsPerPlanetMaxBoundType: generationSettings.nbMoonsPerPlanet.maxBoundType,
    nbMoonsPerPlanetMin: generationSettings.nbMoonsPerPlanet.min,
    nbMoonsPerPlanetMax: generationSettings.nbMoonsPerPlanet.max,
    nbAsteroidBeltsNumericType: generationSettings.nbAsteroidBelts.numericType,
    nbAsteroidBeltsMaxBoundType: generationSettings.nbAsteroidBelts.maxBoundType,
    nbAsteroidBeltsMin: generationSettings.nbAsteroidBelts.min,
    nbAsteroidBeltsMax: generationSettings.nbAsteroidBelts.max,
    nbAsteroidsPerSectorNumericType: generationSettings.nbAsteroidsPerSector.numericType,
    nbAsteroidsPerSectorMaxBoundType: generationSettings.nbAsteroidsPerSector.maxBoundType,
    nbAsteroidsPerSectorMin: generationSettings.nbAsteroidsPerSector.min,
    nbAsteroidsPerSectorMax: generationSettings.nbAsteroidsPerSector.max,
    seed: generationSettings.seed,
  }
}

function toReadModel(row: StarSystemGenerationSettingsRow): StarSystemGenerationSettingsReadModel {
  return {
    id: row.id,
    planetDensity: toRange({
      numericType: row.planetDensityNumericType,
      maxBoundType: row.planetDensityMaxBoundType,
      min: row.planetDensityMin,
      max: row.planetDensityMax,
    }),
    nbPlanets: toRange({
      numericType: row.nbPlanetsNumericType,
      maxBoundType: row.nbPlanetsMaxBoundType,
      min: row.nbPlanetsMin,
      max: row.nbPlanetsMax,
    }),
    nbMoonsPerPlanet: toRange({
      numericType: row.nbMoonsPerPlanetNumericType,
      maxBoundType: row.nbMoonsPerPlanetMaxBoundType,
      min: row.nbMoonsPerPlanetMin,
      max: row.nbMoonsPerPlanetMax,
    }),
    nbAsteroidBelts: toRange({
      numericType: row.nbAsteroidBeltsNumericType,
      maxBoundType: row.nbAsteroidBeltsMaxBoundType,
      min: row.nbAsteroidBeltsMin,
      max: row.nbAsteroidBeltsMax,
    }),
    nbAsteroidsPerSector: toRange({
      numericType: row.nbAsteroidsPerSectorNumericType,
      maxBoundType: row.nbAsteroidsPerSectorMaxBoundType,
      min: row.nbAsteroidsPerSectorMin,
      max: row.nbAsteroidsPerSectorMax,
    }),
    seed: row.seed,
    createdAt: row.createdAt,
  }
}

function toRange(range: { numericType: string; maxBoundType: string; min: number; max: number }): RangeType {
  Assert.isOneOf(RANGE_NUMERIC_TYPES, range.numericType, "range.numericType")
  Assert.isOneOf(RANGE_MAX_BOUND_TYPES, range.maxBoundType, "range.maxBoundType")

  return Range.create({
    numericType: range.numericType,
    maxBoundType: range.maxBoundType,
    min: range.min,
    max: range.max,
  })
}
