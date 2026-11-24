// Copyright (C) 2026 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { expect } from 'chai';
import { findMingwBinDir, IsWindows, isMingwQtBuild } from 'qt-lib';

import {
  generateCMakePresets,
  QtInstallationInfo
} from '../../src/webview/ex-browser/helpers.ts';

describe('MinGW', () => {
  let root: string;

  // A toolchain as the Qt Online Installer puts it below `Tools`.
  function addToolsToolchain(name: string) {
    const binDir = path.join(root, 'Tools', name, 'bin');
    fs.mkdirSync(binDir, { recursive: true });
    fs.writeFileSync(path.join(binDir, 'g++.exe'), '');
    return binDir;
  }

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'qt-core-mingw-'));
  });

  afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
  });

  describe('isMingwQtBuild', () => {
    it('tells the MinGW builds of Qt by their folder', () => {
      for (const build of ['mingw_64', 'mingw81_32', 'mingw1510-x86_64']) {
        expect(isMingwQtBuild(path.join(root, '6.12.1', build)), build).to.be
          .true;
      }
      for (const build of ['msvc2022_64', 'llvm-mingw_64', 'gcc_64']) {
        expect(isMingwQtBuild(path.join(root, '6.12.1', build)), build).to.be
          .false;
      }
    });
  });

  describe('findMingwBinDir', () => {
    it('picks the shared toolchain that the Qt build names', () => {
      const shared = { '13.1.0': 'mingw-13', '15.1.0': 'mingw-15' };
      const versionDir = path.join(root, 'io.qt', 'qtframework', '6.12.1');

      expect(
        findMingwBinDir(path.join(versionDir, 'mingw1310-x86_64'), shared)
      ).to.equal('mingw-13');
      expect(
        findMingwBinDir(path.join(versionDir, 'mingw1510-x86_64'), shared)
      ).to.equal('mingw-15');
    });

    it('picks the newest toolchain of the Qt Online Installer', () => {
      addToolsToolchain('mingw1120_64');
      const newest = addToolsToolchain('mingw1310_64');
      // Without a compiler in it, it is not a toolchain.
      fs.mkdirSync(path.join(root, 'Tools', 'mingw1510_64', 'bin'), {
        recursive: true
      });

      expect(
        findMingwBinDir(path.join(root, '6.9.1', 'mingw_64'), {
          '15.1.0': 'mingw-15'
        })
      ).to.equal(newest);
    });

    it('matches the version and the architecture of a Qt 5 build', () => {
      const named = addToolsToolchain('mingw810_32');
      addToolsToolchain('mingw810_64');
      addToolsToolchain('mingw1310_32');

      expect(findMingwBinDir(path.join(root, '5.15.2', 'mingw81_32'))).to.equal(
        named
      );
    });

    it('falls back to the newest shared toolchain', () => {
      const shared = {
        '9.0.0': 'mingw-9',
        '13.1.0': 'mingw-13',
        '11.2.0': 'mingw-11'
      };

      expect(
        findMingwBinDir(path.join(root, '6.12.1', 'mingw1510-x86_64'), shared)
      ).to.equal('mingw-13');
    });

    it('finds nothing without a toolchain', () => {
      expect(findMingwBinDir(path.join(root, '6.9.1', 'mingw_64'))).to.be
        .undefined;
    });
  });

  describe('generateCMakePresets', () => {
    interface Preset {
      cacheVariables: Record<string, string>;
      environment: Record<string, string>;
    }

    function qtInstallation(build: string): QtInstallationInfo {
      const prefixPath = path.join(root, '6.12.1', build);
      return {
        name: `Qt-6.12.1-${build}`,
        prefixPath,
        toolchainFile: undefined,
        binDir: path.join(prefixPath, 'bin'),
        vendor: {}
      };
    }

    function generatePresets(qtInfo: QtInstallationInfo, mingwBinDir: string) {
      const projectDir = path.join(root, 'project');
      fs.mkdirSync(projectDir);
      generateCMakePresets(projectDir, qtInfo, {
        mingw: { '15.1.0': mingwBinDir }
      });
      const presets = JSON.parse(
        fs.readFileSync(path.join(projectDir, 'CMakePresets.json'), 'utf8')
      ) as { configurePresets: Preset[] };
      expect(presets.configurePresets).to.not.be.empty;
      return presets.configurePresets;
    }

    before(function () {
      // MinGW builds only on Windows.
      if (!IsWindows) {
        this.skip();
      }
    });

    it('names the compiler for a MinGW build of Qt', () => {
      const qtInfo = qtInstallation('mingw1510-x86_64');
      const mingwBinDir = path.join(root, 'mingw', '15.1.0', 'bin');

      for (const preset of generatePresets(qtInfo, mingwBinDir)) {
        expect(preset.cacheVariables.CMAKE_C_COMPILER).to.equal(
          path.join(mingwBinDir, 'gcc.exe')
        );
        expect(preset.cacheVariables.CMAKE_CXX_COMPILER).to.equal(
          path.join(mingwBinDir, 'g++.exe')
        );
        expect(preset.environment.PATH).to.equal(
          `${mingwBinDir};${qtInfo.binDir};$penv{PATH}`
        );
      }
    });

    it('leaves the compiler to CMake for the other builds of Qt', () => {
      const qtInfo = qtInstallation('msvc2022_64');
      const mingwBinDir = path.join(root, 'mingw', '15.1.0', 'bin');

      for (const preset of generatePresets(qtInfo, mingwBinDir)) {
        expect(preset.cacheVariables).to.not.have.any.keys(
          'CMAKE_C_COMPILER',
          'CMAKE_CXX_COMPILER'
        );
        expect(preset.environment.PATH).to.equal(
          `${qtInfo.binDir};$penv{PATH}`
        );
      }
    });
  });
});
