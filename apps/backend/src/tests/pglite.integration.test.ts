import { AssertionError } from "node:assert"
import { AsyncLocalStorage } from "node:async_hooks"
import { PGlite } from "@electric-sql/pglite"
import { Assert, Result } from "@guillaume-docquier/tools-ts"
import { afterAll, beforeEach, describe, expect, it } from "vitest"
import { createApiStub } from "#api/createApi.stub.ts"
import { createDbMock } from "#lib/db/createDb.mock.ts"
import { getPGLiteInstanceWithSchemas, withPGLiteTemplate, withTestDatabases } from "#tests/pglite.ts"
import { createTurnProcessorStub } from "#turn-processing/TurnProcessor.stub.ts"

describe("PGlite resource ownership", () => {
  it("should close every clone after a successful test scope", async () => {
    // Arrange
    const databases: PGlite[] = []

    // Act
    await withTestDatabases(async () => {
      const db = await createDbMock()
      Assert.isTrue(db.$client instanceof PGlite)
      databases.push(db.$client, await getPGLiteInstanceWithSchemas())
      expect(databases.map((pg) => pg.closed)).toStrictEqual([false, false])
    })

    // Assert
    expect(databases.map((pg) => pg.closed)).toStrictEqual([true, true])
  })

  it("should close a pending allocation before its owning scope finishes", async () => {
    // Arrange
    const allocateWithoutWaiting = async (): Promise<{ database: ReturnType<typeof createDbMock> }> => ({ database: createDbMock() })

    // Act
    const { database } = await withTestDatabases(allocateWithoutWaiting)
    const db = await database

    // Assert
    Assert.isTrue(db.$client instanceof PGlite)
    expect(db.$client.closed).toBe(true)
  })

  it("should reject allocation from an already finished scope", async () => {
    // Arrange
    const resumeFinishedScope = await withTestDatabases(async () => AsyncLocalStorage.snapshot())

    // Act & Assert
    await expect(resumeFinishedScope(createDbMock)).rejects.toMatchObject({ name: "AssertionError" })
  })

  it("should preserve allocation errors without adding a teardown failure", async () => {
    // Arrange
    let resumeClosedTemplate: ReturnType<typeof AsyncLocalStorage.snapshot> | undefined
    await withPGLiteTemplate(async (template) => {
      await template.query("SELECT 1")
      resumeClosedTemplate = AsyncLocalStorage.snapshot()
    })
    Assert.isDefined(resumeClosedTemplate)

    // Act
    const result = await Result.tryCatch(resumeClosedTemplate(async () => await withTestDatabases(getPGLiteInstanceWithSchemas)))

    // Assert
    expect(result).toStrictEqual(Result.Failure(expect.objectContaining({ name: "Error", message: "PGlite is closed" })))
  })

  it("should keep concurrent tests' database owners separate", async () => {
    // Arrange
    const firstScope = withTestDatabases(async () => await getPGLiteInstanceWithSchemas())

    // Act
    const secondDatabase = await withTestDatabases(async () => {
      const pg = await getPGLiteInstanceWithSchemas()
      await firstScope
      expect(pg.closed).toBe(false)
      expect((await pg.query("SELECT 1 AS value")).rows).toStrictEqual([{ value: 1 }])
      return pg
    })

    // Assert
    expect((await firstScope).closed).toBe(true)
    expect(secondDatabase.closed).toBe(true)
  })

  it.each([
    { name: "assertion", failure: new AssertionError({ message: "intentional assertion failure" }) },
    { name: "setup", failure: new Error("intentional setup failure") },
  ])("should close clones after a $name failure and preserve the original error", async ({ failure }) => {
    // Arrange
    let database: PGlite | undefined

    // Act
    const result = await Result.tryCatch(
      withTestDatabases(async () => {
        database = await getPGLiteInstanceWithSchemas()
        throw failure
      }),
    )

    // Assert
    Assert.isDefined(database)
    Assert.isTrue(Result.isFailure(result))
    expect(result.error).toBe(failure)
    expect(database.closed).toBe(true)
  })

  it.each([
    { name: "API", createServices: createApiStub },
    { name: "TurnProcessor", createServices: createTurnProcessorStub },
  ])("should close databases allocated implicitly by $name", async ({ createServices }) => {
    // Arrange
    const services = await withTestDatabases(async () => {
      const stub = await createServices()
      expect(await stub.createTransaction(async () => "open")).toStrictEqual(Result.Success("open"))
      return stub
    })

    // Act
    const result = await services.createTransaction(async () => "closed")

    // Assert
    expect(result).toStrictEqual(Result.Failure(expect.objectContaining({ message: "PGlite is closed" })))
  })

  it("should let API and processor borrow one database until its owning scope finishes", async () => {
    // Arrange
    let client: PGlite | undefined

    // Act
    await withTestDatabases(async () => {
      const db = await createDbMock()
      Assert.isTrue(db.$client instanceof PGlite)
      client = db.$client
      const [api, processor] = await withTestDatabases(
        async () => await Promise.all([createApiStub({ db }), createTurnProcessorStub({ db })]),
      )
      expect(client.closed).toBe(false)
      expect(await api.createTransaction(async () => "API")).toStrictEqual(Result.Success("API"))
      expect(await processor.createTransaction(async () => "processor")).toStrictEqual(Result.Success("processor"))
    })

    // Assert
    Assert.isDefined(client)
    expect(client.closed).toBe(true)
  })

  it("should close the template after its suite finishes", async () => {
    // Arrange
    let template: PGlite | undefined

    // Act
    await withPGLiteTemplate(async (pg) => {
      template = pg
      await pg.query("SELECT 1")
    })

    // Assert
    Assert.isDefined(template)
    expect(template.closed).toBe(true)
  })

  it("should close the template after failed setup and preserve the original error", async () => {
    // Arrange
    let template: PGlite | undefined
    const setupFailure = new Error("intentional template setup failure")

    // Act
    const result = await Result.tryCatch(
      withPGLiteTemplate(async (pg) => {
        template = pg
        await pg.query("SELECT 1")
        throw setupFailure
      }),
    )

    // Assert
    Assert.isDefined(template)
    Assert.isTrue(Result.isFailure(result))
    expect(result.error).toBe(setupFailure)
    expect(template.closed).toBe(true)
  })

  describe.each(["assertion", "setup"])("failed %s", (failureStage) => {
    let database: PGlite | undefined
    const failureMessage = `intentional ${failureStage} failure`

    // oxlint-disable-next-line vitest/no-hooks -- This regression exercises cleanup after an actual beforeEach failure.
    beforeEach(async () => {
      // Arrange
      database = await getPGLiteInstanceWithSchemas()
      if (failureStage === "setup") {
        throw new Error(failureMessage)
      }
    })

    it.fails("should close the clone through integration fixture teardown", () => {
      // Act & Assert
      expect.fail(failureMessage)
    })

    afterAll(() => {
      // Assert: after the actual integration fixture has finished its teardown.
      Assert.isDefined(database)
      // oxlint-disable-next-line vitest/no-standalone-expect -- Teardown can only be checked after the fixture's aroundEach has returned.
      expect(database.closed).toBe(true)
    })
  })
})
