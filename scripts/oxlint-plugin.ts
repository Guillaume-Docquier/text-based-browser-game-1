import { ESM, READ, ReferenceTracker } from "@eslint-community/eslint-utils"
import type { Rule } from "eslint"

const testApi = { extend: { [READ]: true } }
const fixtureAccess = { vitest: { [ESM]: true, test: testApi, it: testApi } }

export default {
  meta: { name: "project" },
  rules: {
    "no-vitest-fixtures": {
      createOnce(context: Rule.RuleContext): Rule.RuleListener {
        return {
          Program(program) {
            if (!program.body.some((node) => node.type === "ImportDeclaration" && node.source.value === "vitest")) {
              return
            }
            const tracker = new ReferenceTracker(context.sourceCode.getScope(program))
            for (const { node } of tracker.iterateEsmReferences(fixtureAccess)) {
              context.report({ node, message: "Use native Vitest tests and explicit resource helpers (ADR-035)." })
            }
          },
        }
      },
    },
  },
}
