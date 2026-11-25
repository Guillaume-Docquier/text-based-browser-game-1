import { describe, expect, it } from "vitest"
import { FinishOnboardingError, FinishOnboardingErrorResponses } from "#api/accounts/finishOnboarding.error.ts"
import { createApiStub } from "#api/createApi.stub.ts"
import { ApiServer } from "#testing/ApiServer.ts"
import { createIntegrationTestDb } from "#testing/createIntegrationTestDb.ts"

describe("accounts.router", () => {
  describe("isOnboarded", () => {
    it("should reject anonymous accounts", async () => {
      // Arrange
      await using db = await createIntegrationTestDb()
      await using apiServer = await ApiServer.create(createApiStub({ db }))
      const anonymous = await apiServer.createClient({ authenticated: false })

      // Act
      const isOnboarded = anonymous.client.accounts.isOnboarded.query()

      // Assert
      await expect(isOnboarded).rejects.toMatchObject({ data: { code: "UNAUTHORIZED" } })
    })

    it("should return false for a new authenticated account", async () => {
      // Arrange
      await using db = await createIntegrationTestDb()
      await using apiServer = await ApiServer.create(createApiStub({ db }))
      const account = await apiServer.createClient({ authenticated: true })

      // Act
      const isOnboarded = account.client.accounts.isOnboarded.query()

      // Assert
      await expect(isOnboarded).resolves.toBe(false)
    })
  })

  describe("finishOnboarding", () => {
    it("should safely set a trimmed alias containing symbols and spaces", async () => {
      // Arrange
      await using db = await createIntegrationTestDb()
      await using apiServer = await ApiServer.create(createApiStub({ db }))
      const account = await apiServer.createClient({ authenticated: true })

      // Act
      await account.client.accounts.finishOnboarding.mutate({ alias: "  Nova'; DROP TABLE x; --  " })

      // Assert
      await expect(account.client.accounts.isOnboarded.query()).resolves.toBe(true)
    })

    it.each(["a", "a".repeat(36)])("should accept the boundary-length alias %j", async (alias) => {
      // Arrange
      await using db = await createIntegrationTestDb()
      await using apiServer = await ApiServer.create(createApiStub({ db }))
      const account = await apiServer.createClient({ authenticated: true })

      // Act
      const finishOnboarding = account.client.accounts.finishOnboarding.mutate({ alias })

      // Assert
      await expect(finishOnboarding).resolves.toBeUndefined()
    })

    it.each([" ", "a".repeat(37), "Null\0Alias"])("should reject the invalid alias %j", async (alias) => {
      // Arrange
      await using db = await createIntegrationTestDb()
      await using apiServer = await ApiServer.create(createApiStub({ db }))
      const account = await apiServer.createClient({ authenticated: true })

      // Act
      const finishOnboarding = account.client.accounts.finishOnboarding.mutate({ alias })

      // Assert
      await expect(finishOnboarding).rejects.toMatchObject({ data: { code: "BAD_REQUEST" } })
      await expect(account.client.accounts.isOnboarded.query()).resolves.toBe(false)
    })

    it("should reject an alias already used with different casing", async () => {
      // Arrange
      await using db = await createIntegrationTestDb()
      await using apiServer = await ApiServer.create(createApiStub({ db }))
      const firstAccount = await apiServer.createClient({ authenticated: true })
      const secondAccount = await apiServer.createClient({ authenticated: true })
      await firstAccount.client.accounts.finishOnboarding.mutate({ alias: "Nova" })

      // Act
      const finishOnboarding = secondAccount.client.accounts.finishOnboarding.mutate({ alias: "nOvA" })

      // Assert
      await expect(finishOnboarding).rejects.toMatchErrorResponse(FinishOnboardingErrorResponses[FinishOnboardingError.ALIAS_ALREADY_TAKEN])
      await expect(secondAccount.client.accounts.isOnboarded.query()).resolves.toBe(false)
    })

    it("should reject replacing an existing alias", async () => {
      // Arrange
      await using db = await createIntegrationTestDb()
      await using apiServer = await ApiServer.create(createApiStub({ db }))
      const account = await apiServer.createClient({ authenticated: true })
      await account.client.accounts.finishOnboarding.mutate({ alias: "Nova" })

      // Act
      const finishOnboarding = account.client.accounts.finishOnboarding.mutate({ alias: "Supernova" })

      // Assert
      await expect(finishOnboarding).rejects.toMatchErrorResponse(FinishOnboardingErrorResponses[FinishOnboardingError.ALREADY_ONBOARDED])
      await expect(account.client.accounts.isOnboarded.query()).resolves.toBe(true)
    })
  })
})
