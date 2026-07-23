// Copyright (C) 2026 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import { expect } from 'chai';
import type { QtBridgeProject } from 'qt-lib';
import { aggregateQtBridgeQmllsProjects } from '@/qtbridge-qmlls-update.mjs';

function bridgeProject(name: string): QtBridgeProject {
  const projectDirectory = `/workspace/${name}`;
  return {
    projectFile: { fsPath: `${projectDirectory}/${name}.csproj` },
    qmlImportRoot: { fsPath: '/qt/qml' },
    isMetadataReady: true,
    metadata: {
      qml: {
        projectSourceDir: projectDirectory,
        buildDirs: [`${projectDirectory}/obj/qt/native/build`],
        importPaths: [`${projectDirectory}/obj/qt/native/source/qml`]
      },
      qmlLanguageServer: {
        disableCMakeCalls: true
      }
    }
  } as unknown as QtBridgeProject;
}

describe('Qt Bridge qmlls aggregation', () => {
  it('aggregates one ready project', () => {
    const aggregation = aggregateQtBridgeQmllsProjects([
      bridgeProject('Application')
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
