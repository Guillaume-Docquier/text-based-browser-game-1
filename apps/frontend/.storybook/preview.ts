import type { Preview } from "@storybook/react-vite"
import "../src/index.css"

const preview: Preview = {
  parameters: {
    options: {
      storySort: {
        order: ["Design System", "Application"],
      },
    },
    backgrounds: {
      default: "cosmic",
      values: [{ name: "cosmic", value: "#252525" }],
    },
    controls: {
      expanded: true,
    },
    layout: "centered",
  },
}

export default preview
