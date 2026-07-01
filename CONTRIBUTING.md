# Contributing

We welcome contributions to the Qt Extension for VS Code!

## Reporting issues

If you find a bug or have a feature request, please [report it](https://qt-project.atlassian.net/jira/software/c/projects/VSCODEEXT/issues)
before opening a pull request. This lets us discuss the change and avoid
duplicated effort.

## Submitting changes

1. Fork the repository and create a topic branch for your change.
2. Set up your development environment and build the extensions as described in
   [Development.md](Development.md).
3. Make your changes, keeping commits focused and with clear commit messages.
4. Run `npm run ci-lint:all` and make sure it passes.
5. Test your changes locally.
6. Open a pull request against the `dev` branch and fill out the pull request
   template.

## Code style

Please follow the existing code style. Linting and formatting are enforced via
`npm run ci-lint:all`.

## License

This extension is licensed under the Qt Commercial License and the LGPL 3.0. See
the [LICENSE](LICENSE) file for details. By contributing, you agree that your
contributions are licensed under the same terms.
