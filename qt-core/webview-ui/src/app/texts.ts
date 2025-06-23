// Copyright (C) 2025 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

export const wizard = {
  title: 'Create a new project or file',
  buttons: {
    create: 'Create',
    rename: 'Rename',
    delete: 'Delete',
    save: 'Save',
    yes: 'Yes',
    no: 'No',
    okay: 'OK',
    cancel: 'Cancel'
  },

  buttonTooltips: {
    create: 'Create a new preset from the currently edited options',
    save: 'Save changes to the current preset'
  },

  types: {
    project: 'Project',
    file: 'File'
  },

  presetList: 'Available presets',
  description: 'Description',
  options: 'Options',
  generation: (name: string) => `Generate "${name}"`,

  nameAndLocation: 'Name and location',
  name: 'Name',
  workingDir: 'Create in',
  workingDirTooltip: 'Browse',
  workingDirSaveCheckbox: 'Use as default project directory',

  enterNewPresetName: 'Enter a new name for the custom preset',
  confirmDeletePreset: 'Delete the preset?',

  presetNameErrors: {
    empty: 'Give the preset a name',
    invalid: 'Preset names can contain letters from a to z, numbers, and underscore characters',
    tooLong: 'Enter a shorter name',
    alreadyTaken: 'Enter a unique name'
  }
};

export const loading = {
  busy: 'Loading...',
  close: 'Close'
};
