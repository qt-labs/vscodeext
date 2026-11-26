// SYNTAX TEST "source.qml" "property modifier types (<Type> on <property>)"
// Copyright (C) 2024 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

//------------------------------------------------------------------------------
// behavior
//------------------------------------------------------------------------------
Rectangle {
    width: 100; height: 100
//            ^ punctuation.terminator.statement.qml

    Behavior on width {}
//  ^^^^^^^^ entity.name.type.object.qml
//           ^^ keyword.other.on.qml
//              ^^^^^ entity.other.attribute-name.qml
//                    ^ punctuation.definition.block.qml
//                     ^ punctuation.definition.block.qml
//  ^^^^^^^^^^^^^^^^^^^^ meta.object.qml
    Behavior on height {
//  ^^^^^^^^ entity.name.type.object.qml
//           ^^ keyword.other.on.qml
//              ^^^^^^ entity.other.attribute-name.qml
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
//        ^ punctuation.terminator.statement.qml
//                 ^ punctuation.terminator.statement.qml

    NumberAnimation on value {
//  ^^^^^^^^^^^^^^^ entity.name.type.object.qml
//                  ^^ keyword.other.on.qml
//                     ^^^^^ entity.other.attribute-name.qml
//                           ^ punctuation.definition.block.qml
        from: 0; to: 100
//             ^ punctuation.terminator.statement.qml
        duration: 2000
//      ^^^^^^^^ entity.other.attribute-name.qml
        loops: NumberAnimation.Infinite
    }
//  ^ punctuation.definition.block.qml
}

//------------------------------------------------------------------------------
// qualified type and grouped property
//------------------------------------------------------------------------------
Text {
    T.Behavior on x {}
//  ^^^^^^^^^^ entity.name.type.object.qml
//             ^^ keyword.other.on.qml
//                ^ entity.other.attribute-name.qml
//                  ^ punctuation.definition.block.qml
//                   ^ punctuation.definition.block.qml
//  ^^^^^^^^^^^^^^^^^^ meta.object.qml
    NumberAnimation on font.pixelSize { to: 20 }
//  ^^^^^^^^^^^^^^^ entity.name.type.object.qml
//                  ^^ keyword.other.on.qml
//                     ^^^^^^^^^^^^^^ entity.other.attribute-name.qml
//                                    ^ punctuation.definition.block.qml
//                                      ^^ entity.other.attribute-name.qml
//                                             ^ punctuation.definition.block.qml
//  ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^ meta.object.qml
}

//------------------------------------------------------------------------------
// body contents and members after
//------------------------------------------------------------------------------
Text {
    Behavior on x {
//  ^^^^^^^^ entity.name.type.object.qml
//           ^^ keyword.other.on.qml
//              ^ entity.other.attribute-name.qml
//                ^ punctuation.definition.block.qml
        // comment
//      ^^^^^^^^^^ comment.line.qml
        enabled: true
//      ^^^^^^^ entity.other.attribute-name.qml
        onRunningChanged: console.log(1)
//      ^^^^^^^^^^^^^^^^ entity.other.attribute-name.qml
//      ^^^^^^^^^^^^^^^^ entity.name.function.handler.qml
        function f() { return 1 }
//      ^^^^^^^^^^^^^^^^^^^^^^^^^ meta.object.qml
    }
//  ^ punctuation.definition.block.qml
    width: 10
//  ^^^^^ entity.other.attribute-name.qml
}

//------------------------------------------------------------------------------
// brace on the next line
//------------------------------------------------------------------------------
Item {
    Behavior on x
//  ^^^^^^^^ entity.name.type.object.qml
//           ^^ keyword.other.on.qml
//              ^ entity.other.attribute-name.qml
    {
//  ^ punctuation.definition.block.qml
        enabled: true
//      ^^^^^^^ entity.other.attribute-name.qml
    }
//  ^ punctuation.definition.block.qml
    clip: true
//  ^^^^ entity.other.attribute-name.qml
}

//------------------------------------------------------------------------------
// end of file: every object above is closed
//------------------------------------------------------------------------------
// end
// <------ - meta.object.qml
