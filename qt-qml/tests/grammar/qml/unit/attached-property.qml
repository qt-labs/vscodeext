// SYNTAX TEST "source.qml" "attached properties"
// Copyright (C) 2024 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

ListView {
    delegate: Item {
//  ^^^^^^^^ entity.other.attribute-name.qml
//            ^^^^ entity.name.type.object.qml
//                 ^ - entity.name.type.object.qml
//                 ^ punctuation.definition.block.qml
        id: _delegate
//      ^^ keyword.other.id.qml
//          ^^^^^^^^^ entity.name.variable.id.qml
        width: 100; height: 30
//      ^^^^^ entity.other.attribute-name.qml
//             ^^^ meta.embedded.expression.qml
//                ^^ - meta.embedded.expression.qml
//                ^ punctuation.terminator.statement.qml
//                  ^^^^^^ entity.other.attribute-name.qml
//                  ^^^^^^ - meta.embedded.expression.qml
//                          ^^ meta.embedded.expression.qml

        Rectangle {
            width: 100; height: 30
//          ^^^^^ entity.other.attribute-name.qml
//                 ^^^ meta.embedded.expression.qml
//                    ^^ - meta.embedded.expression.qml
//                    ^ punctuation.terminator.statement.qml
//                      ^^^^^^ entity.other.attribute-name.qml
//                      ^^^^^^ - meta.embedded.expression.qml
//                              ^^ meta.embedded.expression.qml
            color: _delegate.ListView.isCurrentItem ? "red" : "yellow" // correct
//          ^^^^^ entity.other.attribute-name.qml
//                 ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^ meta.embedded.expression.qml
        }
    }
//  ^ punctuation.definition.block.qml
}

Rectangle {
    Layout.fillWidth: true
//  ^^^^^^^^^^^^^^^^ entity.other.attribute-name.qml
//  ^^^^^^ entity.name.type.attached.qml
//        ^ punctuation.accessor.qml
//        ^ - entity.name.type.attached.qml
//         ^^^^^^^^^ - entity.name.type.attached.qml
//         ^^^^^^^^^ - punctuation.accessor.qml
//         ^^^^^^^^^ meta.attached.type.Layout.qml
//  ^^^^^^^ - meta.attached.type.Layout.qml
//                    ^^^^ meta.embedded.expression.qml
    Layout.margins: 16
//  ^^^^^^ entity.name.type.attached.qml
//         ^^^^^^^ entity.other.attribute-name.qml
//         ^^^^^^^ - entity.name.type.attached.qml
//         ^^^^^^^ meta.attached.type.Layout.qml
    ListView.delayRemove: {
//  ^^^^^^^^ entity.name.type.attached.qml
//          ^ punctuation.accessor.qml
        return true
    }
    Drag.keys: [ "a" ]
//  ^^^^ entity.name.type.attached.qml
//      ^ punctuation.accessor.qml
    ToolTip.toolTip: ToolTip { }
//  ^^^^^^^ entity.name.type.attached.qml
//         ^ punctuation.accessor.qml
    Component.onCompleted: init()
//  ^^^^^^^^^ entity.name.type.attached.qml
//           ^ punctuation.accessor.qml
//            ^^^^^^^^^^^ entity.name.function.handler.qml
//            ^^^^^^^^^^^ meta.attached.type.Component.qml
    anchors.fill: parent
//  ^^^^^^^ entity.other.attribute-name.qml
//  ^^^^^^^ - entity.name.type.attached.qml
//         ^ punctuation.accessor.qml
//          ^^^^ - meta.attached.type.anchors.qml
}

//------------------------------------------------------------------------------
// end of file: every object above is closed
//------------------------------------------------------------------------------
// end
// <------ - meta.object.qml
