# Development Guide

## Build on the command line

- Since the extension are dependent on `qt-lib`, it should be built first.
- To build `qt-lib`, run `npm run ci:qt-lib && npm run compile:qt-lib`
- To build other extensions, run `npm run ci:all && npm run compile:all`
- To build a specific extension, run `npm run ci:<extension_name> && npm run compile:<extension_name>`

## Pre-Commit

Before every commit, `npm run ci-lint:all` should be run.

## Package

- To generate installable packages, run `npm run package:all`. This will generate
`.vsix` files in the each extension's `out` directory.
- Also `npm run package:<extension_name>` can be used to generate the package for a specific extension.

## Install

- To install all the extensions, run `npm run install:all` or `npm run install:<extension_name>` to install a specific extension.

## Dependencies

- [npm](https://www.npmjs.com/)
