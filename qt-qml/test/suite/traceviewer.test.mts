// Copyright (C) 2026 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import { expect } from 'chai';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import * as consts from '@/traceviewer/constants.mjs';
import {
  fetchFirstAvailable,
  resolvePackageUrls
} from '@/traceviewer/downloader.mjs';
import { InstalledRelease } from '@/traceviewer/installation-manager.mjs';

const OFFICIAL_LATEST =
  'https://download.qt.io/official_releases/qtcreator/latest/installer_source/';

const okResponse = () => ({ ok: true }) as unknown as Response;

describe('Trace viewer package fallback', () => {
  it('resolves every package URL from the official latest release dir', () => {
    const urls = resolvePackageUrls();
    expect(urls.length).to.be.greaterThan(1);
    for (const url of urls) {
      expect(url.startsWith(OFFICIAL_LATEST)).to.equal(true);
      expect(url).to.match(/\/(linux|mac|windows)_(x64|arm64)\/[^/]+\.zip$/);
    }
  });

  it('tries the qtprofiler package before the qmltraceviewer package', () => {
    const urls = resolvePackageUrls();
    expect(path.basename(urls[0] ?? '')).to.contain('qtprofiler');
    expect(path.basename(urls[1] ?? '')).to.contain('qmltraceviewer');
  });

  it('matches the published package layout for this platform', () => {
    const layouts: Record<string, consts.PackageCandidate[]> = {
      darwin: [
        {
          file: 'qtprofiler-signed.zip',
          exeRelPath: 'Qt Profiler.app/Contents/MacOS/Qt Profiler'
        },
        {
          file: 'qmltraceviewer-signed.zip',
          exeRelPath: 'qmltraceviewer.app/Contents/MacOS/qmltraceviewer'
        }
      ],
      win32: [
        {
          file: 'qtprofiler.zip',
          exeRelPath: path.join('bin', 'qtprofiler.exe')
        },
        {
          file: 'qmltraceviewer.zip',
          exeRelPath: path.join('bin', 'qmltraceviewer.exe')
        }
      ],
      linux: [
        {
          file: 'qtprofiler.zip',
          exeRelPath: 'libexec/qtcreator/qtprofiler'
        },
        {
          file: 'qmltraceviewer.zip',
          exeRelPath: 'libexec/qtcreator/qmltraceviewer'
        }
      ]
    };

    const expected = layouts[process.platform];
    if (!expected) {
      return;
    }
    expect(consts.PACKAGE_CANDIDATES).to.deep.equal(expected);
  });

  it('falls back to the next package when the first download fails', async () => {
    const calls: string[] = [];
    const fetchFn = (url: string) => {
      calls.push(url);
      if (calls.length === 1) {
        return Promise.reject(new Error('Invalid status code: Not Found'));
      }
      return Promise.resolve(okResponse());
    };

    const r = await fetchFirstAvailable(
      ['first', 'second'],
      undefined,
      fetchFn
    );
    expect(r.url).to.equal('second');
    expect(calls).to.deep.equal(['first', 'second']);
  });

  it('reports every attempted URL when all downloads fail', async () => {
    const fetchFn = (url: string) =>
      Promise.reject(new Error(`no ${url} here`));

    try {
      await fetchFirstAvailable(['first', 'second'], undefined, fetchFn);
      expect.fail('fetchFirstAvailable should have thrown');
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      expect(message).to.contain('first');
      expect(message).to.contain('second');
    }
  });

  it('stops trying candidates once the download is cancelled', async () => {
    const abortController = new AbortController();
    let calls = 0;
    const fetchFn = () => {
      calls++;
      abortController.abort();
      return Promise.reject(new Error('aborted'));
    };

    try {
      await fetchFirstAvailable(
        ['first', 'second'],
        { signal: abortController.signal },
        fetchFn
      );
      expect.fail('fetchFirstAvailable should have thrown');
    } catch (e) {
      expect(e).to.be.instanceOf(Error);
    }
    expect(calls).to.equal(1);
  });

  describe('executable resolution', () => {
    let baseDir: string;
    let release: InstalledRelease;
    let candidates: string[];

    const createExe = (exePath: string) => {
      fs.mkdirSync(path.dirname(exePath), { recursive: true });
      fs.writeFileSync(exePath, 'not a real executable');
    };

    beforeEach(() => {
      baseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'traceviewer-test-'));
      release = new InstalledRelease(baseDir, '1');
      candidates = consts.PACKAGE_CANDIDATES.map((c) =>
        path.join(release.filesDir, c.exeRelPath)
      );
    });

    afterEach(() => {
      fs.rmSync(baseDir, { recursive: true, force: true });
    });

    it('resolves the executable of an old qmltraceviewer package', () => {
      const oldExe = candidates[1] ?? '';
      createExe(oldExe);
      expect(release.execPath).to.equal(oldExe);
    });

    it('prefers the qtprofiler executable when both are present', () => {
      for (const exe of candidates) {
        createExe(exe);
      }
      expect(release.execPath).to.equal(candidates[0]);
    });
  });
});
