# Qt Extension for Visual Studio Code

This extension provides support for developing Qt projects with Visual
Studio Code.

## Features

- Detects the Qt installations provided by Qt's online installer.
- Creates CMake kits for each Qt installation.
- Provides debugging support for Qt's C++ types.
- Provides support for various Qt-specific file formats.

## Getting started

After installing the extension, you're asked to register your Qt
installation folder. You can also manually trigger this calling the
_Qt: Register Qt Installation_ command. This will create CMake kits
for each Qt version.

Now, open a Qt CMake project and select one of the newly created kits
with the command _CMake: Select a Kit_ and build the project with
_CMake: Build_.

To debug your program, select _Run and Debug_ in the side bar and
create a `launch.json` file. Select _Add Configuration..._ and choose
from the available _Qt: Debug..._ options, depending on your platform
and toolchain.

## Commands

### Register Qt Installation

Lets you select the folder where Qt has been installed using the Qt
installer.

### Open UI File in Qt Designer

Opens the currently selected .ui file in Qt Designer.

## License

This extension can be licensed under the Qt Commercial License and the
LGPL 3.0. See the text of both licenses [here](LICENSE).
