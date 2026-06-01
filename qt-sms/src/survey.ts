// Copyright (C) 2026 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import * as vscode from 'vscode';

import { createLogger, BaseStateManager, CoreKey } from 'qt-lib';
import {
  SURVEY_URL,
  SURVEY_DELAY_MS,
  STATE_SURVEY_COMPLETED,
  STATE_SURVEY_DISMISSED,
  STATE_SURVEY_LAST_PROMPT
} from '@/constants';

const logger = createLogger('survey');

// How long to wait before showing "Maybe later" again (24 hours)
const REMIND_LATER_DELAY_MS = 24 * 60 * 60 * 1000;

class SurveyStateManager extends BaseStateManager {
  constructor(context: vscode.ExtensionContext) {
    super(context, CoreKey.GLOBAL_WORKSPACE);
  }

  get surveyCompleted(): boolean {
    return this._get<boolean>(STATE_SURVEY_COMPLETED, false);
  }

  set surveyCompleted(value: boolean) {
    void this._update(STATE_SURVEY_COMPLETED, value);
  }

  get surveyDismissed(): boolean {
    return this._get<boolean>(STATE_SURVEY_DISMISSED, false);
  }

  set surveyDismissed(value: boolean) {
    void this._update(STATE_SURVEY_DISMISSED, value);
  }

  get lastPromptTime(): number {
    return this._get<number>(STATE_SURVEY_LAST_PROMPT, 0);
  }

  set lastPromptTime(value: number) {
    void this._update(STATE_SURVEY_LAST_PROMPT, value);
  }
}

let surveyState: SurveyStateManager | undefined;
let surveyTimer: ReturnType<typeof setTimeout> | undefined;

/**
 * Initialize the survey system. Call this from extension activation.
 */
export function initSurvey(context: vscode.ExtensionContext): void {
  surveyState = new SurveyStateManager(context);
  scheduleSurveyPrompt();
}

/**
 * Schedule the survey prompt to appear after the configured delay.
 */
function scheduleSurveyPrompt(): void {
  if (!surveyState) {
    return;
  }

  // Don't show if user already completed the survey or permanently dismissed it
  if (surveyState.surveyCompleted || surveyState.surveyDismissed) {
    logger.info('Survey already completed or dismissed, not scheduling prompt');
    return;
  }

  // Check if we should delay due to "Maybe later"
  const lastPrompt = surveyState.lastPromptTime;
  const now = Date.now();
  const timeSinceLastPrompt = now - lastPrompt;

  let delay = SURVEY_DELAY_MS;

  // If user clicked "Maybe later" recently, wait longer
  if (lastPrompt > 0 && timeSinceLastPrompt < REMIND_LATER_DELAY_MS) {
    delay = REMIND_LATER_DELAY_MS - timeSinceLastPrompt;
    logger.info(
      `Survey was postponed, will show again in ${String(Math.round(delay / 1000 / 60))} minutes`
    );
  }

  surveyTimer = setTimeout(() => {
    void showSurveyPrompt();
  }, delay);

  logger.info(
    `Survey prompt scheduled in ${String(Math.round(delay / 1000 / 60))} minutes`
  );
}

/**
 * Show the survey prompt to the user.
 */
async function showSurveyPrompt(): Promise<void> {
  if (!surveyState) {
    return;
  }

  // Double-check state in case it changed
  if (surveyState.surveyCompleted || surveyState.surveyDismissed) {
    return;
  }

  const takeTheSurvey = 'Take the Survey';
  const maybeLater = 'Maybe Later';
  const dontAskAgain = "Don't Ask Again";

  const result = await vscode.window.showInformationMessage(
    'We appreciate feedback! Please answer a short survey about the Qt framework installation. The survey takes max. 5 minutes.',
    takeTheSurvey,
    maybeLater,
    dontAskAgain
  );

  switch (result) {
    case takeTheSurvey:
      logger.info('User chose to take the survey');
      surveyState.surveyCompleted = true;
      void vscode.env.openExternal(vscode.Uri.parse(SURVEY_URL));
      break;

    case maybeLater:
      logger.info('User chose to postpone the survey');
      surveyState.lastPromptTime = Date.now();
      // Reschedule for later
      scheduleSurveyPrompt();
      break;

    case dontAskAgain:
      logger.info('User chose not to be asked again');
      surveyState.surveyDismissed = true;
      break;

    default:
      // User dismissed the notification without clicking a button
      // Treat as "Maybe later"
      logger.info('User dismissed the survey notification');
      surveyState.lastPromptTime = Date.now();
      scheduleSurveyPrompt();
      break;
  }
}

/**
 * Clean up the survey timer when the extension deactivates.
 */
export function disposeSurvey(): void {
  if (surveyTimer) {
    clearTimeout(surveyTimer);
    surveyTimer = undefined;
  }
}
