// Copyright (C) 2026 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import { expect } from 'chai';
import type { QtBridgeProject } from 'qt-lib';
import {
  aggregateQtBridgeQmllsProjects,
  chooseQtBridgeQmllsUpdate
} from '@/qtbridge-qmlls-update.mjs';

function bridgeProject(
  name: string,
  options: { ready?: boolean; disableCMakeCalls?: boolean } = {}
): QtBridgeProject {
  const projectDirectory = `/workspace/${name}`;
  return {
    projectFile: { fsPath: `${projectDirectory}/${name}.csproj` },
    qmlImportRoot: { fsPath: '/qt/qml' },
    isMetadataReady: options.ready === true,
    metadata: {
      qml: {
        projectSourceDir: projectDirectory,
        buildDirs: [`${projectDirectory}/obj/qt/native/build`],
        importPaths: [`${projectDirectory}/obj/qt/native/source/qml`]
      },
      qmlLanguageServer: {
        disableCMakeCalls: options.disableCMakeCalls === true
      }
    }
  } as unknown as QtBridgeProject;
}

describe('Qt Bridge qmlls aggregation', () => {
  it('aggregates one ready project', () => {
    const aggregation = aggregateQtBridgeQmllsProjects([
      bridgeProject('Application', {
        ready: true,
        disableCMakeCalls: true
      })
    ]);

    expect(aggregation.sessionConfigs).to.have.length(1);
    expect(aggregation.startupBuildDir).to.equal(
      '/workspace/Application/obj/qt/native/build'
    );
    expect(aggregation.importPaths).to.deep.equal([
      '/qt/qml',
      '/workspace/Application/obj/qt/native/source/qml'
    ]);
    expect(aggregation.useNoCMakeCalls).to.equal(true);
  });
});

describe('Qt Bridge qmlls updates', () => {
  it('restarts when effective startup state changes', () => {
    expect(
      chooseQtBridgeQmllsUpdate('before', 'after', 'metadata', true)
    ).to.equal('restart');
  });

  it('refreshes build directories for unchanged ready metadata', () => {
    expect(
      chooseQtBridgeQmllsUpdate('same', 'same', 'metadata', true)
    ).to.equal('refresh');
  });

  it('does not refresh unavailable metadata', () => {
    expect(
      chooseQtBridgeQmllsUpdate('same', 'same', 'metadata', false)
    ).to.equal('none');
  });

  it('ignores project signals with unchanged startup state', () => {
    expect(chooseQtBridgeQmllsUpdate('same', 'same', 'project', true)).to.equal(
      'none'
    );
  });

  it('aggregates ready projects deterministically', () => {
    const first = bridgeProject('First', { ready: true });
    const second = bridgeProject('Second', {
      ready: true,
      disableCMakeCalls: true
    });

    const aggregation = aggregateQtBridgeQmllsProjects([second, first]);
    const reverse = aggregateQtBridgeQmllsProjects([first, second]);

    expect(aggregation.sessionConfigs).to.have.length(2);
    expect(aggregation.sessionConfigs[0]?.projectSourceDir).to.equal(
      '/workspace/First'
    );
    expect(aggregation.importPaths).to.deep.equal([
      '/qt/qml',
      '/workspace/First/obj/qt/native/source/qml',
      '/workspace/Second/obj/qt/native/source/qml'
    ]);
    expect(aggregation.startupBuildDir).to.be.undefined;
    expect(aggregation.useNoCMakeCalls).to.equal(true);
    expect(aggregation.stateKey).to.equal(reverse.stateKey);
  });

  it('uses a startup build directory only for one ready project', () => {
    const ready = bridgeProject('Ready', { ready: true });
    const unbuilt = bridgeProject('Unbuilt');

    const aggregation = aggregateQtBridgeQmllsProjects([unbuilt, ready]);

    expect(aggregation.sessionConfigs).to.have.length(1);
    expect(aggregation.startupBuildDir).to.equal(
      '/workspace/Ready/obj/qt/native/build'
    );
    expect(aggregation.importPaths).to.include('/qt/qml');
  });
});
