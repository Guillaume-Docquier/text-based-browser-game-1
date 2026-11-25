import { createGameConfigurationStub } from "shared/domain/games/GameConfiguration.stub.ts"
import { describe, expect, it } from "vitest"
import { AUTH_ID_HEADER } from "#api/auth/TestHeaderAuthProvider.ts"
import { createApiStub } from "#api/createApi.stub.ts"
import { ApiServer } from "#testing/ApiServer.ts"
import { createIntegrationTestDb } from "#testing/createIntegrationTestDb.ts"

describe("compression middleware", () => {
  it("should return Brotli-compressed responses that preserve the body", async () => {
    // Arrange
    await using db = await createIntegrationTestDb()
    await using server = await ApiServer.create(createApiStub({ db }))
    const { client, account } = await server.createClient({ authenticated: true })
    const { createdGameId: gameId } = await client.games.create.mutate({
      configuration: createGameConfigurationStub(),
    })
    await client.games.startGame.mutate({ gameId })
    const url = new URL(`http://localhost:${server.port}/trpc/gameplay.getPlayerView`)
    url.searchParams.set("input", JSON.stringify({ gameId }))

    // Act
    const headers = { [AUTH_ID_HEADER]: account.authId }
    const uncompressed = await fetch(url, { headers: { ...headers, "Accept-Encoding": "identity" } })
    const compressed = await fetch(url, { headers: { ...headers, "Accept-Encoding": "br" } })

    // Assert
    expect(uncompressed.status).toBe(200)
    expect(compressed.status).toBe(200)
    expect(compressed.headers.get("content-encoding")).toBe("br")
    expect(await compressed.text()).toBe(await uncompressed.text())
  })
})
