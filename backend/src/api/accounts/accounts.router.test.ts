import { describe, expect, it } from "vitest"
import { createApiStub } from "#api/createApi.stub.ts"
import { ApiServer } from "#tests/ApiServer.ts"

describe("accounts.router", () => {
  describe("isOnboarded", () => {
    it("should reject anonymous accounts", async () => {
      // Arrange
      using apiServer = new ApiServer(await createApiStub())
      const anonymous = await apiServer.createClient({ authenticated: false })

      // Act & Assert
      await expect(anonymous.client.accounts.isOnboarded.query()).rejects.toMatchObject({ data: { code: "UNAUTHORIZED" } })
    })

    it("should return false for a new authenticated account", async () => {
      // Arrange
      using apiServer = new ApiServer(await createApiStub())
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
      using apiServer = new ApiServer(await createApiStub())
      const account = await apiServer.createClient({ authenticated: true })

      // Act
      await account.client.accounts.finishOnboarding.mutate({ alias: "  Nova'; DROP TABLE x; --  " })

      // Assert
      await expect(account.client.accounts.isOnboarded.query()).resolves.toBe(true)
    })

    it.each(["a", "a".repeat(36)])("should accept the boundary-length alias %j", async (alias) => {
      // Arrange
      using apiServer = new ApiServer(await createApiStub())
      const account = await apiServer.createClient({ authenticated: true })

      // Act & Assert
      await expect(account.client.accounts.finishOnboarding.mutate({ alias })).resolves.toBeUndefined()
    })

    it.each([" ", "a".repeat(37), "Null\0Alias"])("should reject the invalid alias %j", async (alias) => {
      // Arrange
      using apiServer = new ApiServer(await createApiStub())
      const account = await apiServer.createClient({ authenticated: true })

      // Act & Assert
      await expect(account.client.accounts.finishOnboarding.mutate({ alias })).rejects.toMatchObject({ data: { code: "BAD_REQUEST" } })
      await expect(account.client.accounts.isOnboarded.query()).resolves.toBe(false)
    })

    it("should reject an alias already used with different casing", async () => {
      // Arrange
      using apiServer = new ApiServer(await createApiStub())
      const firstAccount = await apiServer.createClient({ authenticated: true })
      const secondAccount = await apiServer.createClient({ authenticated: true })
      await firstAccount.client.accounts.finishOnboarding.mutate({ alias: "Nova" })

      // Act & Assert
      await expect(secondAccount.client.accounts.finishOnboarding.mutate({ alias: "nOvA" })).rejects.toMatchObject({
        data: { code: "CONFLICT" },
      })
      await expect(secondAccount.client.accounts.isOnboarded.query()).resolves.toBe(false)
    })

    it("should reject replacing an existing alias", async () => {
      // Arrange
      using apiServer = new ApiServer(await createApiStub())
      const account = await apiServer.createClient({ authenticated: true })
      await account.client.accounts.finishOnboarding.mutate({ alias: "Nova" })

      // Act & Assert
      await expect(account.client.accounts.finishOnboarding.mutate({ alias: "Supernova" })).rejects.toMatchObject({
        data: { code: "BAD_REQUEST" },
      })
      await expect(account.client.accounts.isOnboarded.query()).resolves.toBe(true)
    })
  })
})
