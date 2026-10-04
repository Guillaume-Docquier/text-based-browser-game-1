import { once } from "node:events"
import { createServer } from "node:http"
import type { AddressInfo } from "node:net"
import { describe, expect } from "vitest"
import { createApiStub } from "#api/createApi.stub.ts"
import { integrationTest } from "#tests/vitest.integration.fixture.ts"

describe("health.router", () => {
  integrationTest("should return an empty successful health check", async ({ db }) => {
    // Arrange
    const { api } = await createApiStub({ db })
    await using server = createServer(api).listen(0, "127.0.0.1")
    await once(server, "listening")
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- SAFETY: The listening TCP server has an assigned address.
    const address = server.address() as AddressInfo

    // Act
    const response = await fetch(`http://127.0.0.1:${address.port}/health`)

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
