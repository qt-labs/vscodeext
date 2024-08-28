# Change Log

## 0.9.2 (Aug 28, 2024)

- Split from the `qt-official` extension
- Renamed the `qtFolder` configuration to `qtInstallationRoot`
- Improved kit name generation on Windows
- Fixed not running `live-server` when it is already running during wasm debugging

## 0.9.1 (May 30, 2024)

- Fixed bugs with generating `MSVC` kits on Windows
- Added QML Language Server support
- Added the `qt-official.qmlls.enabled` setting to turn on QML Language Server
- Added the `qt-official.qmlls.verboseOutput` setting to show verbose output from QML Language Server
- Added the `qt-official.qmlls.traceLsp` setting to collect trace output from QML Language Server
- Added the `qt-official.qmlls.customExePath` setting to specify a custom path to the QML Language Server executable
- Added the `qt-official.setRecommendedSettings` command to set recommended settings
- Updated `README.md` with new features and settings.
- Added [vscode-cmake-tools-api](https://github.com/microsoft/vscode-cmake-tools-api) to detect kit changes

## 0.9.0 (May 21, 2024)

- 🎉 Our initial preview release 🎉
