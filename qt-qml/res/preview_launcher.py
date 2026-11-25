# Copyright (C) 2026 The Qt Company Ltd.
# SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import runpy
import sys
from pathlib import Path

from PySide6.QtGui import QGuiApplication
from PySide6.QtQml import QQmlDebuggingEnabler
from PySide6.QtWidgets import QApplication


_DEBUG_ARGUMENT_PREFIX = "-qmljsdebugger="


def _run_script() -> None:
    if len(sys.argv) < 2:
        raise SystemExit("Usage: preview_launcher.py <script> [arguments]")

    script_path = Path(sys.argv[1]).resolve()
    app_arguments = sys.argv[2:]
    debug_arguments = [
        argument
        for argument in app_arguments
        if argument.startswith(_DEBUG_ARGUMENT_PREFIX)
    ]
    if len(debug_arguments) != 1:
        raise SystemExit("Exactly one -qmljsdebugger argument is required")

    debug_argument = debug_arguments[0]
    script_arguments = (
        argument for argument in app_arguments if argument != debug_argument
    )
    sys.argv = [str(script_path), *script_arguments]
    sys.path[0] = str(script_path.parent)

    QQmlDebuggingEnabler.enableDebugging(True)

    OriginalQGuiApplication = QGuiApplication
    OriginalQApplication = QApplication

    class DebuggableQGuiApplication(OriginalQGuiApplication):
        def __init__(self, arguments=None, *args, **kwargs):
            qt_arguments = list(arguments or [sys.argv[0]])
            qt_arguments.append(debug_argument)
            super().__init__(qt_arguments, *args, **kwargs)

    class DebuggableQApplication(OriginalQApplication):
        def __init__(self, arguments=None, *args, **kwargs):
            qt_arguments = list(arguments or [sys.argv[0]])
            qt_arguments.append(debug_argument)
            super().__init__(qt_arguments, *args, **kwargs)

    from PySide6 import QtGui, QtWidgets

    QtGui.QGuiApplication = DebuggableQGuiApplication
    QtWidgets.QApplication = DebuggableQApplication

    runpy.run_path(str(script_path), run_name="__main__")


if __name__ == "__main__":
    _run_script()
