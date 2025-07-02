# Change Log

## 1.7.0 (Jul 2, 2025)

🎉 **Added**

- Improve error messages for missing UI editor
- Add `Open with Text Editor` button
- Use the built-in text editor with the following extensions for `.ui` files:
  - [copilot](https://marketplace.visualstudio.com/items?itemName=GitHub.copilot)
  - [git-graph](https://marketplace.visualstudio.com/items?itemName=mhutchie.git-graph)
  - [git-graph-3](https://marketplace.visualstudio.com/items?itemName=Gxl.git-graph-3)

⚠️ **Changed**

- Rename `Qt: Open Widget Designer` to `Qt: Open Qt Widgets Designer`

## 1.6.0 (Jul 2, 2025)

The same as `1.5.1`

## 1.5.1 (Apr 16, 2025)

The same as `1.5.0`

## 1.5.0 (Apr 14, 2025)

The same as `1.3.1`

## 1.3.1 (Mar 5, 2025)

🐞 **Fixed**

- Switching between `qt-ui.customWidgetsDesignerExePath` and kit paths [VSCODEEXT-141](https://bugreports.qt.io/browse/VSCODEEXT-141)

## 1.3.0 (Jan 9, 2025)

The same as `1.2.0`

## 1.2.1 (Jan 17, 2025)

The same as `1.2.0`

## 1.2.0 (Jan 8, 2025)

🎉 **Added**

- Check also for `qmake.bat` in the Qt installation directory
- Wait until `qt-cpp` is activated

## 1.1.0 (Dec 4, 2024)

🎉 **Added**

- Tilde support for configuration paths
- Telemetry for collecting usage data
- vcpkg support

## 1.0.0 (Sep 10, 2024)

- 🎉 Our initial release 🎉
- Updated `README.md`

## 0.9.2 (Aug 28, 2024)

- Split from the `qt-official` extension
- Disabled the `ui` editor in the git diff editor
- Added the `Open Qt Widgets Designer` command
- Improved `Qt Widgets Designer` detection by using `QT_HOST_BINS`
- Updated `ui` file icons and added light and dark themes icons
