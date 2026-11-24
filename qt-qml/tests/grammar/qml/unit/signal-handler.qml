// SYNTAX TEST "source.qml" "signal handlers"
// Copyright (C) 2024 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import QtQuick

//------------------------------------------------------------------------------
// prop. changed signal handler
//------------------------------------------------------------------------------
Rectangle {
    onWidthChanged: _rect.pressed()
    onWidthChanged: {
        console.log(`width changed to ${_rect.width}`)
    }
}

//------------------------------------------------------------------------------
// item specific signal handler
//------------------------------------------------------------------------------
Rectangle {
    MouseArea {
        onClicked: (mouse) => {
            console.log("clicked")
            _rect.clickedAt(mouse.x, mouse.y)
        }
    }
}

//------------------------------------------------------------------------------
// attached signal handler
//------------------------------------------------------------------------------
Rectangle {
    Keys.onLeftPressed: console.log("move left")

    Keys.onPressed: (event) => {
        if (event.key == Qt.Key_Left) {
            console.log("move left");
            event.accepted = true;
        }
    }

    Component.onCompleted: {
        console.log("onCompleted")
    }
}

//------------------------------------------------------------------------------
// arrow function without parameters
//------------------------------------------------------------------------------
Rectangle {
    Component.onCompleted: () => {
        console.log("aaa");
    }
}

//------------------------------------------------------------------------------
// arrow function without (), {}
//------------------------------------------------------------------------------
Rectangle {
    MouseArea {
        onPressed: mouse => root.activated(mouse.x, mouse.y)
    }
}
