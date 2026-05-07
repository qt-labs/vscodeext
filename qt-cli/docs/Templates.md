# Qt CLI Templates Documentation

Qt CLI uses a template system to generate projects and files. This document describes the template structure, syntax, and configuration files.

# Overview

Templates are located in `src/assets/templates/` and are organized by category:

- **`projects/`** - Project templates (console, widgets, QML)
- **`types/`** - Individual file type templates (QML, UI, QRC)
- **`common/`** - Common template files shared across all templates
- **`cpp/`** - C++ class templates

Each template directory name becomes the preset name (e.g., `cpp/class` → `@cpp/class`).

## Template Structure

Each template contains:

```
template-name/
├── templates.yml    # Configuration and file definitions
├── prompt.yml       # User input prompts (optional)
└── <template-files> # Files to be generated (e.g., file.cpp, file.h)
```


# templates.yml

The main configuration file that defines template metadata, file inputs/outputs, and computed fields.

## Basic Structure

```yaml
version: "1"

meta:
  type: project
  title: "Display Title"
  description: "Description"

files:
  - in: input_file.txt
    out: output_file.txt
    when: condition
    bypass: false

fields:
  - fieldNme: fieldValue
```

## Version

| Property | Value | Description |
|----------|-------|-------------|
| `version` | `"1"` | Current template version. Always set to `"1"`. This field exists for future version compatibility. |

### Meta

| Property | Type | Description |
|----------|------|-------------|
| `type` | `project` or `file` | Specifies whether the template creates a project or individual file |
| `title` | string | Display name shown in the UI |
| `description` | string | Detailed description of what the template creates |

## Files

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `in` | string | Yes | Input template file path |
| `out` | string | - | Output file path (defaults to input name). Supports template expressions |
| `when` | string | - | Conditional expression. File is created only if true |
| `bypass` | boolean | - | If `true`, file content is not processed with template syntax (default: false) |

Note:
- all the properties are treated as the Go template string
- use `@` prefix to reference root directories. e.g. `@/common/git.ignore` is resolved as `src/assets/templates/common/`

## Fields

Variables that become available in template expressions, for example:

```yaml
fields:
  - fieldName: template_expression
  - anotherField: |
      {{ if condition }}
      value_if_true
      {{ else }}
      value_if_false
      {{ end }}
```

## Options

Configuration options for controlling template processing behavior.

```yaml
options:
  polish:
    trimStart: true
    compressEmptyLines: true
```

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `polish.trimStart` | boolean | true | Removes leading whitespace from template files - prevents unnecessary blank lines caused by something like template directives |
| `polish.compressEmptyLines` | boolean | true | Compresses multiple empty lines into single lines - simplifies template authoring. Otherwise, set to `false` for example, a Python files or projects to preserve two empty lines considering PEP8. |

# prompt.yml

Defines user input prompts that appear in the terminal or GUI.

## Basic Structure

```yaml
version: "1"

steps:
  - id: fieldId
    type: picker | confirm | text
    question: "Display question?"
    default: default_value
    items: [list of options]  # For picker type
```


## Version

| Property | Value | Description |
|----------|-------|-------------|
| `version` | `"1"` | Current template version. Always set to `"1"`. This field exists for future version compatibility. |


## Step Properties

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `id` | string | Yes | Unique identifier for the input (becomes available as `.fieldId` in templates) |
| `type` | string | Yes | Input type: `picker`, `confirm`, or `text` |
| `question` | string | Yes | Question displayed to user |
| `default` | any | No | Default value if user skips the step |
| `items` | array | No | List of options (required for `picker` type) |

## Input Types

### Picker

```yaml
- id: baseClass
  type: picker
  question: "Select base class:"
  default: QObject
  items:
    - text: QObject
    - text: QWidget
    - text: QMainWindow
    - text: QQuickItem
```

#### Confirm

```yaml
- id: useForm
  type: confirm
  question: "Use form?"
  default: true
```

#### Text

```yaml
- id: projectName
  type: text
  question: "Project name:"
  default: "MyProject"
```

## Template syntax

Template files use Go's `text/template` syntax with some custom functions.
For standard Go template syntax, refer to the [Go text/template documentation](https://pkg.go.dev/text/template).

### Variables

All the variables are defined from `prompt.yml` or `fields` in `templates.yml` file.
One exception to this is `name`, which is automatically available in all templates and represents the project or file name provided by the user via terminal command or GUI. It can be access like:

```go
{{ .name }}  // Project or file name (passed from terminal or GUI)
```

### Varaibles from `prompt.yml`

```yaml
steps:
  - id: framework
    type: picker
    question: "Select framework:"
    items:
      - text: "Qt Widgets"
      - text: "Qt Quick"

  - id: style
    type: picker
    question: "Select style:"
    items:
      - text: "Modern"
      - text: "Classic"
```

Then use both values: `{{ .framework }}` and `{{ .style }}` in any template strings.

### Custom Functions

Qt CLI provides custom template functions that are exposed during template generation. These functions are designed to simplify template composition and reduce boilerplate code.

| Function | Parameters | Return | Description |
|----------|-----------|--------|-------------|
| `Qt.NewArray` | - | `[]any` | Creates an empty array |
| `Qt.Append` | `array`, `value` | `[]any` | Appends a value to an array |
| `Qt.AppendIf` | `array`, `value`, `condition` | `[]any` | Conditionally appends a value to an array (only if condition is true) |
| `Qt.ParseFloat` | `value` | `float64` | Parses a value as a floating-point number |
| `Qt.Reverse` | `slice` | `[]string` | Reverses a string array |

## Simple Example

**Directory Structure:**
```
types/qml/
├── file.qml
└── templates.qml
```

**templates.yml:**
```yaml
version: "1"

meta:
  type: file
  title: QML file
  description: >-
    Creates a QML file with boilerplate code,
    starting with "import QtQuick".

files:
  - in: file.qml
    out: '{{ .name }}.qml'
```

No `prompt.yml` needed here because no user input is required.

**file.qml:**
```qml
import QtQuick

Rectangle {
    width: 640
    height: 480
    color: "#ffffff"

    Text {
        anchors.centerIn: parent
        text: "Hello, {{ .name }}!"
    }
}
```
