// SYNTAX TEST "source.qml" "inline components"
// Copyright (C) 2024 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

Window {
    width: 300
    height: 200
    visible: true

    PushButtonInline { x: 50; y: 20 }
    PushButtonInline { x: 50; y: 100 }

    component PushButtonInline: Rectangle {
        id: _rect
        color: "skyblue"
        border.color: "lightgray"
        implicitWidth: 150
        implicitHeight: 60
    }
}
