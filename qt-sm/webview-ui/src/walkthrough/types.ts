// Copyright (C) 2026 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

export type StepStatus = 'locked' | 'active' | 'completed';

export interface WalkthroughAction {
  label: string;
  primary?: boolean;
  disabled?: boolean;
  /** Push the button to the right edge of the step's action row. */
  trailing?: boolean;
  command?: string;
  commandArgs?: unknown;
}

export interface WalkthroughStepData {
  id: string;
  title: string;
  description: string;
  status: StepStatus;
  actions?: WalkthroughAction[];
}

export interface WalkthroughConfig {
  title: string;
  description: string;
  steps: WalkthroughStepData[];
  successTitle?: string;
  successMessage?: string;
  /** Whether the user has marked the whole walkthrough as done. */
  getStartedDone: boolean;
}

/** Messages sent from the extension host to the webview. */
export type MessageToWebview =
  | { type: 'init'; payload: WalkthroughConfig }
  | { type: 'stepCompleted'; stepId: string }
  | { type: 'stepReset'; stepId: string };

/** Messages sent from the webview to the extension host. */
export type MessageToExtension =
  | { type: 'action'; stepId: string; command: string; commandArgs?: unknown }
  | { type: 'review'; stepId: string }
  | { type: 'resetAll' }
  | { type: 'markDone' };
