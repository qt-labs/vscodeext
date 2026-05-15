# Change Log

## 1.15.0 (May 20, 2026)

🎉 **Added**

- Add Welcome page
- Add Qt Academy courses browser
- Add Qt examples browser web application
- Assign tab icons for web views
- Replace built-in flame graph with external QML Trace Viewer launcher

## 1.14.0 (May 20, 2026)

The same as `1.13.0`

## 1.13.0 (Feb 26, 2026)

🎉 **Added**

- Introduce QML Trace Viewer with flame graph visualization for QML trace files [Documentation](https://doc-snapshots.qt.io/vscodeext-dev/vscodeext-how-profile-qml.html)
  - Support for `.qtd` and `.qzt` file formats
  - Interactive flame graph with zoom in/out functionality
  - Three types of flame graphs to switch between
  - Filter trace event categories on and off
  - Click on cells to navigate to QML source files
  - Open raw trace data in JSONC format

## 1.12.0 (Feb 26, 2026)

The same as `1.11.1`

## 1.11.1 (Dec 22, 2025)

🎉 **Added**

- Add an option to disable QRC editor via the `qt-core.enableQrcEditor` setting

🐞 **Fixed**

- Fix `.qrc` files not using a text editor in Git, Copilot, and other extensions
  - Configured `workbench.editorAssociations` for proper editor selection
- Align QRC editor output with Qt Creator

### New Item Wizard

⚠️ **Changed**

- Add the option to choose where to open newly created projects

## 1.11.0 (Nov 24, 2025)

🎉 **Added**

- Introduce `Report an Issue` command to report bugs directly from VS Code
- Add support for opening Qt Linguist from PySide6 projects
- Add support for opening Qt for Python online documentation from `.py` files
- Introduce new language support for Qt translation (`.ts`) files [Documentation](https://doc.qt.io/vscodeext/vscodeext-how-open-files-in-linguist.html)
  - Auto-detection of Qt translation files
  - Custom icons for light and dark themes
  - Editor title button to open files in Qt Linguist

🐞 **Fixed**

- Fix Qt Linguist not opening on Windows

⚠️ **Changed**

- Remove CMake presets disable from recommended settings
- Rename file types for consistency: 'Qdoc' → 'QDoc', 'Qrc' → 'QRC'

## 1.10.0 (Nov 24, 2025)

🐞 **Fixed**

- Fix keyboard shortcuts (Cmd+A, Cmd+C, etc.) not working on macOS in the New Item Wizard dialog

### New Item Wizard

🐞 **Fixed**

- Improve startup reliability and performance

## 1.9.0 (Sep 11, 2025)

🎉 **Added**

- Introduce the `Open current file in Qt Linguist` command
- Introduce QRC editor to modify `qrc` files via UI
- Introduce variable substitution in configuration paths
- Supported variables for substitution:
  - `${workspaceFolder}` for the workspace root directory
  - `${userHome}` for the user's home directory
- Use default Qt installation root path in the `Qt: Register Qt installation` command

## 1.8.0 (Sep 11, 2025)

### New Item Wizard

🐞 **Fixed**

- Add the missing `options` field causing user-selected options to be ignored
- Disable timeout for working directory selection

🎉 **Added**

- Add fallback text colors for error/info alerts
- Introduce `WebviewChannel` for consistent panel-webview communication across multiple apps
- Reorganize VSCode panel code and type definitions slightly

⚠️ **Changed**

- Change icons
- Update project structure regarding webview UI to accommodate more apps side-by-side

### qtcli

🐞 **Fixed**

- Remove root element option to fix `ApplicationWindow`
- Fix signal declaration in the C++ template

## 1.7.0 (Jul 2, 2025)

🎉 **Added**

- Generate a kit from `qtpaths` in the environment variable PATH
- Support Qt.rgba() in color provider
- Add a `New item` dialog for creating a new project or file

🐞 **Fixed**

- Don't change `qtpaths` name if it is already set

---

### qtcli

🎉 **Added**

- Add endpoints for managing custom presets
- Enable wrapping in prompt list navigation

🐞 **Fixed**

- Resolve errors in Qt Widgets application template

⚠️ **Changed**

- Use UDS or pipe by default in server mode
- Preserve file extension if already included in filename
- Provide option to select QML root element - `Window` or `ApplicationWindow` in Qt Quick application template

## 1.6.0 (Jul 2, 2025)

The same as `1.5.1`

## 1.5.1 (Apr 16, 2025)

🐞 **Fixed**

- Fix the `Cannot find qtcli executable.` error due to the missing permissions

## 1.5.0 (Apr 14, 2025)

🎉 **Added**

- Add `cmake.useCMakePresets": "never"`to the recommended settings

---

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
