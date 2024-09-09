# Qt WebAssembly Extension Pack

This extension pack includes extensions for developing Qt for Web Assembly
applications in Visual Studio Code.

You can:

- Use Qt in your CMake project by selecting a generated Qt kit
- Get QML syntax highlighting and code completion
- Design Qt widgets-based UIs with Qt Widgets Designer
- Build Qt projects with CMake
- Debug Qt for WebAssembly code
- Handle Qt-specific file formats
- Read Qt documentation

## Get started

1. Select `Install` to install the Qt extension pack.
1. Go to `Command Palette`, and select `Qt: Register Qt Installation`.
1. Open a folder that contains a Qt CMake project (that has a `CMakeLists.txt`
   file).
1. Go to `Command Palette`, and select `CMake: Select a Kit` to select a kit that
   matches your Qt version and toolchain.
1. Select `CMake: Build` to build the project.

The [CMake](https://github.com/twxs/vs.language.cmake) and
[CMake Tools](https://github.com/microsoft/vscode-cmake-tools)
extensions are installed automatically.

## Documentation

For more information about using Qt extensions, go to
[Qt Extensions for VS Code Documentation](https://doc.qt.io/vscodeext/index.html).

## Issues

If you encounter any issues with the extension, please [report the
issues](https://bugreports.qt.io/projects/VSCODEEXT).

## License

This extension can be licensed under the Qt Commercial License and the
LGPL 3.0. See the text of both licenses [here](LICENSE).
