import { defineRailway, github, postgres, project, service, volume } from "railway/iac"

export default defineRailway(() => {
  const applicationSource = github("Guillaume-Docquier/text-based-browser-game-1", {
    branch: "main",
    checkSuites: true,
  })

  const database = postgres("Postgres", { region: "us-east4-eqdc4a" })
  database.networking = {
    privateNetworkEndpoint: "postgres",
    tcpProxies: { "5432": {} },
  }

  const databaseVolume = volume("postgres-volume", {
    alerts: { usage: { "80": {}, "95": {}, "100": {} } },
    allowOnlineResize: true,
    region: "us-east4-eqdc4a",
    sizeMB: 500,
  })

  const frontend = service("Frontend", {
    source: applicationSource,
    build: {
      builder: "RAILPACK",
      buildCommand: "pnpm --filter frontend build",
      watchPatterns: ["apps/frontend/**", "packages/shared/**", "package.json", "pnpm-workspace.yaml", "pnpm-lock.yaml"],
    },
    replicas: { "us-east4-eqdc4a": 1 },
    deploy: { sleepApplication: true },
    networking: { privateNetworkEndpoint: "frontend" },
  })

  const reverseProxy = service("Reverse Proxy", {
    source: github("railwayapp-templates/caddy-reverse-proxy", {
      branch: "main",
      commitSha: "74ca0b6430047002a20f6658a1a9ba63731fe573",
      upstreamUrl: "https://github.com/railwayapp-templates/caddy-reverse-proxy",
    }),
    build: { builder: "RAILPACK" },
    replicas: { "us-east4-eqdc4a": 1 },
    deploy: { sleepApplication: true },
    networking: { privateNetworkEndpoint: "caddy-proxy" },
  })

  const backend = service("Backend", {
    source: applicationSource,
    build: {
      builder: "RAILPACK",
      watchPatterns: ["apps/backend/**", "packages/shared/**", "package.json", "pnpm-workspace.yaml", "pnpm-lock.yaml"],
    },
    start: "pnpm --filter backend start",
    replicas: { "us-east4-eqdc4a": 1 },
    networking: { privateNetworkEndpoint: "backend" },
  })

  // Railway CLI supports this setting, though the SDK's project type does not yet declare it.
  const configuration = {
    variables: { managed: false },
    resources: [frontend, database, reverseProxy, backend, databaseVolume],
  }

  return project("cosmic-empires", configuration)
})
