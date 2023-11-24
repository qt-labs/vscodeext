# Development Guide

## Build

- To install dependencies, run `npm install`
- To compile, run `npm run compile`

## Pre-Commit

Before every commit, the following commands should be run:

- To trigger [Prettier](https://prettier.io/), run `npm run prettier`
- To trigger [ESLint](https://eslint.org/), run `npx eslint .` or to fix
automatically, run `npx eslint . --fix`

or

- To trigger [Prettier](https://prettier.io/), [ESLint](https://eslint.org/) and
build together, run `npm run pretest`

## Dependencies

- [npm](https://www.npmjs.com/)
- [Prettier](https://prettier.io/)
- [ESLint](https://eslint.org/)
