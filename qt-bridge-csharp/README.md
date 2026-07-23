# Qt Bridge C# Extension for VS Code

This extension integrates Qt Bridge C# projects with the Qt extensions for
Visual Studio Code.

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

The Qt Core extension is required. C# Dev Kit is recommended for normal C#
editing and debugging but is not required by the Qt Bridge integration.

On Linux and macOS, configure the Qt installation as described in the Qt Bridge
C# documentation. Windows packages can provide their bundled Qt installation.

The extension resolves Qt from the project, the `qt-bridge-csharp.qtDir`
workspace setting, the `QTDIR` environment variable, or the Qt selected by Qt
Core, in that order. The Qt bundled by a Windows package is used only as the
final fallback.

Install the Qt Bridge project and item templates to create projects and QML
files through the Qt New Item wizard:

```bash
dotnet new install QtGroup.Qt.Bridge.CSharp.Templates
```

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
