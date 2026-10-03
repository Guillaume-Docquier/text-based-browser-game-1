import { createServer } from "node:http"
import type { AddressInfo } from "node:net"
import { describe, expect, it } from "vitest"
import { createApiStub } from "#api/createApi.stub.ts"

describe("health.router", () => {
  it("should return an empty successful health check", async () => {
    // Arrange
    const { api } = await createApiStub()
    await using server = createServer(api).listen(0)
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- I don't know when it's not actually an AddressInfo
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
