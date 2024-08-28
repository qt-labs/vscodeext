# Development Guide

## Build on the command line

- Since the extension are dependent on `qt-lib`, it should be built first.
- To build `qt-lib`, run `npm run ci:qt-lib && npm run compile:qt-lib`
- To build other extensions, run `npm run ci:all && npm run compile:all`
- To build a specific extension, run `npm run ci:<extension_name> && npm run compile:<extension_name>`

## Pre-Commit

Before every commit, run `npm run ci-lint:all`

## Package

- To generate installable packages, run `npm run package:all` to generate
`.vsix` files in each extension's `out` directory.
- Also, you can run `npm run package:<extension_name>` to generate the package for a specific extension.

## Install

- To install all extensions, run `npm run install:all`
- To install a particular extension, run `npm run install:<extension_name>`

## Dependencies

- [npm](https://www.npmjs.com/)
