# Qt Extension for VS Code Documentation

The `doc` folder contains the sources for building Qt Extension for VS Code.

## Building the documentation using CMake

The `doc` folder contains a CMake project configuration for the documentation build.

### On Windows, in a separate doc build folder
1. `md vscodeext-docs`
1. `cd vscodeext-docs`
1. `<\path\to\Qt>\bin\qt-cmake -GNinja -DQT_BUILD_ONLINE_DOCS=ON <path\to\vscodeext\doc>`
1. For example: `C:\Qt\6.8.0\msvc2022_64\bin\qt-cmake.bat -GNinja C:\dev\vscodeext\doc`
1. `ninja html_docs`

The output is then generated under `\html` in the build directory.
Omit `-DQT_BUILD_ONLINE_DOCS=ON` if building offline documentation.

### On Linux in a build subfolder
1. `mkdir -p doc/build`
1. `cd doc/build`
1. `</path/to/Qt>/bin/qt-cmake -GNinja -DQT_BUILD_ONLINE_DOCS=ON ..`
1. `ninja html_docs`

The output is then generated under `/html` in the build directory.
Omit `-DQT_BUILD_ONLINE_DOCS=ON` if building offline documentation.

## Running QDoc directly

Alternatively, you can call QDoc directly to build the documentation locally.

### On Windows

On the command-line, enter:

1. Set the path to the directory where you installed Qt documentation:
   `set QT_INSTALL_DOCS=C:\Qt\Docs\Qt-6.8.0`
2. Set the Qt version:
   `set QT_VER=6.8.0`
   `set QT_VERSION=6.8.0`
4. Enter the path to QDoc and the documentation configuration file:
   `C:\Qt\6.8.0\msvc2022_64\bin\qdoc.exe -indexdir %QT_INSTALL_DOCS% doc\online\vscodeext.qdocconf`

For example:

`set QT_INSTALL_DOCS=C:\Qt\Docs\Qt-6.8.0
 set QT_VER=6.8.0
 set QT_VERSION=6.8.0
 C:\Qt\6.8.0\msvc2022_64\bin\qdoc.exe -indexdir %QT_INSTALL_DOCS% doc\online\vscodeext.qdocconf`

The documentation is generated in the `doc\html` folder.

### On Linux

On the command-line, enter:

`QT_INSTALL_DOCS=~/Qt/Docs/Qt-6.8.0 ~/Qt/6.8.0/gcc_64/bin/qdoc -indexdir $QT_INSTALL_DOCS doc/online/vscodeext.qdocconf`
