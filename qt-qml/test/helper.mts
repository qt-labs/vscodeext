// Copyright (C) 2025 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as sinon from 'sinon';
import * as vscode from 'vscode';

import { isDeepStrictEqual } from 'util';
export {
  waitForVSCodeIdle,
  activateQtCpp,
  activateQtCore,
  activateQtQml,
  activateCMakeTools,
  prepareCMakeQtEnvWithVersion,
  getWorkspaceFolderOrThrow,
  cleanBuildDir,
  cmakeConfigForWorkspace,
  readCMakeCacheVar,
  prepareStandardCMakeArgs,
  selectAndApplyKit,
  CMakeConfigurator
} from '../../qt-lib/test/helper.mjs';

/**
 * Mocha lifecycle wiring for a shared Sinon sandbox.
 * - creates a sandbox once
 * - (optionally) activates the extension once
 * - resets sandbox before each test
 * - verifies & restores after each test
 */
export function setupSandboxLifecycleHooks(
  assign: (sb: sinon.SinonSandbox) => void,
  activate?: () => Thenable<unknown> | void
): void {
  let sb: sinon.SinonSandbox;

  before('create sandbox', () => {
    sb = sinon.createSandbox();
    assign(sb);
  });

  if (activate) {
    before('activate extension', activate);
  }

  beforeEach('reset sandbox', () => {
    sb = sinon.createSandbox();
    assign(sb);
  });

  afterEach('verify and restore sandbox', () => {
    sb.verifyAndRestore();
  });
}

/**
 * Stub `vscode.commands.executeCommand` and record calls that match the provided
 * command + args. Uses Node's deep equal (no lodash-es dependency).
 *
 * Usage:
 *   const spy = stubExecuteCommandWithSpy(sb, ['cmake.scanForKits']);
 *   await vscode.commands.executeCommand('cmake.scanForKits');
 *   expect(spy.calledOnce).to.be.true;
 */
export type CommandArgs = [string, ...unknown[]];
export type CommandInput = CommandArgs | CommandArgs[];

export function stubExecuteCommandWithSpy(
  sb: sinon.SinonSandbox,
  input: CommandInput
): sinon.SinonSpy {
  const real = vscode.commands.executeCommand.bind(vscode.commands);
  const list = Array.isArray(input[0])
    ? (input as CommandArgs[])
    : [input as CommandArgs];
  const spy = sinon.spy();

  sb.stub(vscode.commands, 'executeCommand').callsFake(
    (cmd: string, ...args: unknown[]) => {
      for (const [expectedCmd, ...expectedArgs] of list) {
        if (
          cmd === expectedCmd &&
          expectedArgs.length === args.length &&
          expectedArgs.every((exp, i) => isDeepStrictEqual(exp, args[i]))
        ) {
          spy(cmd, ...args);
          return Promise.resolve();
        }
      }
      return real(cmd, ...args);
    }
  );

  return spy;
}
