# Qt Bridge C# Extension for VS Code

This extension integrates Qt Bridge C# projects with the Qt Extension for VS Code.

It provides:

- Qt Bridge C# project discovery, including multi-project workspaces
- Qt installation and QML import-root resolution before the first build
- build-generated QML metadata discovery and readiness tracking
- QML Preview launch preparation through a public API
- QML Language Server and live-preview integration through the Qt QML
  extension

Build the Qt Bridge project once to generate the metadata required for complete
QML Language Server and live-preview support.

## Prerequisites

The Qt Core extension is required. Install the Qt QML extension for QML
Language Server, QML Preview, and QML Profiler support. C# Dev Kit is
recommended for normal C# editing and debugging but is not required by the Qt
Bridge integration.

To create a project, run `Qt: Create a new project or file` and select
`Qt Bridge for C# application`. Use the `Qt Bridge for C# QML file` item to
add QML files to an existing project.

## Qt installation

Building a Qt Bridge project needs a Qt installation, which is set with
`QtDir`. Only the Windows x64 package bundles Qt. On Windows ARM64, Linux, and
macOS, `QtDir` is required.

If a build would not find Qt, the extension asks you to select one. Run
`Qt Bridge C#: Select Qt Installation` to select it later. The selection is
stored in the `qt-csharp.qtDir` setting and exported as `QtDir` to the
integrated terminal, so builds started there use the same Qt as the QML
tooling. For builds started elsewhere, for example by C# Dev Kit, set `QtDir`
in the environment or in the project.

The extension resolves Qt from the project, the `qt-csharp.qtDir` setting, the
`QtDir` environment variable, or the Qt selected by Qt Core, in that order. The
Qt bundled by the Windows x64 package is used only as the final fallback.

## Documentation

For Qt Bridge C# setup and project documentation, see the
[Qt Bridge C# documentation](https://doc-snapshots.qt.io/qtbridge-csharp/index.html).

For information about the Qt extensions, see the
[Qt Extension for VS Code documentation](https://doc.qt.io/vscodeext/index.html).

For pre-release documentation, see the
[Qt Extension for VS Code pre-release documentation](https://doc-snapshots.qt.io/vscodeext-dev/).

## Issues

Report issues in the
[Qt VS Code extension project](https://qt-project.atlassian.net/jira/software/c/projects/VSCODEEXT/issues).

## License

This extension is available under the Qt Commercial License or LGPL 3.0. See
[LICENSE](LICENSE) for the license text.
