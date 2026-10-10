import path from "node:path"
import type { DependenciesPolicy, Rules, Settings } from "eslint-plugin-boundaries"
import type { OxlintConfig } from "oxlint"

type Element = (typeof Elements)[keyof typeof Elements]
type Policy = Required<Pick<DependenciesPolicy, "from" | "allow" | "disallow">>
const Elements = {
  DOMAIN: { type: "domain", pattern: "src/domain" },
  TESTING: { type: "testing", pattern: "src/testing" },
  GALAXY_CREATION: { type: "galaxy-creation", pattern: "src/galaxy-creation" },
  ACTION_SUBMISSION: { type: "action-submission", pattern: "src/action-submission" },
  TURN_RESOLUTION: { type: "turn-resolution", pattern: "src/turn-resolution" },
} as const
const TestFiles = { category: "stubs-and-tests", pattern: ["**/*.stub.ts", "**/*.test.ts"] } as const

/**
 * Boundaries settings and rules.
 */
export const Boundaries = {
  settings: {
    "boundaries/root-path": import.meta.dirname,
    "boundaries/flag-as-external": { unresolvableAlias: false, inNodeModules: true },
    "import/resolver": { typescript: { project: path.resolve(import.meta.dirname, "tsconfig.package.json") } },
    "boundaries/elements": Object.values(Elements).map((definition) => ({ ...definition, partialMatch: false })),
    "boundaries/files": [{ ...TestFiles, pattern: [...TestFiles.pattern] }],
  } satisfies Settings & Pick<NonNullable<OxlintConfig["settings"]>, "import/resolver">,
  rules: {
    "boundaries/dependencies": [
      "error",
      {
        default: "allow",
        checkAllOrigins: false,
        checkUnknownLocals: true,
        checkInternals: true,
        policies: additivePolicies([
          policy({ from: fileCategory(TestFiles), onlyAllow: [Elements.TESTING] }),
          policy({ from: element(Elements.DOMAIN), onlyAllow: [Elements.DOMAIN] }),
          policy({ from: element(Elements.TESTING), onlyAllow: [Elements.TESTING, Elements.DOMAIN] }),
          policy({ from: element(Elements.GALAXY_CREATION), onlyAllow: [Elements.GALAXY_CREATION, Elements.DOMAIN] }),
          policy({
            from: element(Elements.ACTION_SUBMISSION),
            onlyAllow: [Elements.ACTION_SUBMISSION, Elements.TURN_RESOLUTION, Elements.DOMAIN],
          }),
          policy({
            from: element(Elements.TURN_RESOLUTION),
            onlyAllow: [Elements.TURN_RESOLUTION, Elements.ACTION_SUBMISSION, Elements.DOMAIN],
          }),
        ]),
      },
    ],
  } satisfies Pick<Rules, "boundaries/dependencies">,
}

function element(definition: Element): { element: { type: Element["type"] } } {
  return { element: { type: definition.type } }
}

function fileCategory(definition: { readonly category: string }): NonNullable<DependenciesPolicy["from"]> {
  return { file: { categories: definition.category } }
}

/**
 * Restrict local imports to these elements. Matching policies contribute additive permissions.
 */
function policy({ from, onlyAllow }: { from: NonNullable<DependenciesPolicy["from"]>; onlyAllow: readonly Element[] }): Policy {
  return { from, disallow: { to: { module: { origin: "local" } } }, allow: { to: onlyAllow.map(element) } }
}

/**
 * Evaluate all local denials before all allowances so overlapping policies add permissions.
 */
function additivePolicies(policies: readonly Policy[]): DependenciesPolicy[] {
  return [...policies.map(({ from, disallow }) => ({ from, disallow })), ...policies.map(({ from, allow }) => ({ from, allow }))]
}
