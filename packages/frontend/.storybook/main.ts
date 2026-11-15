import type { StorybookConfig } from "@storybook/react-vite"

const config: StorybookConfig = {
  stories: ["../src/**/*.stories.@(ts|tsx)"],
  framework: "@storybook/react-vite",
  addons: ["@storybook/addon-vitest", "@storybook/addon-mcp"],
  // Storybook needs the TypeScript 6 compiler API; the tsc binary remains native TypeScript 7.
  typescript: {
    reactDocgen: "react-docgen-typescript",
  },
  core: {
    disableTelemetry: true,
    builder: {
      name: "@storybook/builder-vite",
      options: {
        viteConfigPath: ".storybook/vite.config.ts",
      },
    },
  },
}

export default config
