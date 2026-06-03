import { describe, expect, it } from "vitest"
import { Assert, Logger, Range, Result } from "@guillaume-docquier/tools-ts"
import { createDbMock } from "#lib/db/createDb.mock.ts"
import { StarSystemGenerationSettingsRepository } from "#lib/db/star-systems/starSystemGenerationSettings.repository.ts"
import { createStarSystemGenerationSettingsStub } from "#lib/db/star-systems/StarSystemGenerationSettings.stub.ts"

describe("starSystemGenerationSettings.repository", () => {
  describe("create", () => {
    it("should create Star System generation settings", async () => {
      // Arrange
      const db = await createDbMock()
      const logger = Logger.get()
      const starSystemGenerationSettingsRepository = new StarSystemGenerationSettingsRepository({ db, logger })
      const generationSettings = createStarSystemGenerationSettingsStub({
        planetDensity: Range.create({ numericType: "float", maxBoundType: "inclusive", min: 0.25, max: 0.75 }),
        nbPlanets: Range.create({ numericType: "integer", maxBoundType: "exclusive", min: 4, max: 8 }),
      })

      // Act
      const createResult = await starSystemGenerationSettingsRepository.create(generationSettings)

      // Assert
      expect(createResult).toEqual(
        Result.Success({
          id: expect.any(String),
          createdAt: expect.any(Date),
          ...generationSettings,
        }),
      )
    })
  })

  describe("getById", () => {
    it("should get Star System generation settings by id", async () => {
      // Arrange
      const db = await createDbMock()
      const logger = Logger.get()
      const starSystemGenerationSettingsRepository = new StarSystemGenerationSettingsRepository({ db, logger })
      const createResult = await starSystemGenerationSettingsRepository.create(createStarSystemGenerationSettingsStub())
      Assert.isSuccess(createResult)

      // Act
      const getResult = await starSystemGenerationSettingsRepository.getById({ id: createResult.value.id })

      // Assert
      expect(getResult).toEqual(Result.Success(createResult.value))
    })
  })
})
