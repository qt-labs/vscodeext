// SYNTAX TEST "source.qml" "inline components"
// Copyright (C) 2024 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

//------------------------------------------------------------------------------
// multiple lines
//------------------------------------------------------------------------------
Window {
    component PushButtonInline: Rectangle {
//  ^^^^^^^^^ keyword.other.comp-inline.qml
//            ^^^^^^^^^^^^^^^^ entity.name.type.comp-inline.name.qml
//                              ^^^^^^^^^ entity.name.type.object.qml
//  ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^ meta.component.qml
        id: _rect
//      ^^ variable.parameter.attr-expr.qml
//      ^^^^^^^^^ meta.component.qml
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
//  ^^^^^^^^^ keyword.other.comp-inline.qml
//            ^^^^^^^^ entity.name.type.comp-inline.name.qml
//                      ^^^^^^^^ entity.name.type.object.qml
//                                 ^^^^ variable.parameter.attr-expr.qml
//  ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^ meta.component.qml
}

//------------------------------------------------------------------------------
// nested objects and members after
//------------------------------------------------------------------------------
Item {
    component Labeled: Item {
//  ^^^^^^^^^ keyword.other.comp-inline.qml
//            ^^^^^^^ entity.name.type.comp-inline.name.qml
//                     ^^^^ entity.name.type.object.qml
        Text { text: "x" }
//      ^^^^ entity.name.type.object.qml
//      ^^^^^^^^^^^^^^^^^^ meta.component.qml
    }
    width: 10
//  ^^^^^ variable.parameter.attr-expr.qml - meta.component.qml
}
