# Development Guide

## Build on the command line

- To install dependencies, run `npm ci`
- To compile, run `npm run compile`

## Running the extension from VS Code

* Press `F5` to open a new window with your extension loaded.
* You can relaunch the extension from the debug toolbar after changing code.
* You can also reload (`Ctrl+R` or `Cmd+R` on Mac) the VS Code window with your extension to load
  your changes.

## Pre-Commit

Before every commit, the following commands should be run:

- To trigger [Prettier](https://prettier.io/), run `npm run prettier`
- To trigger [ESLint](https://eslint.org/), run `npx eslint .` or to fix
automatically, run `npx eslint . --fix`

or

- To trigger [Prettier](https://prettier.io/), [ESLint](https://eslint.org/) and
build together, run `npm run pretest`

## Package

- To generate installable package, run `npm run package`. This will generate a
`.vsix` file in the `out` folder.

## Install

- To install the package to vscode, run `code --install-extension <vsix file generated in the previous step>`

## Run tests on the command line

- To run unit tests, run `npm run unitTests`
- To run integration tests, run `npm run integrationTests -- --qt_path="<qt_installation>"`
- To run all tests, run `npm run allTests -- --qt_path="<qt_installation>"`

## Run tests from Visual Studio Code

* Open the debug viewlet (`Ctrl+Shift+D` or `Cmd+Shift+D` on Mac) and from the launch configuration
  dropdown pick `Extension Tests`.
* Press `F5` to run the tests in a new window with your extension loaded.
* See the output of the test result in the debug console.

## Further reading

* Explore the VS Code API by inspecting the file`node_modules/@types/vscode/index.d.ts`.
* [Follow UX guidelines](https://code.visualstudio.com/api/ux-guidelines/overview) to create
  extensions that seamlessly integrate with VS Code's native interface and patterns.

## Dependencies

- [npm](https://www.npmjs.com/)
- [Prettier](https://prettier.io/)
- [ESLint](https://eslint.org/)
