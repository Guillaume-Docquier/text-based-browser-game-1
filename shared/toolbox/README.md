# Toolbox

A collection of mostly functional (programming) utilities.

## Setup

I just wanted to share source files between projects.

I want to run the backend as native typescript in node, but:

- type stripping is not applied to node modules
- I cannot use `imports` aliases for directories outside the project.
- I also cannot use typescript path aliases

I ended up mostly following [turborepo's advice](https://turborepo.dev/docs/guides/tools/typescript#building-a-typescript-package)
This means I have to build the toolbox. It makes the CI a bit more complicated, and the dev setup as well.

There's surprisingly not a lot of tools to make this easy (sharing typescript without transpiling).  
Or maybe I haven't found them, sad.
