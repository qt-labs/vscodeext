# Qt Extension for Visual Studio Code

Develop Qt applications with Visual Studio Code.

You can:

- Use Qt in your CMake project by selecting a generated Qt kit.
- Design Qt widgets-based UIs with Qt Widgets Designer.
- Build Qt projects with CMake.
- Debug Qt's C++ types.
- Handle Qt-specific file formats.

## How to

### Get started

1. _Install the Qt extension_.
1. _Register a Qt installation_.
1. Open a folder that contains a Qt CMake project (that has a `CMakeLists.txt`
   file).
1. In `Command Palette`, select `CMake: Select a Kit` to select a kit that
   matches your Qt version and toolchain.
1. Select `CMake: Build` to build the project.

### Install the Qt extension

To install the Qt extension:

1. Select the `Extensions` icon in the `Activity Bar` or press `Ctrl+Shift+X`.
1. In `Extensions`, search for `Qt Official`.
1. Select `Install`.

The [CMake](https://github.com/twxs/vs.language.cmake) and
[CMake Tools](https://github.com/microsoft/vscode-cmake-tools)
extensions are installed automatically.

### Register a Qt installation

To tell Visual Studio Code where you installed Qt:

1. In `Command Palette`, select `Qt: Register Qt Installation`.
1. Select the folder where you installed Qt, and then select
   `Select the Qt installation path`.

The command creates CMake kits for each installed Qt version.

### Scan for Qt kits

If some Qt CMake kits are missing, select `Qt: Scan for Qt Kits` in
`Command Palette`.

### Design a widgets-based UI

To design a widgets-based UI:

1. In `Explorer`, select a `.ui` file.
1. Select `Open this file with Qt Widgets Designer`.
1. Use `Qt Widgets Designer` to design a UI.

### Debug an application

To debug an application:

1. Select `Run and Debug`.
1. Create a `launch.json` file.
1. Select `Add Configuration`, and then select a `Qt: Debug` debug
   configuration that matches your debugger.

### Debug a Qt WebAssembly application

To debug a Qt WebAssembly application:

1. Open a `launch.json` file.
1. Select `Add Configuration`, and then select the
   `Qt: Debug Qt WASM with Chrome` debug configuration.

The `Qt: WASM Start` task in the `preLaunchTask` section checks the required
dependencies and prompts you to install them if necessary.

For `multi-thread` Qt WebAssembly applications, set the following
configuration in `settings.json`:

```json
    "livePreview.httpHeaders": {
        "Cross-Origin-Embedder-Policy": "require-corp",
        "Cross-Origin-Opener-Policy": "same-origin",
        "Accept-Ranges": "bytes"
    }
```

Otherwise, you may see the `SharedArrayBuffer is not defined` error.

## Reference

### Multiple kits with the same name

If you have multiple kits with the same name in different `JSON` files, the
search order is:

1. `cmake-kits.json` in the `.vscode` folder of the workspace.
1. `cmake-tools-kits.json` in the local user settings folder.
1. `JSON` files in the `cmake.additionalKits` setting.

## License

This extension can be licensed under the Qt Commercial License and the
LGPL 3.0. See the text of both licenses [here](LICENSE).
