// SYNTAX TEST "source.qml" "inline components"
// Copyright (C) 2024 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

//------------------------------------------------------------------------------
// multiple lines
//------------------------------------------------------------------------------
Window {
    component PushButtonInline: Rectangle {
//  ^^^^^^^^^ storage.type.component.qml
//            ^^^^^^^^^^^^^^^^ entity.name.type.component.qml
//                              ^^^^^^^^^ entity.name.type.object.qml
//  ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^ meta.component.qml
        id: _rect
        color: "skyblue"
        border.color: "lightgray"
        implicitWidth: 150
        implicitHeight: 60
    }
//  ^ meta.component.qml
}

//------------------------------------------------------------------------------
// single line, qualified base type
//------------------------------------------------------------------------------
Item {
    component MyButton: T.Button { text: "a" }
//  ^^^^^^^^^ storage.type.component.qml
//            ^^^^^^^^ entity.name.type.component.qml
//                      ^^^^^^^^ entity.name.type.object.qml
//                                 ^^^^ entity.other.attribute-name.qml
//  ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^ meta.component.qml
}

//------------------------------------------------------------------------------
// nested objects and members after
//------------------------------------------------------------------------------
Item {
    component Labeled: Item {
//  ^^^^^^^^^ storage.type.component.qml
//            ^^^^^^^ entity.name.type.component.qml
//                     ^^^^ entity.name.type.object.qml
        Text { text: "x" }
//      ^^^^ entity.name.type.object.qml
//      ^^^^^^^^^^^^^^^^^^ meta.component.qml
    }
    width: 10
//  ^^^^^ entity.other.attribute-name.qml - meta.component.qml
}

//------------------------------------------------------------------------------
// end of file: every object above is closed
//------------------------------------------------------------------------------
// end
// <------ - meta.object.qml
