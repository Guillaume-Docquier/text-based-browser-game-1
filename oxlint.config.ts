import { defineConfig } from "oxlint"

export default defineConfig({
  plugins: [],
  categories: {
    correctness: "error",
    suspicious: "error",
  },
  options: {
    typeAware: true,
    reportUnusedDisableDirectives: "deny",
  },
  env: {
    builtin: true,
  },
  ignorePatterns: ["**/dist/**", "**/coverage/**", "*.gen.*"],
  overrides: [
    {
      files: ["**/*.ts", "**/*.tsx", "**/*.mts", "**/*.cts"],
      rules: {
        "consistent-return": "off", // noImplicitReturns does this for you
        "import/no-unassigned-import": [
          "error",
          {
            allow: ["**/*.css"],
          },
        ],
        "no-throw-literal": "off", // only-throw-error covers this
        "accessor-pairs": [
          "error",
          {
            enforceForClassMembers: true,
            getWithoutSet: false,
            setWithoutGet: true,
          },
        ],
        "array-callback-return": [
          "error",
          {
            allowImplicit: false,
            allowVoid: false,
            checkForEach: false,
          },
        ],
        "constructor-super": ["error"],
        "default-case-last": ["error"],
        eqeqeq: ["error", "always"],
        "import/first": ["error"],
        "import/no-absolute-path": [
          "error",
          {
            amd: false,
            commonjs: true,
            esmodule: true,
          },
        ],
        "import/no-duplicates": ["error"],
        "import/no-named-default": ["error"],
        "import/no-webpack-loader-syntax": ["error"],
        "new-cap": [
          "error",
          {
            capIsNew: false,
            newIsCap: true,
            properties: true,
          },
        ],
        "no-async-promise-executor": ["error"],
        "no-caller": ["error"],
        "no-case-declarations": ["error"],
        "no-class-assign": ["error"],
        "no-compare-neg-zero": ["error"],
        "no-cond-assign": ["error"],
        "no-console": ["error"],
        "no-const-assign": ["error"],
        "no-constant-condition": [
          "error",
          {
            checkLoops: false,
          },
        ],
        "no-control-regex": ["error"],
        "no-debugger": ["error"],
        "no-delete-var": ["error"],
        "no-dupe-keys": ["error"],
        "no-duplicate-case": ["error"],
        "no-empty": [
          "error",
          {
            allowEmptyCatch: true,
          },
        ],
        "no-empty-character-class": ["error"],
        "no-empty-pattern": ["error"],
        "no-eval": ["error"],
        "no-ex-assign": ["error"],
        "no-extend-native": ["error"],
        "no-extra-bind": ["error"],
        "no-extra-boolean-cast": ["error"],
        "no-fallthrough": ["error"],
        "no-func-assign": ["error"],
        "no-global-assign": ["error"],
        "no-import-assign": ["error"],
        "no-invalid-regexp": ["error"],
        "no-irregular-whitespace": ["error"],
        "no-iterator": ["error"],
        "no-labels": [
          "error",
          {
            allowLoop: false,
            allowSwitch: false,
          },
        ],
        "no-lone-blocks": ["error"],
        "no-misleading-character-class": ["error"],
        "no-multi-str": ["error"],
        "no-new": ["error"],
        "no-new-func": ["error"],
        "no-new-wrappers": ["error"],
        "no-obj-calls": ["error"],
        "no-proto": ["error"],
        "no-prototype-builtins": ["error"],
        "no-regex-spaces": ["error"],
        "no-return-assign": ["error", "except-parens"],
        "no-self-assign": [
          "error",
          {
            props: true,
          },
        ],
        "no-self-compare": ["error"],
        "no-sequences": ["error"],
        "no-shadow-restricted-names": ["error"],
        "no-sparse-arrays": ["error"],
        "no-template-curly-in-string": ["error"],
        "no-this-before-super": ["error"],
        "no-unmodified-loop-condition": ["error"],
        "no-unneeded-ternary": [
          "error",
          {
            defaultAssignment: false,
          },
        ],
        "no-unreachable": ["error"],
        "no-unsafe-finally": ["error"],
        "no-unsafe-negation": ["error"],
        "no-useless-backreference": ["error"],
        "no-useless-call": ["error"],
        "no-useless-catch": ["error"],
        "no-useless-computed-key": ["error"],
        "no-useless-escape": ["error"],
        "no-useless-rename": ["error"],
        "no-var": ["error"],
        "no-void": [
          "error",
          {
            allowAsStatement: true,
          },
        ],
        "no-warning-comments": "error",
        "no-with": ["error"],
        "object-shorthand": ["error", "properties"],
        "prefer-const": [
          "error",
          {
            destructuring: "all",
            ignoreReadBeforeAssign: false,
          },
        ],
        "prefer-promise-reject-errors": ["error"],
        "prefer-regex-literals": [
          "error",
          {
            disallowRedundantWrapping: true,
          },
        ],
        "promise/param-names": ["error"],
        "symbol-description": ["error"],
        "unicode-bom": ["error", "never"],
        "use-isnan": [
          "error",
          {
            enforceForIndexOf: true,
            enforceForSwitchCase: true,
          },
        ],
        "valid-typeof": [
          "error",
          {
            requireStringLiterals: true,
          },
        ],
        yoda: ["error", "never"],
        "no-array-constructor": ["error"],
        "no-dupe-class-members": ["error"],
        "no-loss-of-precision": ["error"],
        "no-unused-expressions": [
          "error",
          {
            allowShortCircuit: true,
            allowTaggedTemplates: true,
            allowTernary: true,
            enforceForJSX: false,
          },
        ],
        "no-unused-vars": [
          "error",
          {
            varsIgnorePattern: "^_",
            argsIgnorePattern: "^_",
          },
        ],
        "no-use-before-define": [
          "error",
          {
            classes: false,
            enums: false,
            functions: false,
            typedefs: false,
            variables: false,
          },
        ],
        "no-useless-constructor": ["error"],
        "node/handle-callback-err": ["error", "^(err|error)$"],
        "node/no-exports-assign": ["error"],
        "node/no-new-require": ["error"],
        "node/no-path-concat": ["error"],
        "typescript/adjacent-overload-signatures": ["error"],
        "typescript/array-type": [
          "error",
          {
            default: "array-simple",
          },
        ],
        "typescript/await-thenable": ["error"],
        "typescript/ban-ts-comment": [
          "error",
          {
            minimumDescriptionLength: 3,
            "ts-check": false,
            "ts-expect-error": "allow-with-description",
            "ts-ignore": true,
            "ts-nocheck": true,
          },
        ],
        "typescript/ban-tslint-comment": ["error"],
        "typescript/no-empty-object-type": "error",
        "typescript/no-unsafe-function-type": "error",
        "typescript/no-wrapper-object-types": "error",
        "typescript/class-literal-property-style": ["error", "fields"],
        "typescript/consistent-generic-constructors": ["error", "constructor"],
        "typescript/consistent-indexed-object-style": ["error", "record"],
        "typescript/consistent-type-assertions": [
          "error",
          {
            assertionStyle: "as",
            objectLiteralTypeAssertions: "never",
          },
        ],
        "typescript/consistent-type-exports": [
          "error",
          {
            fixMixedExportsWithInlineTypeSpecifier: true,
          },
        ],
        "typescript/consistent-type-imports": [
          "error",
          {
            disallowTypeAnnotations: true,
            fixStyle: "inline-type-imports",
            prefer: "type-imports",
          },
        ],
        "typescript/dot-notation": [
          "error",
          {
            allowIndexSignaturePropertyAccess: false,
            allowKeywords: true,
            allowPattern: "",
            allowPrivateClassPropertyAccess: false,
            allowProtectedClassPropertyAccess: false,
          },
        ],
        "typescript/explicit-function-return-type": [
          "error",
          {
            allowDirectConstAssertionInArrowFunctions: true,
            allowHigherOrderFunctions: true,
            allowTypedFunctionExpressions: true,
          },
        ],
        "typescript/method-signature-style": ["error"],
        "typescript/no-base-to-string": ["error"],
        "typescript/no-confusing-void-expression": [
          "error",
          {
            ignoreArrowShorthand: false,
            ignoreVoidOperator: false,
          },
        ],
        "typescript/no-dynamic-delete": ["error"],
        "typescript/no-empty-interface": [
          "error",
          {
            allowSingleExtends: true,
          },
        ],
        "typescript/no-explicit-any": ["error"],
        "typescript/no-extra-non-null-assertion": ["error"],
        "typescript/no-extraneous-class": [
          "error",
          {
            allowWithDecorator: true,
          },
        ],
        "typescript/no-floating-promises": ["error"],
        "typescript/no-for-in-array": ["error"],
        "typescript/no-implied-eval": ["error"],
        "typescript/no-invalid-void-type": [
          "error",
          {
            allowAsThisParameter: true,
          },
        ],
        "typescript/explicit-member-accessibility": ["error"],
        "typescript/no-misused-new": ["error"],
        "typescript/no-misused-promises": ["error"],
        "typescript/no-namespace": ["error"],
        "typescript/no-non-null-asserted-optional-chain": ["error"],
        "typescript/no-non-null-assertion": ["error"],
        "typescript/no-this-alias": [
          "error",
          {
            allowDestructuring: true,
          },
        ],
        "typescript/only-throw-error": ["error"],
        "typescript/no-unnecessary-boolean-literal-compare": ["error"],
        "typescript/no-unnecessary-type-assertion": ["error"],
        "typescript/no-unnecessary-type-constraint": ["error"],
        "typescript/no-unsafe-argument": ["error"],
        "typescript/no-var-requires": ["error"],
        "typescript/non-nullable-type-assertion-style": ["error"],
        "typescript/prefer-function-type": ["error"],
        "typescript/prefer-includes": ["error"],
        "typescript/prefer-nullish-coalescing": [
          "error",
          {
            ignoreConditionalTests: false,
            ignoreMixedLogicalExpressions: false,
          },
        ],
        "typescript/prefer-readonly": ["error"],
        "typescript/prefer-reduce-type-parameter": ["error"],
        "typescript/prefer-return-this-type": ["error"],
        "typescript/prefer-ts-expect-error": ["error"],
        "typescript/promise-function-async": ["error"],
        "typescript/require-array-sort-compare": [
          "error",
          {
            ignoreStringArrays: true,
          },
        ],
        "typescript/restrict-plus-operands": [
          "error",
          {
            skipCompoundAssignments: false,
          },
        ],
        "typescript/restrict-template-expressions": [
          "error",
          {
            allowNumber: true,
          },
        ],
        "typescript/return-await": ["error", "always"],
        "typescript/strict-boolean-expressions": [
          "error",
          {
            allowAny: false,
            allowNullableBoolean: false,
            allowNullableNumber: false,
            allowNullableObject: false,
            allowNullableString: false,
            allowNumber: false,
            allowString: false,
          },
        ],
        "typescript/triple-slash-reference": [
          "error",
          {
            lib: "never",
            path: "never",
            types: "never",
          },
        ],
        "typescript/unbound-method": [
          "error",
          {
            ignoreStatic: false,
          },
        ],
      },
      plugins: ["typescript", "import", "node", "promise"],
    },
    {
      files: ["backend/**/*"],
      env: {
        node: true,
      },
    },
    {
      files: ["backend/src/**/*.ts"],
      excludeFiles: ["backend/src/**/*.test.ts"],
      rules: {
        "no-restricted-globals": [
          "error",
          {
            name: "Date",
            message: "Use an injected clock instead.",
          },
        ],
      },
    },
    {
      files: ["backend/scripts/**/*"],
      rules: {
        "no-console": "off",
      },
    },
    {
      files: ["frontend/**/*.{ts,tsx}"],
      excludeFiles: ["frontend/playwright/**/*"],
      rules: {
        "react/display-name": "error",
        "react/jsx-key": "error",
        "react/jsx-no-comment-textnodes": "error",
        "react/jsx-no-duplicate-props": "error",
        "react/jsx-no-target-blank": "error",
        "react/jsx-no-undef": "error",
        "react/no-children-prop": "error",
        "react/no-danger-with-children": "error",
        "react/no-direct-mutation-state": "error",
        "react/no-find-dom-node": "error",
        "react/no-is-mounted": "error",
        "react/no-render-return-value": "error",
        "react/no-string-refs": "error",
        "react/no-unescaped-entities": "error",
        "react/no-unknown-property": "error",
        "react/no-unsafe": "off",
        "react/react-in-jsx-scope": "off",
        "react/rules-of-hooks": "error",
        "react/exhaustive-deps": "warn",
      },
      plugins: ["react"],
      env: {
        browser: true,
        serviceworker: true,
      },
    },
  ],
})
