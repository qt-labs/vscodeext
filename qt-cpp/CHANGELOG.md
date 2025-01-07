# Change Log

## 1.2.0 (Jan 8, 2025)

⚠️ **Changed**

- Removed dependency on `qt-ui`

🐞 **Fixed**

- The race condition while writing to `cmake-kits.json`

## 1.1.0 (Dec 4, 2024)

🎉 **Added**

- `QT_QML_GENERATE_QMLLS_INI` to generated kits
- Progress bar for generating kits
- Tilde support for configuration paths
- Telemetry for collecting usage data
- Generation of `qtpaths` kits
- vcpkg support
- Pop-up message to set `cmake.cmakePath` if it is not set
- Launch variables:
    1. `qt-cpp.QML_IMPORT_PATH`
    1. `qt-cpp.QT_QPA_PLATFORM_PLUGIN_PATH`

⚠️ **Changed**

- Refactored and shortened MSVC kit names
- Set `Ninja` as the default generator for CMake instead of `Ninja Multi-Config`

🐞 **Fixed**

- Removed `No CMake kit` selected popup on startup
- Fixed generation of broken MSVC kits

## 1.0.0 (Sep 10, 2024)

- 🎉 Our initial release 🎉
- Updated `README.md`

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
