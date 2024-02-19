// Copyright (C) 2024 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as child_process from 'child_process';
import { getQtDesignerPath } from './commands/file-ext-ui';
import { designerServer } from './designer-server';

class DesignerClient {
  private process: child_process.ChildProcess | undefined;

  public async start() {
    const designerExePath = await getQtDesignerPath();
    const designerServerPort = designerServer.getPort();
    if (!designerServerPort) {
      throw new Error('Designer server is not running');
    }

    if (designerExePath) {
      this.process = child_process
        .spawn(designerExePath, ['--client ' + designerServerPort.toString()], {
          shell: true
        })
        .on('exit', () => {
          this.process = undefined;
        });
    }
  }

  public isRunning() {
    return this.process !== undefined;
  }

  public stop() {
    if (this.process) {
      this.process.kill();
    }
  }
}

export const designerClient: DesignerClient = new DesignerClient();
