// Copyright (C) 2026 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

export type StepStatus = 'locked' | 'active' | 'completed';

export type SignInPhase = 'idle' | 'signing' | 'stalled' | 'failed' | 'signedIn';

export type PrivacyKey = 'usage' | 'crash';

export interface SignInStepState {
  phase: SignInPhase;
  email?: string;
  errorMessage?: string;
  privacy: { usage: boolean; crash: boolean };
}

export interface WalkthroughAction {
  label: string;
  primary?: boolean;
  disabled?: boolean;
  /** Push the button to the right edge of the step's action row. */
  trailing?: boolean;
  /** Render as plain text (e.g. the "or" between buttons), not a button. */
  text?: boolean;
  command?: string;
  commandArgs?: unknown;
}

export interface WalkthroughStepData {
  id: string;
  title: string;
  description: string;
  status: StepStatus;
  actions?: WalkthroughAction[];
  /** Only present on the sign-in step; when present the step renders SignInCard. */
  signIn?: SignInStepState;
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
  | { type: 'markDone' }
  | { type: 'signInContinue' }
  | { type: 'privacyOption'; key: PrivacyKey; enabled: boolean };
