// Copyright (C) 2025 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import { CommandId } from '@shared/message';
import _presetsFile from './data/_presets_file.json';
import _presetsProject from './data/_presets_project.json';
import _presetCppClass from './data/_preset_cppclass.json';

class MockHandler {
  public async mockRequest<T = unknown>(
    id: CommandId,
    payload?: unknown
  ): Promise<T> {
    switch (id) {
      case CommandId.UiCheckIfQtcliReady:
        return new Promise<T>((resolve) => {
          setTimeout(() => {
            resolve({ status: 'ready' } as T);
          }, 1_000);
        });

      case CommandId.UiGetAllPresets: {
        const type = String(payload);
        const presets = type === 'project' ? _presetsProject : _presetsFile;
        return presets as T;
      }

      case CommandId.UiGetPresetById: {
        return _presetCppClass as T;
      }

      default:
        return Promise.reject(new Error("mock handler doesn't implement this"));
    }
  }
}

export const mockHandler = new MockHandler();
