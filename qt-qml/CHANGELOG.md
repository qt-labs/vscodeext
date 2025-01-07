# Change Log

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
