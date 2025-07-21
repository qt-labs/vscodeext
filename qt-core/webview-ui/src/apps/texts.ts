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

export const qrc = {
  buttons: {
    addGroup: 'Group',
    addFiles: 'Files',
    delete: 'Delete',
  },

  tooltips: {
    addGroup: 'Add a new group',
    addFiles: 'Add files',
    delete: 'Delete the selected group or file',
    clean: 'Delete all the missing files and empty groups',
    sort: 'Sort all groups and files alphabetically',
    expandCollaps: 'Expand or collapse all',
    openInTextEditor: 'Open in a text editor'
  },

  stats: (groups: number, files: number) => {
    return [
      'Total',
      `${groups} group${(groups === 1 ? '' : 's')},`,
      `${files} file${(files === 1 ? '' : 's')}`,
    ].join(' ');
  },

  noItems: {
    info: 'No items available',
    addGroup: 'Add your first group'
  },

  props: {
    title: 'Properties',
    alias: 'Alias',
    prefix: 'Prefix',
    language: 'Language',
  },

  annotation: {
    alias: (a: string) => `Alias: ${a}`,
    empty: 'Empty',
    notFound: 'Not found'
  },

  errors: {
    tooLong: 'Enter a shorter name',
    prefixEmpty: 'Give the prefix a name',
    prefixStart: 'Must start with /',
    invalidLang: 'Use a valid language code (de_DE, en_US, de)'
  }
}
