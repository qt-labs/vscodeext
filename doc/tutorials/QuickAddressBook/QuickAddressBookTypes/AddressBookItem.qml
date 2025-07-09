// Copyright (C) 2025 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR GPL-3.0-only WITH Qt-GPL-exception-1.0

import QtQuick
import QtQuick.Window
import QtQuick.Controls
import QtQuick.Layouts

Rectangle {
    id: addressBookItem
    color: (index % 2) == 0 ? "dimgray" : "lightgray"
    anchors.left: parent.left
    anchors.right: parent.right
    height: itemText.height + 12

    signal removed()

    RowLayout {
        spacing: 12
        anchors.left: parent.left
        anchors.leftMargin: spacing
        RoundButton {
            id: deleteButton
            text: "🗙"
            font.pointSize: 12
            palette.buttonText: "red"
            onClicked: addressBookItem.removed()
        }
        Text {
            id: itemText
            font.pointSize: 24
            text: "<b>" + name + "</b><br><i>" + addr + "</i>"
        }
    }
}
