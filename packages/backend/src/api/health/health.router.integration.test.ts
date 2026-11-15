import { createServer } from "node:http"
import type { AddressInfo } from "node:net"
import { describe, expect } from "vitest"
import { createApiStub } from "#api/createApi.stub.ts"
import { integrationTest } from "#tests/vitest.integration.fixture.ts"

describe("health.router", () => {
  integrationTest("should return an empty successful health check", async ({ db }) => {
    // Arrange
    const { api } = await createApiStub({ db })
    await using server = createServer(api).listen()
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- I don't know when it's not actually an AddressInfo
    const address = server.address() as AddressInfo

    // Act
    const response = await fetch(`http://localhost:${address.port}/health`)

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
