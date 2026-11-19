import type { RuleTester } from "oxlint/plugins-dev"

type OxlintRule = Parameters<RuleTester["run"]>[1]

const allowedComments = {
  meta: {
    schema: {
      type: "array",
      minItems: 1,
      maxItems: 1,
      items: [
        {
          type: "object",
          properties: {
            prefixes: { type: "array", items: { type: "string", minLength: 1 } },
            message: { type: "string", minLength: 1 },
          },
          required: ["prefixes", "message"],
          additionalProperties: false,
        },
      ],
    },
  },
  create(context): { Program: () => void } {
    const [options] = context.options
    if (typeof options !== "object" || options === null || Array.isArray(options)) {
      throw new TypeError("Expected an options object for allowed-comments.")
    }

    const { prefixes, message } = options
    if (!Array.isArray(prefixes) || !prefixes.every((prefix) => typeof prefix === "string") || typeof message !== "string") {
      throw new TypeError("Expected prefixes and a message for allowed-comments.")
    }

    return {
      Program(): void {
        for (const comment of context.sourceCode.getAllComments()) {
          const text = comment.value.trimStart()
          if (!prefixes.some((prefix) => text.startsWith(prefix))) {
            context.report({ loc: comment.loc, message })
          }
        }
      },
    }
  },
} satisfies OxlintRule

export default {
  meta: {
    name: "cosmic-empires",
  },
  rules: {
    "allowed-comments": allowedComments,
  },
}
