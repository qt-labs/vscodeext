// Copyright (C) 2026 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import { expect } from 'chai';
import * as sinon from 'sinon';

import { PythonSaveMonitor } from '@/preview/python-save-monitor.mjs';

describe('PySide Python save monitor', () => {
  let clock: sinon.SinonFakeTimers;

  beforeEach(() => {
    clock = sinon.useFakeTimers();
  });

  afterEach(() => {
    clock.restore();
  });

  it('ignores a save when file contents did not change', () => {
    const onSave = sinon.spy();
    const content = Buffer.from('print("same")\n');
    const monitor = new PythonSaveMonitor(500, onSave, () => content);
    monitor.watch('main.py', content);

    expect(monitor.save('main.py')).to.equal(false);
    clock.tick(500);
    expect(onSave.called).to.equal(false);
  });

  it('batches changed Python files into one notification', () => {
    const onSave = sinon.spy();
    const contents = new Map<string, Buffer>([
      ['main.py', Buffer.from('print(1)\n')],
      ['model.py', Buffer.from('value = 1\n')]
    ]);
    const monitor = new PythonSaveMonitor(
      500,
      onSave,
      (file) => contents.get(file)!
    );
    monitor.watch('main.py');
    monitor.watch('model.py');

    contents.set('main.py', Buffer.from('print(2)\n'));
    contents.set('model.py', Buffer.from('value = 2\n'));
    expect(monitor.save('main.py')).to.equal(true);
    clock.tick(250);
    expect(monitor.save('model.py')).to.equal(true);
    clock.tick(499);
    expect(onSave.called).to.equal(false);
    clock.tick(1);

    expect(onSave.calledOnceWithExactly(['main.py', 'model.py'])).to.equal(
      true
    );
  });

  it('cancels pending notifications when disposed', () => {
    const onSave = sinon.spy();
    let content = Buffer.from('value = 1\n');
    const monitor = new PythonSaveMonitor(500, onSave, () => content);
    monitor.watch('model.py');
    content = Buffer.from('value = 2\n');
    monitor.save('model.py');

    monitor.dispose();
    clock.tick(500);
    expect(onSave.called).to.equal(false);
  });
});
