// Copyright (C) 2025 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR GPL-3.0-only WITH Qt-GPL-exception-1.0

pragma ComponentBehavior: Bound

import QtQuick
import QtQuick.Controls
import QtQuick.Layouts

ApplicationWindow {
    id: mainWindow
    visible: true
    width: 480
    height: 640
    title: qsTr("Address Book")

    ListModel {
        id: addressList
    }

    NewAddressPopup {
        id: newAddressPopup
        onAddressAdded: function(newName, newAddr) {
            addressList.append({name: newName, addr: newAddr})
        }
    }

    ColumnLayout {
        id: mainWindowLayout
        Layout.fillWidth: true
        spacing: 0
        Button {
            id: addButton
            Layout.preferredWidth: mainWindow.width
            Layout.fillWidth: true
            text: "Add..."
            font.pointSize: 24
            onClicked: newAddressPopup.open()
        }
        Repeater {
            id: addressListViewer
            model: addressList
            AddressBookItem {
                id: addressBookItem
                Layout.preferredWidth: mainWindow.width
                Layout.fillWidth: true
                onRemoved: addressList.remove(index)
            }
        }
    }
}
