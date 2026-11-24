// SYNTAX TEST "source.qml" "<Type> on <property>"
// Copyright (C) 2024 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

//------------------------------------------------------------------------------
// behavior
//------------------------------------------------------------------------------
Rectangle {
    width: 100; height: 100

    Behavior on width {}
//  ^^^^^^^^ entity.name.type.on-prop.qml
//           ^^ keyword.control.on-prop.on.qml
//              ^^^^^ variable.parameter.on-prop.prop.qml - variable.parameter.attr-group-notation.qml
//                    ^ punctuation.definition.block.qml
//                     ^ punctuation.definition.block.qml
//  ^^^^^^^^^^^^^^^^^^^^ meta.object.qml
    Behavior on height {
//  ^^^^^^^^ entity.name.type.on-prop.qml
//           ^^ keyword.control.on-prop.on.qml
//              ^^^^^^ variable.parameter.on-prop.prop.qml - variable.parameter.attr-group-notation.qml
//                     ^ punctuation.definition.block.qml
//  ^^^^^^^^^^^^^^^^^^^^ meta.object.qml
        NumberAnimation { duration: 1000 }
//      ^^^^^^^^^^^^^^^ entity.name.type.object.qml
    }
//  ^ punctuation.definition.block.qml
}

//------------------------------------------------------------------------------
// animation on
//------------------------------------------------------------------------------
ProgressBar {
    from:0; to: 100; width: 200

    NumberAnimation on value {
//  ^^^^^^^^^^^^^^^ entity.name.type.on-prop.qml
//                  ^^ keyword.control.on-prop.on.qml
//                     ^^^^^ variable.parameter.on-prop.prop.qml - variable.parameter.attr-group-notation.qml
//                           ^ punctuation.definition.block.qml
        from: 0; to: 100
        duration: 2000
//      ^^^^^^^^ variable.parameter.attr-expr.qml
        loops: NumberAnimation.Infinite
    }
//  ^ punctuation.definition.block.qml
}

//------------------------------------------------------------------------------
// qualified type and grouped property
//------------------------------------------------------------------------------
Text {
    T.Behavior on x {}
//  ^^^^^^^^^^ entity.name.type.on-prop.qml
//             ^^ keyword.control.on-prop.on.qml
//                ^ variable.parameter.on-prop.prop.qml - variable.parameter.attr-group-notation.qml
//                  ^ punctuation.definition.block.qml
//                   ^ punctuation.definition.block.qml
//  ^^^^^^^^^^^^^^^^^^ meta.object.qml
    NumberAnimation on font.pixelSize { to: 20 }
//  ^^^^^^^^^^^^^^^ entity.name.type.on-prop.qml
//                  ^^ keyword.control.on-prop.on.qml
//                     ^^^^^^^^^^^^^^ variable.parameter.on-prop.prop.qml - variable.parameter.attr-group-notation.qml
//                                    ^ punctuation.definition.block.qml
//                                      ^^ variable.parameter.attr-expr.qml
//                                             ^ punctuation.definition.block.qml
//  ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^ meta.object.qml
}

//------------------------------------------------------------------------------
// body contents and members after
//------------------------------------------------------------------------------
Text {
    Behavior on x {
//  ^^^^^^^^ entity.name.type.on-prop.qml
//           ^^ keyword.control.on-prop.on.qml
//              ^ variable.parameter.on-prop.prop.qml - variable.parameter.attr-group-notation.qml
//                ^ punctuation.definition.block.qml
        // comment
//      ^^^^^^^^^^ comment.line.qml
        enabled: true
//      ^^^^^^^ variable.parameter.attr-expr.qml
        onRunningChanged: console.log(1)
//      ^^^^^^^^^^^^^^^^ variable.parameter.attr-expr.qml
        function f() { return 1 }
//      ^^^^^^^^^^^^^^^^^^^^^^^^^ meta.object.qml
    }
//  ^ punctuation.definition.block.qml
    width: 10
//  ^^^^^ variable.parameter.attr-expr.qml
}

//------------------------------------------------------------------------------
// end of file: every object above is closed
//------------------------------------------------------------------------------
// end
// <------ - meta.object.qml
