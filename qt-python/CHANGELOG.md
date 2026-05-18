# Change Log

## 1.14.0 (May 20, 2026)

The same as `1.13.0`

## 1.13.0 (Feb 26, 2026)

The same as `1.12.0`

## 1.12.0 (Feb 26, 2026)

The same as `1.11.1`

## 1.11.1 (Dec 22, 2025)

🎉 **Added**

- Add support for the `pysidedeploy.spec` file
- Support installing commercial PySide6

🐞 **Fixed**

- Fix task resolution in multi-root workspaces
- Keep main.py as the entry point for Python QWidget template

## 1.11.0 (Nov 24, 2025)

🎉 **Our Initial Preview Release** 🎉

[Documentation](https://doc.qt.io/vscodeext/vscodeext-overview.html#python-development)

🎉 **Added**

- Recognize `pyproject.toml` files for PySide6 projects
- Add PySide6 tasks: run, build, clean, and deploy
- Support debugging sessions using `debugpy`
- Introduce `qt-python.installPySide6` command
  - Install from PyPI or local Qt installation
  - Support local sources under `<Qt installation root>/QtForPython`
- Automatically monitor virtual environment changes
  - Detect removal of active virtual environment
  - Auto-detect creation of `.venv/` virtual environment
- Add support for PySide6 projects with QML Language Server
- Support opening Qt Widgets Designer from PySide6 installations
- Support opening Qt Linguist from PySide6 installations
- Support opening Qt for Python online documentation
