// SYNTAX TEST "source.qml" "parent in expressions"
// Copyright (C) 2026 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

//------------------------------------------------------------------------------
// expressions
//------------------------------------------------------------------------------
Item {
    width: parent.width
//         ^^^^^^ variable.language.parent.qml
    height: Math.max(parent.height, 10)
//                   ^^^^^^ variable.language.parent.qml
    x: enabled ? parent.x : 0
//               ^^^^^^ variable.language.parent.qml
    property Item target: parent
//                        ^^^^^^ variable.language.parent.qml
}

//------------------------------------------------------------------------------
// nested blocks, methods and lists
//------------------------------------------------------------------------------
Item {
    onClicked: {
        if (parent) {
//          ^^^^^^ variable.language.parent.qml
            console.log(parent.width)
//                      ^^^^^^ variable.language.parent.qml
        }
    }
    function f() { return Math.abs(parent.y) }
//                                 ^^^^^^ variable.language.parent.qml
    items: [parent, parent.parent]
//          ^^^^^^ variable.language.parent.qml
//                  ^^^^^^ variable.language.parent.qml
//                         ^^^^^^ - variable.language.parent.qml
}

//------------------------------------------------------------------------------
// not parent
//------------------------------------------------------------------------------
Item {
    y: item.parent.y
//          ^^^^^^ - variable.language.parent.qml
    z: myparent + parentItem + $parent
//     ^^^^^^^^ - variable.language.parent.qml
//                ^^^^^^^^^^ - variable.language.parent.qml
//                              ^^^^^^^ - variable.language.parent.qml
    text: "parent" // parent
//         ^^^^^^ - variable.language.parent.qml
//                    ^^^^^^ - variable.language.parent.qml
}

//------------------------------------------------------------------------------
// end of file: every object above is closed
//------------------------------------------------------------------------------
// end
// <------ - meta.object.qml
