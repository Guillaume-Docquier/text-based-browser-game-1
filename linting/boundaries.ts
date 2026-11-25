import path from "node:path"
import type { DependenciesPolicy, Rules, Settings } from "eslint-plugin-boundaries"
import type { OxlintConfig } from "oxlint"

const Projects = {
  BACKEND: { category: "backend", pattern: "packages/backend/**" },
  FRONTEND: { category: "frontend", pattern: "packages/frontend/**" },
  SHARED: { category: "shared", pattern: "packages/shared/**" },
} as const

type Project = (typeof Projects)[keyof typeof Projects]
type Element = { readonly type: string }
type Policy = Required<Pick<DependenciesPolicy, "from" | "allow" | "disallow">>

const contractAlias = "@api-types"
const contractFile = "packages/backend/src/api/types.ts"
const root = path.resolve(import.meta.dirname, "..")

const policies = [
  {
    from: fileCategory(Projects.BACKEND),
    disallow: targets(Projects.FRONTEND),
    message: "The backend cannot depend on the frontend.",
  },
  {
    from: fileCategory(Projects.SHARED),
    disallow: [...targets(Projects.BACKEND), ...targets(Projects.FRONTEND)],
    message: "The shared package cannot depend on either app.",
  },
  {
    from: [fileCategory(Projects.BACKEND), fileCategory(Projects.SHARED)],
    disallow: { dependency: { source: contractAlias } },
    message: "The @api-types alias is reserved for the frontend.",
  },
  {
    from: fileCategory(Projects.FRONTEND),
    disallow: [...targets(Projects.BACKEND), { dependency: { source: contractAlias } }],
    message: 'Use import type { ... } from "@api-types" to import named backend contracts.',
  },
  {
    from: fileCategory(Projects.FRONTEND),
    allow: {
      to: filePath(contractFile),
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

export function fileCategory({ category }: { readonly category: string }): { file: { categories: string } } {
  return { file: { categories: category } }
}

export function filePath(path: string): { file: { path: string } } {
  return { file: { path } }
}

export function element({ type }: Element): { element: { type: string } } {
  return { element: { type } }
}

export function policy({ from, onlyAllow }: { from: NonNullable<DependenciesPolicy["from"]>; onlyAllow: readonly Element[] }): Policy {
  return { from, disallow: { to: { module: { origin: "local" } } }, allow: { to: onlyAllow.map(element) } }
}

export function additivePolicies(policies: readonly Policy[]): DependenciesPolicy[] {
  return [...policies.map(({ from, disallow }) => ({ from, disallow })), ...policies.map(({ from, allow }) => ({ from, allow }))]
}

export function extendWorkspaceRules(packagePolicies: readonly DependenciesPolicy[]): Pick<Rules, "boundaries/dependencies"> {
  const [severity, workspaceDependencies] = WorkspaceBoundaries.rules["boundaries/dependencies"]
  return {
    "boundaries/dependencies": [severity, { ...workspaceDependencies, policies: [...packagePolicies, ...workspaceDependencies.policies] }],
  }
}

function targets(definition: Project): [{ to: ReturnType<typeof fileCategory> }, { dependency: { source: string[] } }] {
  const { category } = definition
  return [{ to: fileCategory(definition) }, { dependency: { source: [category, `${category}/**`] } }]
}
