import path from "node:path"
import type { DependenciesPolicy, Rules, Settings } from "eslint-plugin-boundaries"
import type { OxlintConfig } from "oxlint"

const Projects = {
  BACKEND: { category: "backend", pattern: "packages/backend/**" },
  FRONTEND: { category: "frontend", pattern: "packages/frontend/**" },
  SHARED: { category: "shared", pattern: "packages/shared/**" },
} as const

type Project = (typeof Projects)[keyof typeof Projects]
type ProjectSelector = { file: { categories: Project["category"] } }

const contractAlias = "@api-types"
const contractFile = "packages/backend/src/api/types.ts"
const root = path.resolve(import.meta.dirname, "..")

const policies = [
  {
    from: project(Projects.BACKEND),
    disallow: targets(Projects.FRONTEND),
    message: "The backend cannot depend on the frontend.",
  },
  {
    from: project(Projects.SHARED),
    disallow: [...targets(Projects.BACKEND), ...targets(Projects.FRONTEND)],
    message: "The shared package cannot depend on either app.",
  },
  {
    from: [project(Projects.BACKEND), project(Projects.SHARED)],
    disallow: { dependency: { source: contractAlias } },
    message: "The @api-types alias is reserved for the frontend.",
  },
  {
    from: project(Projects.FRONTEND),
    disallow: [...targets(Projects.BACKEND), { dependency: { source: contractAlias } }],
    message: 'Use import type { ... } from "@api-types" to import named backend contracts.',
  },
  {
    from: project(Projects.FRONTEND),
    allow: {
      to: { file: { path: contractFile } },
      dependency: { source: contractAlias, kind: "type", nodeKind: "import", specifiers: "*" },
    },
  },
] satisfies DependenciesPolicy[]

export const WorkspaceBoundaries = {
  settings: {
    "boundaries/root-path": root,
    "boundaries/flag-as-external": { unresolvableAlias: false, inNodeModules: true },
    "boundaries/files": Object.values(Projects),
    "import/resolver": { typescript: { project: path.join(root, "packages/frontend/tsconfig.app.json") } },
  } satisfies Settings & Pick<NonNullable<OxlintConfig["settings"]>, "import/resolver">,
  rules: {
    "boundaries/dependencies": [
      "error",
      {
        default: "allow",
        checkAllOrigins: true,
        checkUnknownLocals: true,
        checkInternals: true,
        policies,
      },
    ],
  } satisfies Pick<Rules, "boundaries/dependencies">,
}

function project({ category }: Project): ProjectSelector {
  return { file: { categories: category } }
}

function targets(definition: Project): [{ to: ProjectSelector }, { dependency: { source: string[] } }] {
  const { category } = definition
  return [{ to: project(definition) }, { dependency: { source: [category, `${category}/**`] } }]
}
