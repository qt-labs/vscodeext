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
  openInOptions: {
    addToWorkspace: 'Add to workspace',
    newWindow: 'Open in new window'
  },

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

export const qmltrace = {
  noData: 'No data available',
  noLabels: '(none)',
  rootLabel: 'All operations',
  mergedLabel: 'Various Events',

  header: {
    buttons: {
      time: 'Total time',
      memory: 'Memory',
      alloc: 'Allocations'
    },

    tooltips: {
      filter: 'Show/hide filter dialog',
      zoomIn: 'Zoom to fit (or double-click the cell)',
      zoomOut: 'Zoom out to parent',
      zoomOutFull: 'Zoom out to full view',
      config: 'Open configuration settings',
      jsonc: 'Open flame graph as a JSONC document',
      openAsText: 'Open in text editor'
    }
  },

  detailsOverlay: {
    title: 'Trace details',
    label: 'Label',
    details: 'Details',
    feature: 'Feature',
    calls: 'Total calls',
    time: 'Total time',
    meanTime: 'Mean time',
    memory: 'Memory',
    alloc: "Allocations",
    loc: 'Location'
  },

  featuresOverlay: {
    title: 'Filter',
    clearButton: 'Clear',
    selectAllButton: 'Select all'
  },

  configDialog: {
    title: 'Configuration',
    saveButton: 'Save',
    qmlDirsLabel: 'QML lookup directories',
    qmlDirsLabelHelp: 'Select project source and/or build directories',
    tooltips: {
      browse: 'Browse for a directory',
      workspaces: 'Add workspace folders',
      clear: 'Clear all entries',
    }
  },

  featureNames: [
    // the first element is a backend key.
    // the second element is the label for the UI.
    //
    // not all features have to be listed here,
    // only the ones we want to show in the UI with a custom label.
    ['javascript', 'JavaScript'],
    ['compiling', 'Compiling'],
    ['creating', 'Creating'],
    ['binding', 'Binding'],
    ['handlingsignal', 'Signal handling']
  ]
}

export const exBrowser = {
  empty: {
    title: 'No data available',
    package: [
      'Examples are loaded from the installation root or additional qtpaths',
      'Adjust qt-core settings or check the directories.'
    ],
    example: 'Adjust filter settings or try other Qt versions from the navigation menu'
  },

  featuredBadge: 'Featured',

  catalog: {
    title: 'Catalog',
    versions: 'Qt versions',
    categories: 'Categories',
    locationInfo: 'Examples come from the Qt installation folder and'
      + 'any additional paths configured in settings.'
      + 'To add more, open the Command Palette and search for \'Qt: Register Qt\''
      + 'or edit settings manually.',
    location: 'Location',
    revealLocationTooltip: 'Reveal folder in the file manager'
  },

  tagCloud: {
    title: 'Available tags'
  },

  details: {
    newProject: {
      button: 'New project',
      tooltip: "Create a new project based on this example",
      dependencyWarning: [
        'The extension does not check whether the Qt modules and resources ',
        'used in the example are available.',
        'You might need to install and add them before running the example.'
      ]
    },
    doc: {
      button: 'Documentation',
      tooltip: 'Open documentation in VS Code',
      openExtTooltip: 'Open documentation in an external browser'
    },
    files: {
      title: 'Project overview'
    }
  },

  searchBox: {
    defaultPlaceholder: 'Search in examples...',
    placeholder: (category: string) => `Search in '${category}'`
  },

  projectToolbar: {
    openInVscode: 'Open project in a new window',
    reveal: 'Reveal project directory in the file manager',
  }
}

export const courses = {
  empty: {
    title: 'No courses available',
    openAcademy: 'See courses on Qt Academy instead',
    adjustFilter: 'Try adjusting the filter settings or the search keyword'
  },

  header: {
    numCourses: (n: number) => n === 1 ? 'Course' : 'Courses',
    sectionFilter: 'Filter',
    sectionSearch: 'Search',
    sectionSort: 'Sort',
    openQtAcademy: 'Go to Qt Academy',
    openQtAcademyTooltip: 'Open the Qt Academy website to browse courses in more detail',
    searchPlaceHolder: 'Search for Qt Academy courses...'
  },

  details: {
    title: 'Course details',
    openButton: (type: string) => {
      return `Open ${type === 'learningpath' ? 'learning path' : 'course'}`
    },
    objSectionTitle: 'Objectives',
    descSectionTitle: 'Description',
    releaseDatePrefix: 'Released on'
  },

  filter: {
    title: 'Filter settings',
    clearButton: 'Clear',
    typePickerDefaultText: 'Type',
    levelPickerDefaultText: 'Level'
  },

  typeText: (type: string) => {
    const lc = type.toLowerCase();
    return (
      lc === 'course' ? 'Course' : (
      lc === 'learningpath' ? 'Learning path' : ''
    ))
  },

  levelText: (level: string) => {
    const lc = level.toLowerCase();
    return (
      lc === 'basic' ? 'Basic' : (
      lc === 'intermediate' ? 'Intermediate' : (
      lc === 'advanced' ? 'Advanced' : '')
    ))
  },

  sortPickerText: (sortBy: string) => {
    const lc = sortBy.toLowerCase();
    return (
      lc === 'name' ? 'Name' : (
      lc === 'newest' ? 'Newest' : (
      lc === 'shortest' ? 'Shortest' : (
      lc === 'enrolled' ? 'Most enrolled' : (
      lc === 'reviews' ? 'Most reviewed' : (
      lc === 'ratings' ? 'Highest rated' : ''
    ))))))
  }
}

export const welcome = {
  title: 'Qt Extension for VS Code',

  versions: {
    title: 'Qt extension status',
    btnRefresh: 'Refresh',
    notInstalled: 'not installed',
    mismatchError: 'Some versions are inconsistent'
  },

  getStarted: {
    title: 'Get started',

    newProject: {
      title: 'New project',
      description: 'Start from a template'
    },

    examples: {
      title: 'Examples',
      description: 'Browse installed Qt examples and create a project'
    },

    documenation: {
      title: 'Documentation',
      description: 'Browse online documentation'
    },

    bugreport: {
      title: 'Bug report',
      description: 'Report bugs or issues'
    },

    links: {
      doc: {
        getStarted: 'Getting started',
        tutorial: 'Tutorials',
        howto: 'How to'
      },

      qt: {
        download: 'Download Qt',
        academy: 'Qt academy',
        documentation: 'Qt documentation',
        python: 'Qt for Python'
      }
    }
  },

  blogTitle: 'Blogs',
  videoTitle: 'Videos',
  showAll: 'Show all',
  checkShowOnActivation: 'Show welcome page on activation',
  emptyData: 'No data available'
}
