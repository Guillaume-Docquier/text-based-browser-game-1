import path from "node:path"
import type { Settings } from "eslint-plugin-boundaries"
import type { OxlintConfig } from "oxlint"
import { additivePolicies, element, extendWorkspaceRules, fileCategory, policy, WorkspaceBoundaries } from "../../linting/boundaries.ts"

const Elements = {
  DOMAIN: { type: "domain", pattern: "src/domain" },
  TESTING: { type: "testing", pattern: "src/testing" },
  GALAXY_CREATION: { type: "galaxy-creation", pattern: "src/galaxy-creation" },
  ACTION_SUBMISSION: { type: "action-submission", pattern: "src/action-submission" },
  TURN_RESOLUTION: { type: "turn-resolution", pattern: "src/turn-resolution" },
} as const
const TestFiles = { category: "stubs-and-tests", pattern: ["**/*.stub.ts", "**/*.test.ts"] } as const

export const Boundaries = {
  settings: {
    ...WorkspaceBoundaries.settings,
    "import/resolver": { typescript: { project: path.resolve(import.meta.dirname, "tsconfig.package.json") } },
    "boundaries/elements": Object.values(Elements).map((definition) => ({
      ...definition,
      pattern: `packages/shared/${definition.pattern}`,
      partialMatch: false,
    })),
    "boundaries/files": [
      ...WorkspaceBoundaries.settings["boundaries/files"],
      { ...TestFiles, pattern: [...TestFiles.pattern], basePattern: "packages/shared" },
    ],
  } satisfies Settings & Pick<NonNullable<OxlintConfig["settings"]>, "import/resolver">,
  rules: extendWorkspaceRules(
    additivePolicies([
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
  ),
}
