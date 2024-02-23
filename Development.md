# Development Guide

## Build

- To install dependencies, run `npm ci`
- To compile, run `npm run compile`

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

## Testing

- To run unit tests, run `npm run unitTests`
- To run integration tests, run `npm run integrationTests -- --qt_path="<qt_installation>"`
- To run all tests, run `npm run allTests -- --qt_path="<qt_installation>"`

## Dependencies

- [npm](https://www.npmjs.com/)
- [Prettier](https://prettier.io/)
- [ESLint](https://eslint.org/)
