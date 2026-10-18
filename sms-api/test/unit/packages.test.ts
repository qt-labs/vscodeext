/* Copyright (C) 2026 The Qt Company Ltd.
 *
 * SPDX-License-Identifier: LicenseRef-Qt-Commercial OR GPL-3.0-only WITH Qt-GPL-exception-1.0
 */

/**
 * Unit tests for the Packages API.
 * Mirrors tst_clientpackages.cpp — all command methods (install, download,
 * remove, update, purge) with success, failure, connection-drop, progress,
 * and user-prompt scenarios, plus all query methods.
 */

import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';

import { Packages, Session } from '../../src/client';
import {
  ErrorCode,
  ProgressType,
  type JobCallbacks,
  type PackageReference,
  type ProgressInfo,
  type UserPrompt,
  UserPromptType
} from '../../src/types';
import { MockServer, deferred } from './mockserver';

// ── Helpers ────────────────────────────────────────────────────────────────────

interface PackageCommand {
  name: string;
  method: string;
  invoke: (p: Packages, cb?: JobCallbacks) => Promise<string>;
}

const COMMANDS: PackageCommand[] = [
  {
    name: 'install',
    method: 'packages/install',
    invoke: (p, cb) =>
      p.install([{ id: 'qt6-base', version: '6.10' }], undefined, cb)
  },
  {
    name: 'download',
    method: 'packages/download',
    invoke: (p, cb) =>
      p.download([{ id: 'qt6-base', version: '6.10' }], undefined, cb)
  },
  {
    name: 'createOffline',
    method: 'packages/create-offline',
    invoke: (p, cb) =>
      p.createOffline([{ id: 'qt6-base', version: '6.10' }], undefined, cb)
  },
  {
    name: 'remove',
    method: 'packages/remove',
    invoke: (p, cb) =>
      p.remove([{ id: 'qt6-base', version: '6.10' }], undefined, cb)
  },
  {
    name: 'update',
    method: 'packages/update',
    invoke: (p, cb) =>
      p.update([{ id: 'qt6-base', version: '6.10' }], undefined, cb)
  },
  {
    name: 'purge',
    method: 'packages/purge',
    invoke: (p, cb) => p.purge(undefined, cb)
  }
];

// ── Fixture ────────────────────────────────────────────────────────────────────

describe('Packages', () => {
  let server: MockServer;
  let session: Session;
  let packages: Packages;

  beforeEach(async () => {
    server = new MockServer();
    await server.listen();
    session = new Session('test', server.socketPath);
    session.on('error', () => {}); // Suppress for connection-drop tests
    await session.connectToService();
    packages = new Packages(session);
  });

  afterEach(() => {
    session.disconnectFromService();
    server.close();
  });

  // ── testPackageCommandSuccess ──────────────────────────────────────────────

  describe('command methods — success', () => {
    for (const cmd of COMMANDS) {
      it(`${cmd.name}: sends correct JSON-RPC method and resolves with result message`, async () => {
        const msgPromise = server.nextMessage();
        const resultPromise = cmd.invoke(packages);

        const { payload, conn } = await msgPromise;
        assert.equal(payload.jsonrpc, '2.0');
        assert.equal(payload.method, cmd.method);
        assert.ok(typeof payload.id === 'string' && payload.id.length > 0);

        const reqId = payload.id as string;
        server.sendJsonRpc(conn, {
          jsonrpc: '2.0',
          id: reqId,
          result: { message: 'OK' }
        });

        const result = await resultPromise;
        assert.equal(result, 'OK');
      });
    }
  });

  // ── progress notifications ─────────────────────────────────────────────────

  describe('command methods — progress', () => {
    for (const cmd of COMMANDS) {
      it(`${cmd.name}: calls onProgress callback with typed progress from service/progress notification`, async () => {
        const progressD = deferred<ProgressInfo>();

        const msgPromise = server.nextMessage();
        const resultPromise = cmd.invoke(packages, {
          onProgress: (info) => progressD.resolve(info)
        });

        const { payload, conn } = await msgPromise;
        const reqId = payload.id as string;

        server.sendJsonRpc(conn, {
          jsonrpc: '2.0',
          method: 'service/progress',
          params: {
            id: reqId,
            progress: 0.5,
            type: 'download',
            details: 'Downloading'
          }
        });

        const info = await progressD.promise;
        assert.equal(info.progress, 0.5);
        assert.equal(info.type, ProgressType.Download);

        // Complete the operation
        server.sendJsonRpc(conn, {
          jsonrpc: '2.0',
          id: reqId,
          result: { message: 'Done' }
        });
        await resultPromise;
      });
    }
  });

  // ── testPackageCommandFailure ──────────────────────────────────────────────

  describe('command methods — error response', () => {
    for (const cmd of COMMANDS) {
      it(`${cmd.name}: rejects with error message from server`, async () => {
        const msgPromise = server.nextMessage();
        const resultPromise = cmd.invoke(packages);

        const { payload, conn } = await msgPromise;
        const reqId = payload.id as string;

        server.sendJsonRpc(conn, {
          jsonrpc: '2.0',
          id: reqId,
          error: { code: 5000, category: 5, message: 'No such package found' }
        });

        const err = await resultPromise.then(
          () => null,
          (e: unknown) => e
        );
        assert.ok(err instanceof Error);
        assert.equal(err.message, 'No such package found');
      });
    }
  });

  // ── testPackageCommandConnectionFailure ───────────────────────────────────

  describe('command methods — connection drop', () => {
    for (const cmd of COMMANDS) {
      it(`${cmd.name}: rejects when server drops the connection`, async () => {
        const msgPromise = server.nextMessage();
        const resultPromise = cmd.invoke(packages);

        await msgPromise; // ensure request arrived before dropping

        server.dropConnections();

        const err = await resultPromise.then(
          () => null,
          (e: unknown) => e
        );
        assert.ok(err instanceof Error);
        assert.ok(
          err.message.toLowerCase().includes('socket') ||
            err.message.toLowerCase().includes('closed') ||
            err.message.toLowerCase().includes('connection')
        );
      });
    }
  });

  // ── testPackageCommandQuestionSuccess ─────────────────────────────────────

  describe('command methods — user prompt, answered', () => {
    for (const cmd of COMMANDS) {
      it(`${cmd.name}: fires onPrompt, sends reply back, then resolves on success`, async () => {
        const promptD = deferred<UserPrompt>();

        const msgPromise = server.nextMessage();
        const resultPromise = cmd.invoke(packages, {
          onPrompt: async (prompt) => {
            promptD.resolve(prompt);
            return { kind: 'choice', choice: 'Yes' };
          }
        });

        const { payload, conn } = await msgPromise;
        const reqId = payload.id as string;

        // Server sends a user-prompt question
        server.sendJsonRpc(conn, {
          jsonrpc: '2.0',
          method: 'service/question',
          id: reqId,
          params: {
            type: 'Choice',
            id: 'license_agreement_gplv3',
            title: 'GPLv3 License Agreement',
            message: 'Do you accept?',
            defaultAnswer: 'No',
            choices: 'Yes,No'
          }
        });

        // Verify the prompt was surfaced to the caller
        const prompt = await promptD.promise;
        assert.equal(prompt.id, 'license_agreement_gplv3');
        assert.equal(prompt.type, UserPromptType.Choice);
        assert.deepEqual(prompt.choices, ['Yes', 'No']);

        // Verify the dispatcher sent the prompt reply with the original id
        const { payload: reply } = await server.nextMessage();
        assert.equal(reply.id, reqId);
        const replyResult = reply.result as Record<string, string>;
        assert.equal(replyResult.id, 'license_agreement_gplv3');
        assert.equal(replyResult.replyChoice, 'Yes');

        // Server completes the operation
        server.sendJsonRpc(conn, {
          jsonrpc: '2.0',
          id: reqId,
          result: { message: 'OK' }
        });

        const result = await resultPromise;
        assert.equal(result, 'OK');
      });
    }
  });

  // ── testPackageCommandQuestionFailure ─────────────────────────────────────

  describe('command methods — user prompt, canceled', () => {
    for (const cmd of COMMANDS) {
      it(`${cmd.name}: sends cancel error response and rejects when server confirms failure`, async () => {
        const msgPromise = server.nextMessage();
        const resultPromise = cmd.invoke(packages, {
          onPrompt: async (_prompt) => ({ kind: 'cancel' })
        });

        const { payload, conn } = await msgPromise;
        const reqId = payload.id as string;

        server.sendJsonRpc(conn, {
          jsonrpc: '2.0',
          method: 'service/question',
          id: reqId,
          params: {
            type: 'Choice',
            id: 'license',
            title: 'License',
            message: 'Accept?',
            defaultAnswer: 'No',
            choices: 'Yes,No'
          }
        });

        // Dispatcher sends an error response (cancel) to server
        const { payload: cancelResp } = await server.nextMessage();
        assert.equal(cancelResp.id, reqId);
        const cancelError = cancelResp.error as Record<string, unknown>;
        assert.equal(cancelError.code, ErrorCode.UserCancelled);

        // Server confirms failure
        server.sendJsonRpc(conn, {
          jsonrpc: '2.0',
          id: reqId,
          error: { code: ErrorCode.UserCancelled, message: 'User canceled' }
        });

        const err = await resultPromise.then(
          () => null,
          (e: unknown) => e
        );
        assert.ok(err instanceof Error);
        assert.ok(err.message.toLowerCase().includes('cancel'));
      });
    }
  });

  // ── cancel ─────────────────────────────────────────────────────────────────

  describe('cancel', () => {
    it('sends packages/cancel and resolves on success', async () => {
      // Start an install so there is an in-flight operation
      const installMsgPromise = server.nextMessage();
      const installPromise = packages.install([
        { id: 'qt6-base', version: '6.10' }
      ]);

      const { payload: installPayload, conn } = await installMsgPromise;
      const installReqId = installPayload.id as string;

      // Now cancel
      const cancelMsgPromise = server.nextMessage();
      const cancelPromise = packages.cancel();

      const { payload: cancelPayload } = await cancelMsgPromise;
      assert.equal(cancelPayload.method, 'packages/cancel');
      assert.ok(
        typeof cancelPayload.id === 'string' && cancelPayload.id.length > 0
      );

      const cancelReqId = cancelPayload.id as string;

      // Service confirms cancel
      server.sendJsonRpc(conn, {
        jsonrpc: '2.0',
        id: cancelReqId,
        result: {}
      });

      await cancelPromise;

      // Complete the original install with error (service aborted it)
      server.sendJsonRpc(conn, {
        jsonrpc: '2.0',
        id: installReqId,
        error: { code: ErrorCode.UserCancelled, message: 'Operation canceled' }
      });

      const err = await installPromise.then(
        () => null,
        (e: unknown) => e
      );
      assert.ok(err instanceof Error);
      assert.ok(err.message.toLowerCase().includes('cancel'));
    });

    it('cancel rejects when service responds with error', async () => {
      const cancelMsgPromise = server.nextMessage();
      const cancelPromise = packages.cancel();

      const { payload, conn } = await cancelMsgPromise;
      assert.equal(payload.method, 'packages/cancel');

      server.sendJsonRpc(conn, {
        jsonrpc: '2.0',
        id: payload.id,
        error: { code: 5000, message: 'Nothing to cancel' }
      });

      const err = await cancelPromise.then(
        () => null,
        (e: unknown) => e
      );
      assert.ok(err instanceof Error);
      assert.equal(err.message, 'Nothing to cancel');
    });
  });

  // ── Params format ──────────────────────────────────────────────────────────

  describe('request params format', () => {
    it('install sends packages as "id@version" formatted strings', async () => {
      const pkgs: PackageReference[] = [
        { id: 'qt6-base', version: '6.10' },
        { id: 'qt6-charts', version: '6.9' }
      ];

      const msgPromise = server.nextMessage();
      const resultPromise = packages.install(pkgs);

      const { payload, conn } = await msgPromise;
      const params = payload.params as Record<string, unknown>;
      assert.deepEqual(params.packages, ['qt6-base@6.10', 'qt6-charts@6.9']);

      server.sendJsonRpc(conn, {
        jsonrpc: '2.0',
        id: payload.id,
        result: { message: 'OK' }
      });
      await resultPromise;
    });

    it('install without version sends package id only', async () => {
      const msgPromise = server.nextMessage();
      const resultPromise = packages.install([{ id: 'qt6-base' }]);

      const { payload, conn } = await msgPromise;
      const params = payload.params as Record<string, unknown>;
      assert.deepEqual(params.packages, ['qt6-base']);

      server.sendJsonRpc(conn, {
        jsonrpc: '2.0',
        id: payload.id,
        result: { message: 'OK' }
      });
      await resultPromise;
    });

    it('purge sends no packages key in params', async () => {
      const msgPromise = server.nextMessage();
      const resultPromise = packages.purge();

      const { payload, conn } = await msgPromise;
      const params = payload.params as Record<string, unknown>;
      assert.ok(
        !('packages' in params),
        'purge should not include a packages key'
      );

      server.sendJsonRpc(conn, {
        jsonrpc: '2.0',
        id: payload.id,
        result: { message: 'OK' }
      });
      await resultPromise;
    });
  });

  // ── service/message notification ──────────────────────────────────────────

  describe('command methods — service message notification', () => {
    it('install: calls onMessage callback from service/message notification', async () => {
      const messageD = deferred<string>();

      const msgPromise = server.nextMessage();
      const resultPromise = packages.install(
        [{ id: 'qt6-base', version: '6.10' }],
        undefined,
        {
          onMessage: ({ message }) => messageD.resolve(message)
        }
      );

      const { payload, conn } = await msgPromise;
      const reqId = payload.id as string;

      server.sendJsonRpc(conn, {
        jsonrpc: '2.0',
        method: 'service/message',
        params: { id: reqId, message: 'Resolving dependencies' }
      });

      const message = await messageD.promise;
      assert.equal(message, 'Resolving dependencies');

      // Complete the operation
      server.sendJsonRpc(conn, {
        jsonrpc: '2.0',
        id: reqId,
        result: { message: 'Done' }
      });
      await resultPromise;
    });
  });

  // ── progress with message field ────────────────────────────────────────────

  describe('command methods — progress with message', () => {
    it('install: progress notification includes message field and type', async () => {
      const progressD = deferred<ProgressInfo>();

      const msgPromise = server.nextMessage();
      const resultPromise = packages.install(
        [{ id: 'qt6-base', version: '6.10' }],
        undefined,
        {
          onProgress: (info) => progressD.resolve(info)
        }
      );

      const { payload, conn } = await msgPromise;
      const reqId = payload.id as string;

      server.sendJsonRpc(conn, {
        jsonrpc: '2.0',
        method: 'service/progress',
        params: {
          id: reqId,
          progress: 0.5,
          type: 'install',
          message: 'Extracting archives'
        }
      });

      const info = await progressD.promise;
      assert.equal(info.progress, 0.5);
      assert.equal(info.message, 'Extracting archives');
      assert.equal(info.type, ProgressType.Install);

      server.sendJsonRpc(conn, {
        jsonrpc: '2.0',
        id: reqId,
        result: { message: 'Done' }
      });
      await resultPromise;
    });
  });

  // ── progress type parsing ─────────────────────────────────────────────────

  describe('command methods — progress type parsing', () => {
    const progressTypeTests: { typeStr: string; expected: ProgressType }[] = [
      { typeStr: 'download', expected: ProgressType.Download },
      { typeStr: 'install', expected: ProgressType.Install },
      { typeStr: 'remove', expected: ProgressType.Remove },
      { typeStr: 'query', expected: ProgressType.Query }
    ];

    for (const { typeStr, expected } of progressTypeTests) {
      it(`parses progress type "${typeStr}" as ProgressType.${typeStr.charAt(0).toUpperCase() + typeStr.slice(1)}`, async () => {
        const progressD = deferred<ProgressInfo>();

        const msgPromise = server.nextMessage();
        const resultPromise = packages.install(
          [{ id: 'qt6-base', version: '6.10' }],
          undefined,
          {
            onProgress: (info) => progressD.resolve(info)
          }
        );

        const { payload, conn } = await msgPromise;
        const reqId = payload.id as string;

        server.sendJsonRpc(conn, {
          jsonrpc: '2.0',
          method: 'service/progress',
          params: { id: reqId, progress: 0.25, type: typeStr }
        });

        const info = await progressD.promise;
        assert.equal(info.type, expected);
        assert.equal(info.progress, 0.25);

        server.sendJsonRpc(conn, {
          jsonrpc: '2.0',
          id: reqId,
          result: { message: 'Done' }
        });
        await resultPromise;
      });
    }

    it('defaults to ProgressType.Download when type field is missing', async () => {
      const progressD = deferred<ProgressInfo>();

      const msgPromise = server.nextMessage();
      const resultPromise = packages.install(
        [{ id: 'qt6-base', version: '6.10' }],
        undefined,
        {
          onProgress: (info) => progressD.resolve(info)
        }
      );

      const { payload, conn } = await msgPromise;
      const reqId = payload.id as string;

      server.sendJsonRpc(conn, {
        jsonrpc: '2.0',
        method: 'service/progress',
        params: { id: reqId, progress: 0.75 }
      });

      const info = await progressD.promise;
      assert.equal(info.type, ProgressType.Download);
      assert.equal(info.progress, 0.75);

      server.sendJsonRpc(conn, {
        jsonrpc: '2.0',
        id: reqId,
        result: { message: 'Done' }
      });
      await resultPromise;
    });

    it('defaults to ProgressType.Download for unrecognized type string', async () => {
      const progressD = deferred<ProgressInfo>();

      const msgPromise = server.nextMessage();
      const resultPromise = packages.install(
        [{ id: 'qt6-base', version: '6.10' }],
        undefined,
        {
          onProgress: (info) => progressD.resolve(info)
        }
      );

      const { payload, conn } = await msgPromise;
      const reqId = payload.id as string;

      server.sendJsonRpc(conn, {
        jsonrpc: '2.0',
        method: 'service/progress',
        params: { id: reqId, progress: 0.3, type: 'unknown_type' }
      });

      const info = await progressD.promise;
      assert.equal(info.type, ProgressType.Download);

      server.sendJsonRpc(conn, {
        jsonrpc: '2.0',
        id: reqId,
        result: { message: 'Done' }
      });
      await resultPromise;
    });
  });

  // ── fetchRequirements ──────────────────────────────────────────────────

  describe('fetchRequirements', () => {
    it('sends packages/requirements and parses agreements and rules', async () => {
      const msgPromise = server.nextMessage();
      const resultPromise = packages.fetchRequirements([
        { id: 'qt6-base', version: '6.10' }
      ]);

      const { payload, conn } = await msgPromise;
      assert.equal(payload.method, 'packages/requirements');

      const params = payload.params as Record<string, unknown>;
      const pkgs = params.packages as string[];
      assert.equal(pkgs.length, 1);
      assert.equal(pkgs[0], 'qt6-base@6.10');

      server.sendJsonRpc(conn, {
        jsonrpc: '2.0',
        id: payload.id,
        result: {
          agreements: [
            {
              id: 'gplv3',
              title: 'GPLv3 License',
              text: 'Full license text...',
              format: 'txt',
              acceptText: 'Accept',
              rejectText: 'Decline'
            }
          ],
          unsatisfiedRules: [
            {
              rule: {
                ruleId: 'rule-1',
                ruleType: 'visibility',
                conditionType: 'account',
                conditionId: 'enterprise'
              },
              packages: [
                { packageId: 'qt6-enterprise', packageVersion: '6.10' }
              ]
            }
          ]
        }
      });

      const result = await resultPromise;
      assert.equal(result.licenseAgreements.length, 1);
      assert.equal(result.licenseAgreements[0].id, 'gplv3');
      assert.equal(result.licenseAgreements[0].title, 'GPLv3 License');
      assert.equal(result.licenseAgreements[0].acceptText, 'Accept');
      assert.equal(result.licenseAgreements[0].rejectText, 'Decline');
      assert.equal(result.licenseAgreements[0].format, 'txt');

      assert.equal(result.unsatisfiedRules.length, 1);
      assert.equal(result.unsatisfiedRules[0].ruleId, 'rule-1');
      assert.equal(result.unsatisfiedRules[0].ruleType, 'visibility');
      assert.equal(result.unsatisfiedRules[0].packages.length, 1);
      assert.equal(result.unsatisfiedRules[0].packages[0].id, 'qt6-enterprise');
      assert.equal(
        result.unsatisfiedRules[0].userMessage,
        'Package not available for your account'
      );
    });

    it('returns empty arrays when service has no requirements', async () => {
      const msgPromise = server.nextMessage();
      const resultPromise = packages.fetchRequirements();

      const { payload, conn } = await msgPromise;
      assert.equal(payload.method, 'packages/requirements');

      server.sendJsonRpc(conn, {
        jsonrpc: '2.0',
        id: payload.id,
        result: {}
      });

      const result = await resultPromise;
      assert.equal(result.licenseAgreements.length, 0);
      assert.equal(result.unsatisfiedRules.length, 0);
    });

    it('sends preAnsweredAgreements in install when provided', async () => {
      const msgPromise = server.nextMessage();
      const resultPromise = packages.install(
        [{ id: 'qt6-base', version: '6.10' }],
        {
          preAnsweredAgreements: [{ id: 'gplv3', answer: 'Accept' }]
        }
      );

      const { payload, conn } = await msgPromise;
      assert.equal(payload.method, 'packages/install');

      const params = payload.params as Record<string, unknown>;
      const answers = params.answers as { id: string; replyChoice: string }[];
      assert.equal(answers.length, 1);
      assert.equal(answers[0].id, 'gplv3');
      assert.equal(answers[0].replyChoice, 'Accept');

      server.sendJsonRpc(conn, {
        jsonrpc: '2.0',
        id: payload.id,
        result: { message: 'Installed' }
      });

      const result = await resultPromise;
      assert.equal(result, 'Installed');
    });
  });

  // ── testPackageListQuery ─────────────────────────────────────────────────

  describe('searchAvailablePackages', () => {
    it('sends filters and parses the packages array', async () => {
      const msgPromise = server.nextMessage();
      const resultPromise = packages.searchAvailablePackages({
        author: 'MyAuthor',
        module: 'MyModule',
        hostOs: 'Linux'
      });

      const { payload, conn } = await msgPromise;
      assert.equal(payload.method, 'packages/search');

      const params = payload.params as Record<string, unknown>;
      const filters = params.filters as Record<string, string>[];
      // Each active filter key should appear in the array
      const keys = filters.map((f) => Object.keys(f)[0]);
      assert.ok(keys.includes('author'));
      assert.ok(keys.includes('module'));
      assert.ok(keys.includes('hostOs'));

      server.sendJsonRpc(conn, {
        jsonrpc: '2.0',
        id: payload.id,
        result: {
          packages: [
            { id: 'qt6-base', version: '6.10', name: 'Qt6 Base' },
            { id: 'qt6-charts', version: '6.10', name: 'Qt6 Charts' }
          ]
        }
      });

      const result = await resultPromise;
      assert.equal(result.length, 2);
      assert.equal(result[0].id, 'qt6-base');
      assert.equal(result[1].id, 'qt6-charts');
    });

    it('sends packageVersion and packageId filter keys', async () => {
      const msgPromise = server.nextMessage();
      const resultPromise = packages.searchAvailablePackages({
        packageVersion: '6.10',
        packageId: 'qt6-base'
      });

      const { payload, conn } = await msgPromise;
      const params = payload.params as Record<string, unknown>;
      const filters = params.filters as Record<string, string>[];
      const keys = filters.map((f) => Object.keys(f)[0]);
      assert.ok(
        keys.includes('packageVersion'),
        'packageVersion filter should be present'
      );
      assert.ok(
        keys.includes('packageId'),
        'packageId filter should be present'
      );

      server.sendJsonRpc(conn, {
        jsonrpc: '2.0',
        id: payload.id,
        result: { packages: [] }
      });
      await resultPromise;
    });
  });

  describe('listInstalledPackages', () => {
    it('sends correct method and parses installed packages', async () => {
      const msgPromise = server.nextMessage();
      const resultPromise = packages.listInstalledPackages();

      const { payload, conn } = await msgPromise;
      assert.equal(payload.method, 'packages/list');

      server.sendJsonRpc(conn, {
        jsonrpc: '2.0',
        id: payload.id,
        result: {
          packages: [{ id: 'qt6-base', version: '6.9', name: 'Qt6 Base' }]
        }
      });

      const result = await resultPromise;
      assert.equal(result.length, 1);
      assert.equal(result[0].id, 'qt6-base');
      assert.equal(result[0].version, '6.9');
    });
  });

  describe('listAvailableUpdates', () => {
    it('parses new/old package pairs from response', async () => {
      const msgPromise = server.nextMessage();
      const resultPromise = packages.listAvailableUpdates();

      const { payload, conn } = await msgPromise;
      assert.equal(payload.method, 'packages/updates');

      server.sendJsonRpc(conn, {
        jsonrpc: '2.0',
        id: payload.id,
        result: {
          packages: [
            {
              new_package: {
                id: 'qt6-base',
                version: '6.10',
                name: 'Qt6 Base'
              },
              old_package: { id: 'qt6-base', version: '6.9', name: 'Qt6 Base' }
            }
          ]
        }
      });

      const result = await resultPromise;
      assert.equal(result.length, 1);
      assert.equal(result[0].newPackage.version, '6.10');
      assert.equal(result[0].oldPackage.version, '6.9');
    });
  });

  describe('showPackageInfo', () => {
    it('sends package reference and parses PackageData from response', async () => {
      const msgPromise = server.nextMessage();
      const resultPromise = packages.showPackageInfo({
        id: 'qt6-base',
        version: '6.10'
      });

      const { payload, conn } = await msgPromise;
      assert.equal(payload.method, 'packages/info');

      const params = payload.params as Record<string, unknown>;
      const pkg = params.package as Record<string, string>;
      assert.equal(pkg.id, 'qt6-base');
      assert.equal(pkg.version, '6.10');

      server.sendJsonRpc(conn, {
        jsonrpc: '2.0',
        id: payload.id,
        result: {
          package: {
            id: 'qt6-base',
            version: '6.10',
            name: 'Qt Base',
            author: 'The Qt Company',
            description: 'Core Qt library'
          }
        }
      });

      const result = await resultPromise;
      assert.equal(result.id, 'qt6-base');
      assert.equal(result.version, '6.10');
      assert.equal(result.name, 'Qt Base');
      assert.equal(result.author, 'The Qt Company');
    });
  });
});
