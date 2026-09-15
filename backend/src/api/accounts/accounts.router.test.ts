import { describe, expect, it } from "vitest"
import { createApiStub } from "#api/createApi.stub.ts"
import { ApiServer } from "#tests/ApiServer.ts"

describe("accounts.router", () => {
  describe("getCurrent", () => {
    it("should reject anonymous accounts", async () => {
      // Arrange
      using apiServer = new ApiServer(await createApiStub())
      const anonymous = await apiServer.createClient({ authenticated: false })

      // Act & Assert
      await expect(anonymous.client.accounts.getCurrent.query()).rejects.toMatchObject({ data: { code: "UNAUTHORIZED" } })
    })

    it("should return the authenticated account", async () => {
      // Arrange
      using apiServer = new ApiServer(await createApiStub())
      const account = await apiServer.createClient({ authenticated: true })

      // Act
      const currentAccount = await account.client.accounts.getCurrent.query()

      // Assert
      expect(currentAccount).toStrictEqual<typeof currentAccount>({ alias: null })
    })
  })

  describe("setAlias", () => {
    it("should safely set a trimmed alias containing symbols and spaces", async () => {
      // Arrange
      using apiServer = new ApiServer(await createApiStub())
      const account = await apiServer.createClient({ authenticated: true })

      // Act
      const updatedAccount = await account.client.accounts.setAlias.mutate({ alias: "  Nova'; DROP TABLE x; --  " })

      // Assert
      expect(updatedAccount).toStrictEqual<typeof updatedAccount>({ alias: "Nova'; DROP TABLE x; --" })
      await expect(account.client.accounts.getCurrent.query()).resolves.toStrictEqual({ alias: "Nova'; DROP TABLE x; --" })
    })

    it.each(["a", "a".repeat(32)])("should accept the boundary-length alias %j", async (alias) => {
      // Arrange
      using apiServer = new ApiServer(await createApiStub())
      const account = await apiServer.createClient({ authenticated: true })

      // Act & Assert
      await expect(account.client.accounts.setAlias.mutate({ alias })).resolves.toStrictEqual({ alias })
    })

    it.each([" ", "a".repeat(33), "Null\0Alias"])("should reject the invalid alias %j", async (alias) => {
      // Arrange
      using apiServer = new ApiServer(await createApiStub())
      const account = await apiServer.createClient({ authenticated: true })

      // Act & Assert
      await expect(account.client.accounts.setAlias.mutate({ alias })).rejects.toMatchObject({ data: { code: "BAD_REQUEST" } })
      await expect(account.client.accounts.getCurrent.query()).resolves.toStrictEqual({ alias: null })
    })

    it("should reject an alias already used with different casing", async () => {
      // Arrange
      using apiServer = new ApiServer(await createApiStub())
      const firstAccount = await apiServer.createClient({ authenticated: true })
      const secondAccount = await apiServer.createClient({ authenticated: true })
      await firstAccount.client.accounts.setAlias.mutate({ alias: "Nova" })

      // Act & Assert
      await expect(secondAccount.client.accounts.setAlias.mutate({ alias: "nOvA" })).rejects.toMatchObject({
        data: { code: "CONFLICT" },
      })
      await expect(secondAccount.client.accounts.getCurrent.query()).resolves.toStrictEqual({ alias: null })
    })

    it("should reject replacing an existing alias", async () => {
      // Arrange
      using apiServer = new ApiServer(await createApiStub())
      const account = await apiServer.createClient({ authenticated: true })
      await account.client.accounts.setAlias.mutate({ alias: "Nova" })

      // Act & Assert
      await expect(account.client.accounts.setAlias.mutate({ alias: "Supernova" })).rejects.toMatchObject({
        data: { code: "BAD_REQUEST" },
      })
      await expect(account.client.accounts.getCurrent.query()).resolves.toStrictEqual({ alias: "Nova" })
    })
  })
})
