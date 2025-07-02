# Change Log

## 1.7.0 (Jul 2, 2025)

🎉 **Added**

- Support Qt.rgba() in color provider

## 1.6.0 (Jul 2, 2025)

🎉 **Added**

- Add the following QML Debugger features:
  - Show variables and the `This` variable
  - Manipulate values of variables
  - Add watch expressions
  - Add conditional breakpoints
  - Add expression evaluation
  - Add launch mode to the QML Debugger
  - Explain how to include missing .qml files

⚠️ **Changed**

- Decrease retry time for the QML Debug Adapter from 3s to 500ms

🐞 **Fixed**

- Fix the synchronization problem when multiple breakpoints step through quickly
- Discard QRC files that don't have `qresource`
- Disconnect the QML Debugger when the debuggee is terminated
- Disconnect the QML Debugger properly in the attach mode

## 1.5.1 (Apr 16, 2025)

The same as `1.5.0`

## 1.5.0 (Apr 14, 2025)

🎉 **Added**

- Introduce the `qt-qml.qmlls.useNoCMakeCalls` configuration variable to disable CMake calls for QML Language Server
- Introduce the `qt-qml.qmlls.customArgs` setting to allow users to pass custom arguments to QML Language Server
- Add the `-d` argument for QML Language Server to to pass documentation path
- Gather the documentation path from the either the selected kit or `qtpaths`.
- Introduce `qt-qml.qmlls.customDocsPath`. It overrides the default in either the selected kit or `qtpaths`
- Use `QT_INSTALL_DOCS` to find the documentation path from `qtpaths`
- Add partially QML debugger support
    Supported features:
  - Breakpoints
  - Step over
  - Step into
  - Step out
  - Continue
- Add `launch.json` configuration snippets for QML debugger

## 1.3.1 (Mar 5, 2025)

The same as `1.2.0`

## 1.3.0 (Jan 9, 2025)

The same as `1.2.0`

## 1.2.1 (Jan 17, 2025)

🐞 **Fixed**

- Backport [Refactor communication between core and extensions](https://github.com/qt-labs/vscodeext/commit/b02c70db6ba873c3bea446eee15dae63759667a8) to fix [QTBUG-131702](https://bugreports.qt.io/browse/QTBUG-131702)

## 1.2.0 (Jan 8, 2025)

🎉 **Added**

- Wait until `qt-cpp` is activated

## 1.1.0 (Dec 4, 2024)

🎉 **Added**

- Tilde support for configuration paths
- Telemetry for collecting usage data
- Automatically downloading the latest QML Language Server binary
- `Check for QML language server update` and `Download the most recent QML language server` commands
- Configuration variables:
    1. `qt-qml.qmlls.additionalImportPaths` for adding additional import paths
    1. `qt-qml.doNotAskForQmllsDownload` for disabling the download prompt
    1. `qt-qml.qmlls.useQmlImportPathEnvVar` for using the `QML_IMPORT_PATH` environment variable
- Multi-root workspace support for QML Language Server

⚠️ **Changed**

- Improved `qml` static syntax highlighting

## 1.0.0 (Sep 10, 2024)

- 🎉 Our initial release 🎉
- Enabled QML Language Server by default
- Updated `README.md`

## 0.9.2 (Aug 28, 2024)

- Split from the `qt-official` extension
- Added color provider for the `qml` language
- Updated `qml` file icons and added light and dark themes icons
- Improved `qml` syntax highlighting
- Restricted the usage of QML Language Server only to `6.7.2` or newer versions
- Added the `Restart QML Language Server` command
- Added syntax highlighting for `qmldir` files

## 0.9.1 (May 30, 2024)

- Fixed bugs with generating `MSVC` kits on Windows
- Added QML Language Server support
- Added the `qt-official.qmlls.enabled` setting to turn on QML Language Server
- Added the `qt-official.qmlls.verboseOutput` setting to show verbose output from QML Language Server
- Added the `qt-official.qmlls.traceLsp` setting to collect trace output from QML Language Server
- Added the `qt-official.qmlls.customExePath` setting to specify a custom path to the QML Language Server executable
- Added the `qt-official.setRecommendedSettings` command to set recommended settings.
- Updated `README.md` with new features and settings
- Added [vscode-cmake-tools-api](https://github.com/microsoft/vscode-cmake-tools-api) to detect kit changes

## 0.9.0 (May 21, 2024)

- 🎉 Our initial preview release 🎉
