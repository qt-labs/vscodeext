# Change Log

## 1.17.1 (Oct 22, 2026)

🎉 **Our Initial Preview Release** 🎉

[Documentation](https://doc-snapshots.qt.io/vscodeext-dev/vscodeext-tutorials-qt-csharp.html)

🎉 **Added**

- Detect Qt Bridge C# projects, also in workspaces that have several projects
- Create Qt Bridge C# projects and QML files with Qt: Create a new project or file
- Integrate Qt Bridge C# projects with QML Language Server, QML Preview, and QML Profiler in the `Qt QML` extension
- Debug the QML code of Qt Bridge C# applications with the QML debugger by setting `${command:qt-csharp.launchTargetPath}` as the program in `launch.json`
  - Include this configuration in projects that you create from the `Qt Bridge for C# application` template
- Introduce the `qt-csharp.qtDir` setting for selecting the Qt installation of Qt Bridge C# projects
  - Export the setting as `QtDir` to the integrated terminal, so that builds that you start there use the same Qt
  - Look for Qt in the project, the `qt-csharp.qtDir` setting, the `QtDir` environment variable, and the Qt selected in the `Qt Core` extension, in this order, before using the Qt that the Windows x64 package bundles
- Add the `Qt Bridge C#: Select Qt Installation` command, and suggest it when a build would not find Qt
- Add the `Qt Bridge C#: Select QML Build Metadata` command, and ask you to select a build if you built a project in several configurations or for several target frameworks
- Introduce the Qt Bridge C# API so that other extensions can integrate with Qt Bridge C# projects
