// SYNTAX TEST "source.qml" "<Type> on <property>"
// Copyright (C) 2024 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import QtQuick

//------------------------------------------------------------------------------
// behavior
//------------------------------------------------------------------------------
Rectangle {
    width: 100; height: 100

    Behavior on width {}
    Behavior on height {
        NumberAnimation { duration: 1000 }
    }
}

//------------------------------------------------------------------------------
// custom behavior
//------------------------------------------------------------------------------
Text {
    text: "aaa"
    FadeBehavior on text {}
}

//------------------------------------------------------------------------------
// animation on
//------------------------------------------------------------------------------
ProgressBar {
    from:0; to: 100; width: 200

    NumberAnimation on value {
        from: 0; to: 100
        duration: 2000
        loops: NumberAnimation.Infinite
    }
}
