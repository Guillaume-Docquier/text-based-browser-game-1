import { once } from "node:events"
import { describe, expect, it } from "vitest"
import { createApiStub } from "#api/createApi.stub.ts"
import { ApiServer } from "#testing/ApiServer.ts"
import { createIntegrationTestDb } from "#testing/createIntegrationTestDb.ts"

describe("createApi", () => {
  it("should cancel startup when closed before turn state updates are ready", async () => {
    // Arrange
    await using db = await createIntegrationTestDb()
    const { api } = createApiStub({
      db,
      listenForPostgresNotifications: async ({ signal }) => {
        await once(signal, "abort")
      },
    })

    // Act
    const listening = api.listen(0)
    await api.close()

    // Assert
    await expect(listening).rejects.toMatchObject({ name: "AbortError" })
  })

  it("should stop turn state updates when the HTTP port is already in use", async () => {
    // Arrange
    await using db = await createIntegrationTestDb()
    await using occupied = await ApiServer.create(createApiStub({ db }))
    let updatesStopped = false
    const { api } = createApiStub({
      db,
      listenForPostgresNotifications: async ({ onListening, signal }) => {
        onListening()
        await once(signal, "abort")
        updatesStopped = true
      },
    })

    // Act & Assert
    await expect(api.listen(occupied.port)).rejects.toMatchObject({ code: "EADDRINUSE" })
    expect(updatesStopped).toBe(true)
  })
})
