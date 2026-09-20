import { createServer } from "node:http"
import type { AddressInfo } from "node:net"
import { describe, expect, it } from "vitest"
import { createApiStub } from "#api/createApi.stub.ts"

describe("compression middleware", () => {
  it("should return Brotli-compressed responses that preserve the body", async () => {
    // Arrange
    const { api } = await createApiStub()
    const responseBody = "Cosmic empires is a persistent turn-based space strategy game. ".repeat(64)
    api.get("/__test__/compression", (_request, response) => {
      response.type("text/plain").send(responseBody)
    })
    await using server = createServer(api).listen(0)
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- A listener on port 0 has an assigned TCP address.
    const address = server.address() as AddressInfo

    // Act
    const response = await fetch(`http://127.0.0.1:${address.port}/__test__/compression`, {
      headers: { "Accept-Encoding": "br" },
    })

    // Assert
    expect(response.headers.get("content-encoding")).toBe("br")
    expect(await response.text()).toBe(responseBody)
  })
})
