// SYNTAX TEST "source.qml" "type references in expressions"
// Copyright (C) 2026 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

//------------------------------------------------------------------------------
// type followed by a member
//------------------------------------------------------------------------------
Item {
    property bool lightMode: Application.styleHints.colorScheme === Qt.Light
//                           ^^^^^^^^^^^ entity.name.type.qml
//                                      ^ - entity.name.type.qml
//                                       ^^^^^^^^^^ - entity.name.type.qml
//                                                                  ^^ support.class.qt.qml
//                                                                     ^^^^^ support.constant.qt.qml
    x: Utils.format(1)
//     ^^^^^ entity.name.type.qml
//           ^^^^^^ entity.name.function.js
}

//------------------------------------------------------------------------------
// nested blocks, methods and lists
//------------------------------------------------------------------------------
Item {
    onClicked: {
        if (Application.active) {}
//          ^^^^^^^^^^^ entity.name.type.qml
    }
    function f() { return Screen.width }
//                        ^^^^^^ entity.name.type.qml
    items: [Screen.width, Screen.height]
//          ^^^^^^ entity.name.type.qml
//                        ^^^^^^ entity.name.type.qml
}

//------------------------------------------------------------------------------
// not type references
//------------------------------------------------------------------------------
Item {
    x: foo.Bar.baz + Math.max(1, 2) + JSON.stringify(a) + Object.keys(a)
//         ^^^ - entity.name.type.qml
//                   ^^^^ - entity.name.type.qml
//                                    ^^^^ - entity.name.type.qml
//                                                        ^^^^^^ - entity.name.type.qml
    y: Foo + 1
//     ^^^ - entity.name.type.qml
    objects: [T.Item { }]
//            ^^^^^^ entity.name.type.object.qml
//            ^ - entity.name.type.qml
    text: "Application.name" // Application.name
//         ^^^^^^^^^^^ - entity.name.type.qml
//                              ^^^^^^^^^^^ - entity.name.type.qml
}

//------------------------------------------------------------------------------
// end of file: every object above is closed
//------------------------------------------------------------------------------
// end
// <------ - meta.object.qml
