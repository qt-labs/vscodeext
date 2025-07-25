// Copyright (C) 2025 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR GPL-3.0-only WITH Qt-GPL-exception-1.0

import QtQuick
import QtQuick.Controls
import QtQuick.Layouts

Rectangle {
    id: addressBookItem

    required property int index
    required property string name
    required property string addr

    color: (index % 2) == 0 ? "dimgray" : "lightgray"
    anchors.left: parent.left
    anchors.right: parent.right
    height: itemText.height + 12

    signal removed()

    RowLayout {
        spacing: 12
        Layout.fillWidth: true
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
            text: "<b>" + addressBookItem.name + "</b><br><i>" + addressBookItem.addr + "</i>"
        }
    }
}
