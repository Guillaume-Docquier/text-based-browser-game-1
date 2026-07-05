import { request } from "node:http"

const DOCKER_SOCKET_PATH = "/var/run/docker.sock"
const POSTGRES_PORT = "5432/tcp"
const POSTGRES_IMAGE = "postgres:18"

type DockerContainerInspect = {
  NetworkSettings: {
    Ports: Record<string, Array<{ HostIp: string; HostPort: string }> | null>
  }
}

export class PostgresTestContainer {
  private containerId: string | undefined

  public async start(): Promise<string> {
    await dockerRequest({ method: "POST", path: `/images/create?fromImage=${encodeURIComponent(POSTGRES_IMAGE)}` })

    const createResponse = await dockerRequest<{ Id: string }>({
      method: "POST",
      path: "/containers/create",
      body: {
        Image: POSTGRES_IMAGE,
        Env: ["POSTGRES_DB=cosmic_empires_test", "POSTGRES_PASSWORD=postgres", "POSTGRES_USER=postgres"],
        ExposedPorts: { [POSTGRES_PORT]: {} },
        HostConfig: { PublishAllPorts: true },
      },
    })
    this.containerId = createResponse.Id

    await dockerRequest({ method: "POST", path: `/containers/${this.containerId}/start` })
    const hostPort = await this.waitForMappedPort()

    return `postgres://postgres:postgres@127.0.0.1:${hostPort}/cosmic_empires_test`
  }

  public async stop(): Promise<void> {
    if (this.containerId === undefined) {
      return
    }

    await dockerRequest({ method: "DELETE", path: `/containers/${this.containerId}?force=true&v=true` })
  }

  private async waitForMappedPort(): Promise<string> {
    for (let attempt = 0; attempt < 60; attempt += 1) {
      const inspect = await dockerRequest<DockerContainerInspect>({ method: "GET", path: `/containers/${this.containerId}/json` })
      const binding = inspect.NetworkSettings.Ports[POSTGRES_PORT]?.[0]
      if (binding !== undefined) {
        return binding.HostPort
      }

      await new Promise((resolve) => setTimeout(resolve, 250))
    }

    throw new Error("Postgres test container did not expose a port in time.")
  }
}

async function dockerRequest<TResponse = unknown>({
  method,
  path,
  body,
}: {
  method: string
  path: string
  body?: unknown
}): Promise<TResponse> {
  return new Promise((resolve, reject) => {
    const requestBody = body === undefined ? undefined : JSON.stringify(body)
    const req = request(
      {
        socketPath: DOCKER_SOCKET_PATH,
        path,
        method,
        headers:
          requestBody === undefined ? undefined : { "content-type": "application/json", "content-length": Buffer.byteLength(requestBody) },
      },
      (res) => {
        const chunks: Buffer[] = []
        res.on("data", (chunk: Buffer) => chunks.push(chunk))
        res.on("end", () => {
          const responseText = Buffer.concat(chunks).toString("utf8")
          if (res.statusCode !== undefined && res.statusCode >= 400) {
            reject(new Error(`Docker API request failed with ${res.statusCode}: ${responseText}`))
            return
          }

          resolve(responseText.length === 0 ? (undefined as TResponse) : (JSON.parse(responseText) as TResponse))
        })
      },
    )
    req.on("error", reject)
    if (requestBody !== undefined) {
      req.write(requestBody)
    }
    req.end()
  })
}
