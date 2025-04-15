# Change Log

## 1.5.1 (Apr 16, 2025)

🐞 **Fixed**

- Fix the `Cannot find qtcli executable.` error due to the missing permissions

## 1.5.0 (Apr 14, 2025)

🎉 **Added**

- Add `cmake.useCMakePresets": "never"`to the recommended settings

### qtcli

🎉 **Added**

- Add third-party licenses
- Align the usage of default and user presets
- Support C++ class generation
- Add server mode with REST API endpoints
- Show all presets in `preset ls`
- Include more build information in binary

🐞 **Fixed**

- The broken template for `ui` files
- Add missing `CMAKE_CXX_STANDARD` setting to qtquick

⚠️ **Changed**

- Removed .ts file template
- Dropped virtual keyboard support from the qtquick template
- Remove `MACOSX_BUNDLE_GUI_IDENTIFIER` from qtquick
- Modernize the console template
- Allow entering target language without the region specifier
- Modernize the `qwidget` project template
- Do not let project wizards create `ts` files

## 1.3.1 (Mar 5, 2025)

⏪ **Reverted**

- F1 keybinding for documentation search [VSCODEEXT-123](https://bugreports.qt.io/browse/VSCODEEXT-123)

## 1.3.0 (Jan 9, 2025)

🎉 **Added**

- Ship the `qt-cli` extension with `qt-core`
- New project and file creation features via `qt-cli`

## 1.2.1 (Jan 17, 2025)

🐞 **Fixed**

- Revert the F1 key binding for help

## 1.2.0 (Jan 8, 2025)

- Color provider for `qss` files

## 1.1.0 (Dec 4, 2024)

🎉 **Added**

- Progress bar for generating kits
- Telemetry for collecting usage data
- vcpkg support
- Tilde support for configuration paths
- Configuration values:
    1. `qt-core.additionalQtPaths` to add additional Qt installations

⚠️ **Changed**

- Switched from `VSCODE_QT_FOLDER` to `VSCODE_QT_INSTALLATION_ROOT` in generated kits
- Improved default installation root folders

🐞 **Fixed**

- The broken Cancel button for the online documentation search

## 1.0.0 (Sep 10, 2024)

- 🎉 Our initial release 🎉
- Updated `README.md`

## 0.9.2 (Aug 28, 2024)

- Split from the `qt-official` extension
- Updated `qdoc`, `qrc`, `qss` file icons  and added light and dark themes icons
