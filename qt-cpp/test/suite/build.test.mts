// Copyright (C) 2025 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import { expect } from 'chai';
import * as sinon from 'sinon';
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as fsp from 'fs/promises';
import * as os from 'os';

import { delay } from 'qt-lib';
import {
  setupSandboxLifecycleHooks,
  waitForVSCodeIdle,
  activateQtCpp
} from '../helper.mts';

describe('build: minimal Qt project (index-build)', function () {
  this.timeout(150_000);

  let sb: sinon.SinonSandbox;

  setupSandboxLifecycleHooks(
    (_sb) => (sb = _sb),
    async () => activateQtCpp()
  );

  it('configures and builds a tiny Qt app with CMAKE_PREFIX_PATH', async function () {
    const wsFolder = vscode.workspace.workspaceFolders?.[0];
    if (!wsFolder) {
      throw new Error('No workspace folder open — expected projectFolder.');
    }
    const projectDir = wsFolder.uri.fsPath;
    console.log('Using projectDir:', projectDir);

    // Qt root
    const qtRoot =
      vscode.workspace
        .getConfiguration('qt-core')
        .get<string>('qtInstallationRoot') ?? '';
    if (!qtRoot) throw new Error('qt-core.qtInstallationRoot is empty.');

    // clean build dir
    const buildDir = path.join(projectDir, 'build');
    await fsp.rm(buildDir, { recursive: true, force: true }).catch(() => {});

    // configure CMake
    await vscode.workspace
      .getConfiguration('cmake', wsFolder.uri)
      .update(
        'configureSettings',
        { CMAKE_PREFIX_PATH: qtRoot },
        vscode.ConfigurationTarget.Workspace
      );

    const generator = process.platform === 'win32' ? 'Ninja' : 'Unix Makefiles';
    await vscode.workspace
      .getConfiguration('cmake', wsFolder.uri)
      .update('generator', generator, vscode.ConfigurationTarget.Workspace);

    // spy on error messages
    const errSpy = sb.spy(vscode.window, 'showErrorMessage');

    // --- ensure a Kit is selected non-interactively ---
    await vscode.commands.executeCommand('cmake.scanForKits');

    type KitLike = { name?: string; label?: string };

    const kitsPath =
      process.platform === 'win32'
        ? path.join(
            os.homedir(),
            'AppData',
            'Local',
            'CMakeTools',
            'cmake-tools-kits.json'
          )
        : path.join(
            os.homedir(),
            '.local',
            'share',
            'CMakeTools',
            'cmake-tools-kits.json'
          );

    let kits: KitLike[] = [];
    try {
      if (fs.existsSync(kitsPath)) {
        const raw = fs.readFileSync(kitsPath, 'utf-8');
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          kits = parsed as KitLike[];
        }
      }
    } catch {
      // ignore; we'll fall back to no kit
    }

    function pickKit(list: KitLike[]): string | undefined {
      if (!Array.isArray(list) || list.length === 0) return undefined;

      const preferences: RegExp[] =
        process.platform === 'darwin'
          ? [/Clang.*arm64/i, /AppleClang/i, /Clang/i, /GCC/i]
          : process.platform === 'win32'
            ? [/MSVC|Visual Studio|Clang-cl/i, /Clang/i, /GCC|MinGW/i]
            : [/GCC/i, /Clang/i];

      for (const re of preferences) {
        const k = list.find((k) => re.test(k.name ?? k.label ?? ''));
        if (k) return k.name ?? k.label;
      }
      // last resort: first entry if present
      const first = list[0];
      return first ? (first.name ?? first.label) : undefined;
    }

    const kitName = pickKit(kits);

    if (kitName) {
      await vscode.commands.executeCommand('cmake.setKitByName', kitName);
      await waitForVSCodeIdle();
      console.log('[build.test] Selected Kit:', kitName);
    } else {
      console.warn('[build.test] No kitName resolved; configure may prompt.');
    }

    // ... run cmake.configure / cmake.build / assertions ...
    console.log('Running cmake.configure...');
    const rcCfg =
      await vscode.commands.executeCommand<number>('cmake.configure');
    await waitForVSCodeIdle();
    expect(rcCfg, `cmake.configure failed (rc=${rcCfg})`).to.equal(0);

    console.log('Running cmake.build...');
    const rcBuild = await vscode.commands.executeCommand<number>('cmake.build');
    await waitForVSCodeIdle();
    expect(rcBuild, `cmake.build failed (rc=${rcBuild})`).to.equal(0);

    await delay(400); // flush to disk

    const bin = process.platform === 'win32' ? 'hello.exe' : 'hello';
    const outPath = path.join(buildDir, bin);
    console.log('Checking for binary at', outPath);

    expect(fs.existsSync(outPath), `Expected build artifact at ${outPath}`).to
      .be.true;
    expect(errSpy.called, 'Unexpected error popups during build').to.be.false;
  });
});
