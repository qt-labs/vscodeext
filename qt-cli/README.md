# Qt CLI (Command Line Interface) Tool

## Overview

This repository contains the source code for the Qt CLI, a tool that allows you to create Qt projects and files directly from the command line.

### Build

```bash
$ cd src
$ go build .
```

The `qtcli` binary will be generated in the current directory.
For cross-platform builds, refer to [Development.md](Development.md).

### Usage

To see the full list of commands, run `qtcli` without any arguments:

```bash
A CLI for creating Qt project and files

Usage:
  qtcli [flags]
  qtcli [command]

Available Commands:
  completion  Generate the autocompletion script for the specified shell
  help        Help about any command
  new         Create a new project under the current directory
  new-file    Create a new file in the current directory
  preset      Inspect and manage presets
  test        Test specific features

Flags:
  -h, --help      help for qtcli
  -v, --verbose   Enable verbose output
      --version   version for qtcli

Use "qtcli [command] --help" for more information about a command.
```

The two most frequently used commands are `new` and `new-file`.
The `new` command is used for creating a Qt project, while `new-file` is used for creating a file.

### How to create a Qt project

To create a new project, for example, `myapp`, run `qtcli new myapp`.

```bash
$ ./qtcli new myapp
? Pick a preset

  → [Default] @projects/cpp/console
    [Default] @projects/cpp/qtquick
    [Default] @projects/cpp/qwidget
    [Manually select features]     

  Use the arrow keys to move, Enter to select.
```

Select the project preset you want to create. The project is generated under the `myapp` folder in the current directory with the default parameters set.

### How to create a file

Creating a file with `qtcli` follows a similar process to creating a project. The only thing to keep in mind is using the `new-file` command instead of `new`.

For example, to create a `myasset.qrc`, run `qtcli` with `new-file myasset` (without the file extension, for now) and select `[Default] @types/qrc` in the list.

```bash
$ ./qtcli new-file myasset
? Pick a preset

    [Default] @types/qml      
  → [Default] @types/qrc      
    [Default] @types/ts       
    [Default] @types/ui       
    [Manually select features]

  Use the arrow keys to move, Enter to select.
```

The `myasset.qrc` file will be created in the current working directory.

### Faster way to create a file

If you run `qtcli new-file` with a known file extension, such as `qml`, `qrc`, `ts`, `ui`. the file will be created without asking further questions.

For example, the following command will quickly create the desired file:

```bash
$ ./qtcli new-file mywidget.ui
```

### Custom Presets

To create a project or file with your own parameters, select `[Manually select features]` at the end of the list.

It asks some questions necessary to create your project or file.
At the very end of the questions, you will have a chance to save the preset for later use.
For example, if you set the preset name to `my_console_app`:

```bash
$ ./qtcli new myapp
✔ Pick a preset [Manually select features]
✔ Pick an item to use: [Default] @projects/cpp/console
✔ Use translation: Yes
✔ Target language (e.g. de, ko_KR): de
✔ Save for later use? Yes
? Enter the preset name: my_console_app 
```

The `my_console_app` preset will be at the top of the list next time you run `qtcli`.

```bash
$ ./qtcli new myapp2
? Pick a preset

  → my_console_app (projects/cpp/console)
    [Default] @projects/cpp/console      
    [Default] @projects/cpp/qtquick      
    [Default] @projects/cpp/qwidget      
    [Manually select features]           

  Use the arrow keys to move, Enter to select.
```

### Managing Custom Presets

To manage custom presets, select the `preset` command.
For example, `qtcli preset ls` lists all the presets, like below:

```bash
$ ./qtcli preset ls
my_console_app -> @projects/cpp/console
```

```bash
$ ./qtcli preset ls -a
my_console_app -> @projects/cpp/console
[Default] @projects/cpp/console (Project)
[Default] @projects/cpp/qtquick (Project)
[Default] @projects/cpp/qwidget (Project)
[Default] @types/qml (File)
[Default] @types/qrc (File)
[Default] @types/ts (File)
[Default] @types/ui (File)
```

`qtcli preset cat <name>` displays the contents of the given custom preset.

```bash
$ ./qtcli preset cat my_console_app
name: my_console_app
type: project
template: projects/cpp/console
options:
    language: en_US
    useTranslation: true
```

Select `qtcli preset --help` for more details.

## Development

For more information about developing the Qt CLI tool, see [Development.md](Development.md).

## Issues

If you encounter any issues with the Qt CLI, please [report the
issues](https://bugreports.qt.io/projects/VSCODEEXT).

## License

This tool is available under the Qt Commercial License and the
LGPL 3.0. See the text of both licenses [here](LICENSE).
