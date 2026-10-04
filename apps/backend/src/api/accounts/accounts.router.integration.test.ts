import { describe, expect } from "vitest"
import { createApiStub } from "#api/createApi.stub.ts"
import { ApiServer } from "#tests/ApiServer.ts"
import { integrationTest } from "#tests/vitest.integration.fixture.ts"

describe("accounts.router", () => {
  describe("isOnboarded", () => {
    integrationTest("should reject anonymous accounts", async ({ db }) => {
      // Arrange
      await using apiServer = new ApiServer(await createApiStub({ db }))
      const anonymous = await apiServer.createClient({ authenticated: false })

      // Act
      const isOnboarded = anonymous.client.accounts.isOnboarded.query()

      // Assert
      await expect(isOnboarded).rejects.toMatchObject({ data: { code: "UNAUTHORIZED" } })
    })

    integrationTest("should return false for a new authenticated account", async ({ db }) => {
      // Arrange
      await using apiServer = new ApiServer(await createApiStub({ db }))
      const account = await apiServer.createClient({ authenticated: true })

      // Act
      const isOnboarded = account.client.accounts.isOnboarded.query()

      // Assert
      await expect(isOnboarded).resolves.toBe(false)
    })
  })

  describe("finishOnboarding", () => {
    integrationTest("should safely set a trimmed alias containing symbols and spaces", async ({ db }) => {
      // Arrange
      await using apiServer = new ApiServer(await createApiStub({ db }))
      const account = await apiServer.createClient({ authenticated: true })

      // Act
      await account.client.accounts.finishOnboarding.mutate({ alias: "  Nova'; DROP TABLE x; --  " })

      // Assert
      await expect(account.client.accounts.isOnboarded.query()).resolves.toBe(true)
    })

    integrationTest.for(["a", "a".repeat(36)])("should accept the boundary-length alias %j", async (alias, { db }) => {
      // Arrange
      await using apiServer = new ApiServer(await createApiStub({ db }))
      const account = await apiServer.createClient({ authenticated: true })

      // Act
      const finishOnboarding = account.client.accounts.finishOnboarding.mutate({ alias })

      // Assert
      await expect(finishOnboarding).resolves.toBeUndefined()
    })

    integrationTest.for([" ", "a".repeat(37), "Null\0Alias"])("should reject the invalid alias %j", async (alias, { db }) => {
      // Arrange
      await using apiServer = new ApiServer(await createApiStub({ db }))
      const account = await apiServer.createClient({ authenticated: true })

      // Act
      const finishOnboarding = account.client.accounts.finishOnboarding.mutate({ alias })

      // Assert
      await expect(finishOnboarding).rejects.toMatchObject({ data: { code: "BAD_REQUEST" } })
      await expect(account.client.accounts.isOnboarded.query()).resolves.toBe(false)
    })

    integrationTest("should reject an alias already used with different casing", async ({ db }) => {
      // Arrange
      await using apiServer = new ApiServer(await createApiStub({ db }))
      const firstAccount = await apiServer.createClient({ authenticated: true })
      const secondAccount = await apiServer.createClient({ authenticated: true })
      await firstAccount.client.accounts.finishOnboarding.mutate({ alias: "Nova" })

      // Act
      const finishOnboarding = secondAccount.client.accounts.finishOnboarding.mutate({ alias: "nOvA" })

      // Assert
      await expect(finishOnboarding).rejects.toMatchObject({ data: { code: "CONFLICT" } })
      await expect(secondAccount.client.accounts.isOnboarded.query()).resolves.toBe(false)
    })

    integrationTest("should reject replacing an existing alias", async ({ db }) => {
      // Arrange
      await using apiServer = new ApiServer(await createApiStub({ db }))
      const account = await apiServer.createClient({ authenticated: true })
      await account.client.accounts.finishOnboarding.mutate({ alias: "Nova" })

      // Act
      const finishOnboarding = account.client.accounts.finishOnboarding.mutate({ alias: "Supernova" })

      // Assert
      await expect(finishOnboarding).rejects.toMatchObject({ data: { code: "BAD_REQUEST" } })
      await expect(account.client.accounts.isOnboarded.query()).resolves.toBe(true)
    })
  })
})
