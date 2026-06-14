// Copyright (C) 2026 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as fs from 'fs';
import * as path from 'path';

import { createLogger, IsWindows } from 'qt-lib';

const logger = createLogger('project-config-generator');

interface LaunchConfiguration {
  name: string;
  type: string;
  request: string;
  [key: string]: unknown;
}

interface CompoundConfiguration {
  name: string;
  configurations: string[];
  preLaunchTask?: string;
}

function recommendedSettings(): Record<string, unknown> {
  return {
    'cmake.options.statusBarVisibility': 'visible',
    'cmake.buildDirectory': '${workspaceFolder}/builds/${buildKit}/${buildType}'
  };
}

function cppdbgLaunchConfig(): LaunchConfiguration {
  const config: LaunchConfiguration = {
    name: 'Debug Qt Application with cppdbg',
    type: 'cppdbg',
    request: 'launch',
    program: '${command:cmake.launchTargetPath}',
    stopAtEntry: false,
    cwd: '${workspaceFolder}',
    visualizerFile: '${command:qt-cpp.natvis}',
    showDisplayString: true,
    linux: {
      MIMode: 'gdb',
      miDebuggerPath: '/usr/bin/gdb',
      sourceFileMap: {
        '/home/qt/work/qt': '${command:qt-cpp.sourceDirectory}'
      }
    },
    osx: {
      MIMode: 'lldb',
      sourceFileMap: {
        '/Users/qt/work/qt': '${command:qt-cpp.sourceDirectory}'
      }
    },
    windows: {
      sourceFileMap: {
        'Q:/qt5_workdir/w/s': '${command:qt-cpp.sourceDirectory}',
        'C:/work/build/qt5_workdir/w/s': '${command:qt-cpp.sourceDirectory}',
        'c:/users/qt/work/qt': '${command:qt-cpp.sourceDirectory}',
        'c:/Users/qt/work/install': '${command:qt-cpp.sourceDirectory}',
        '/Users/qt/work/qt': '${command:qt-cpp.sourceDirectory}'
      },
      environment: [
        {
          name: 'PATH',
          value: '${env:PATH};${command:qt-cpp.qtDir}'
        },
        {
          name: 'QT_QPA_PLATFORM_PLUGIN_PATH',
          value: '${command:qt-cpp.QT_QPA_PLATFORM_PLUGIN_PATH}'
        },
        {
          name: 'QML_IMPORT_PATH',
          value: '${command:qt-cpp.QML_IMPORT_PATH}'
        }
      ],
      MIMode: 'gdb',
      miDebuggerPath: '${command:qt-cpp.minGWgdb}'
    }
  };

  return config;
}

function cppvsdbgLaunchConfig(): LaunchConfiguration {
  return {
    name: 'Debug Qt Application with Visual Studio Debugger',
    type: 'cppvsdbg',
    request: 'launch',
    program: '${command:cmake.launchTargetPath}',
    stopAtEntry: false,
    cwd: '${workspaceFolder}',
    visualizerFile: '${command:qt-cpp.natvis}',
    windows: {
      sourceFileMap: {
        'Q:/qt5_workdir/w/s': '${command:qt-cpp.sourceDirectory}',
        'C:/work/build/qt5_workdir/w/s': '${command:qt-cpp.sourceDirectory}',
        'c:/users/qt/work/qt': '${command:qt-cpp.sourceDirectory}',
        'c:/Users/qt/work/install': '${command:qt-cpp.sourceDirectory}',
        '/Users/qt/work/qt': '${command:qt-cpp.sourceDirectory}'
      },
      environment: [
        {
          name: 'PATH',
          value: '${env:PATH};${command:qt-cpp.qtDir}'
        },
        {
          name: 'QT_QPA_PLATFORM_PLUGIN_PATH',
          value: '${command:qt-cpp.QT_QPA_PLATFORM_PLUGIN_PATH}'
        },
        {
          name: 'QML_IMPORT_PATH',
          value: '${command:qt-cpp.QML_IMPORT_PATH}'
        }
      ]
    }
  };
}

function qmlAttachLaunchConfig(): LaunchConfiguration {
  return {
    name: 'Attach to QML debugger',
    type: 'qml',
    request: 'attach',
    host: 'localhost',
    port: '${command:qt-qml.debugPort}'
  };
}

const qmlDebuggerArgs =
  '-qmljsdebugger=host:localhost,port:${command:qt-qml.debugPort},' +
  'block,services:DebugMessages,QmlDebugger,V8Debugger';

function cppQmlCppdbgLaunchConfig(): LaunchConfiguration {
  return {
    name: 'C++ launch for QML debugging (cppdbg)',
    type: 'cppdbg',
    request: 'launch',
    program: '${command:cmake.launchTargetPath}',
    stopAtEntry: false,
    cwd: '${workspaceFolder}',
    visualizerFile: '${command:qt-cpp.natvis}',
    showDisplayString: true,
    args: [qmlDebuggerArgs],
    linux: {
      MIMode: 'gdb',
      miDebuggerPath: '/usr/bin/gdb',
      sourceFileMap: {
        '/home/qt/work/qt': '${command:qt-cpp.sourceDirectory}'
      }
    },
    osx: {
      MIMode: 'lldb',
      sourceFileMap: {
        '/Users/qt/work/qt': '${command:qt-cpp.sourceDirectory}'
      }
    },
    windows: {
      sourceFileMap: {
        'Q:/qt5_workdir/w/s': '${command:qt-cpp.sourceDirectory}',
        'C:/work/build/qt5_workdir/w/s': '${command:qt-cpp.sourceDirectory}',
        'c:/users/qt/work/qt': '${command:qt-cpp.sourceDirectory}',
        'c:/Users/qt/work/install': '${command:qt-cpp.sourceDirectory}',
        '/Users/qt/work/qt': '${command:qt-cpp.sourceDirectory}'
      },
      environment: [
        {
          name: 'PATH',
          value: '${env:PATH};${command:qt-cpp.qtDir}'
        },
        {
          name: 'QT_QPA_PLATFORM_PLUGIN_PATH',
          value: '${command:qt-cpp.QT_QPA_PLATFORM_PLUGIN_PATH}'
        },
        {
          name: 'QML_IMPORT_PATH',
          value: '${command:qt-cpp.QML_IMPORT_PATH}'
        }
      ],
      MIMode: 'gdb',
      miDebuggerPath: '${command:qt-cpp.minGWgdb}'
    }
  };
}

function cppQmlCppvsdbgLaunchConfig(): LaunchConfiguration {
  return {
    name: 'C++ launch for QML debugging (cppvsdbg)',
    type: 'cppvsdbg',
    request: 'launch',
    program: '${command:cmake.launchTargetPath}',
    stopAtEntry: false,
    cwd: '${workspaceFolder}',
    visualizerFile: '${command:qt-cpp.natvis}',
    args: [qmlDebuggerArgs],
    windows: {
      sourceFileMap: {
        'Q:/qt5_workdir/w/s': '${command:qt-cpp.sourceDirectory}',
        'C:/work/build/qt5_workdir/w/s': '${command:qt-cpp.sourceDirectory}',
        'c:/users/qt/work/qt': '${command:qt-cpp.sourceDirectory}',
        'c:/Users/qt/work/install': '${command:qt-cpp.sourceDirectory}',
        '/Users/qt/work/qt': '${command:qt-cpp.sourceDirectory}'
      },
      environment: [
        {
          name: 'PATH',
          value: '${env:PATH};${command:qt-cpp.qtDir}'
        },
        {
          name: 'QT_QPA_PLATFORM_PLUGIN_PATH',
          value: '${command:qt-cpp.QT_QPA_PLATFORM_PLUGIN_PATH}'
        },
        {
          name: 'QML_IMPORT_PATH',
          value: '${command:qt-cpp.QML_IMPORT_PATH}'
        }
      ]
    }
  };
}

function hasQmlFiles(projectDir: string): boolean {
  function search(dir: string): boolean {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return false;
    }

    for (const entry of entries) {
      if (entry.isFile() && entry.name.endsWith('.qml')) {
        return true;
      }
      if (
        entry.isDirectory() &&
        entry.name !== 'build' &&
        entry.name !== 'builds'
      ) {
        if (search(path.join(dir, entry.name))) {
          return true;
        }
      }
    }
    return false;
  }

  return search(projectDir);
}

function launchConfigurations(qml: boolean): {
  configurations: LaunchConfiguration[];
  compounds: CompoundConfiguration[];
} {
  const configs: LaunchConfiguration[] = [cppdbgLaunchConfig()];
  const compounds: CompoundConfiguration[] = [];

  if (IsWindows) {
    configs.push(cppvsdbgLaunchConfig());
  }

  if (qml) {
    const cppQmlCppdbg = cppQmlCppdbgLaunchConfig();
    const qmlAttach = qmlAttachLaunchConfig();
    configs.push(cppQmlCppdbg, qmlAttach);

    if (IsWindows) {
      const cppQmlVsdbg = cppQmlCppvsdbgLaunchConfig();
      configs.push(cppQmlVsdbg);

      compounds.push({
        name: 'C++/QML (cppvsdbg)',
        configurations: [cppQmlVsdbg.name, qmlAttach.name],
        preLaunchTask: 'Qt: Acquire Port'
      });
    }

    compounds.push({
      name: 'C++/QML',
      configurations: [cppQmlCppdbg.name, qmlAttach.name],
      preLaunchTask: 'Qt: Acquire Port'
    });
  }

  return { configurations: configs, compounds };
}

function writeJsonFile(filePath: string, content: unknown) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(filePath, JSON.stringify(content, undefined, 4) + '\n');
}

export function generateProjectConfigs(projectDir: string) {
  const vscodeDir = path.join(projectDir, '.vscode');

  try {
    const settingsPath = path.join(vscodeDir, 'settings.json');
    if (!fs.existsSync(settingsPath)) {
      writeJsonFile(settingsPath, recommendedSettings());
    }

    const launchPath = path.join(vscodeDir, 'launch.json');
    if (!fs.existsSync(launchPath)) {
      const qml = hasQmlFiles(projectDir);
      const { configurations, compounds } = launchConfigurations(qml);

      const launchJson: Record<string, unknown> = {
        version: '0.2.0',
        configurations
      };

      if (compounds.length > 0) {
        launchJson.compounds = compounds;
      }

      writeJsonFile(launchPath, launchJson);
    }
  } catch (e) {
    logger.error(`Failed to generate project configs: ${String(e)}`);
  }
}
