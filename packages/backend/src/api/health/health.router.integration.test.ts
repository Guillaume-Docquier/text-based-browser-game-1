import { describe, expect, it } from "vitest"
import { createApiStub } from "#api/createApi.stub.ts"
import { ApiServer } from "#testing/ApiServer.ts"
import { createIntegrationTestDb } from "#testing/createIntegrationTestDb.ts"

describe("health.router", () => {
  it("should return an empty successful health check", async () => {
    // Arrange
    await using db = await createIntegrationTestDb()
    await using server = await ApiServer.create(createApiStub({ db }))

    // Act
    const response = await fetch(`http://localhost:${server.port}/health`)

    // Assert
    expect({
      status: response.status,
      body: await response.text(),
    }).toStrictEqual({
      status: 200,
      body: "",
    })
  })
})
