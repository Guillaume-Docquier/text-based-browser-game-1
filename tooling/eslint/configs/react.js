import globals from "globals"
import pluginReactHooks from "eslint-plugin-react-hooks"
import pluginReact from "eslint-plugin-react"

export default {
  ...pluginReact.configs.flat.recommended,
  name: "@project/eslint-config-react",
  languageOptions: {
    ...pluginReact.configs.flat.recommended.languageOptions,
    globals: {
      ...globals.serviceworker,
      ...globals.browser,
    },
  },
  plugins: {
    ...pluginReact.configs.flat.recommended.plugins,
    "react-hooks": pluginReactHooks,
  },
  settings: { react: { version: "detect" } },
  rules: {
    ...pluginReact.configs.flat.recommended.rules,
    ...pluginReactHooks.configs.recommended.rules,
    // React scope no longer necessary with new JSX transform.
    "react/react-in-jsx-scope": "off",
  },
}
