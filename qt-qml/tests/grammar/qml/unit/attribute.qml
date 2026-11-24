// SYNTAX TEST "source.qml" "attributes"
// Copyright (C) 2024 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

//------------------------------------------------------------------------------
// object case
//------------------------------------------------------------------------------
Rectangle {
    gradient: Gradient {
        GradientStop { position: 0.0; color: "yellow" }
        GradientStop { position: 1.0; color: "green" }
    }
}

//------------------------------------------------------------------------------
// list of objects
//------------------------------------------------------------------------------
Rectangle {
    children: [
        Item { value: 1 },
        Item { value: 2 },
        T.Item { value: 3 }
    ]
}

//------------------------------------------------------------------------------
// list of js expressions
//------------------------------------------------------------------------------
Rectangle {
    values: [1, 2, 3, 4]
    values: [
        1, 2, 3, 4,
        2*20, Math.PI, calc(20)
    ]
}

//------------------------------------------------------------------------------
// js block
//------------------------------------------------------------------------------
Rectangle {
    width: { return 100; }
    width: {
        const val = 3;
        const result = val * 2;

        // comment
        return result / Math.PI;
    }
}

//------------------------------------------------------------------------------
// js expression
//------------------------------------------------------------------------------
Rectangle {
    width: 100 * 2;
    width: height / 2
    width: 100
    width: 100;
    width: 100; height: 200
    width: 100; height: 200;
    height : 480
    color: "red"
    color: Qt.rgba(100, 100, 100, 100)
    opacity: 1.2
    visible: true
    visible: false
}

//------------------------------------------------------------------------------
// group
//------------------------------------------------------------------------------
Rectangle {
    anchors.fill: parent
    anchors {
        left: other.right // comment
        right: parent.right
        // comment
        top: parent.top
    }
}

//------------------------------------------------------------------------------
// multi-line
//------------------------------------------------------------------------------
Rectangle {
    color: Qt.rgba(
        100,
        100,
        100,
        Math.random()
    )
}

//------------------------------------------------------------------------------
// attached prop
//------------------------------------------------------------------------------
ListView {
    delegate: Item {
        id: _delegate
        width: 100; height: 30

        Rectangle {
            width: 100; height: 30
            color: _delegate.ListView.isCurrentItem ? "red" : "yellow" // correct
        }
    }
}
