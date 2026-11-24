// SYNTAX TEST "source.qml" "attributes"
// Copyright (C) 2024 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

//------------------------------------------------------------------------------
// js expression
//------------------------------------------------------------------------------
Rectangle {
    width: 100 * 2;
//  ^^^^^ entity.other.attribute-name.qml - meta.embedded.expression.qml
//       ^^ - meta.embedded.expression.qml
//         ^^^^^^^ meta.embedded.expression.qml
//                ^ - meta.embedded.expression.qml
//                ^ punctuation.terminator.statement.qml
    width: height / 2
//  ^^^^^ entity.other.attribute-name.qml
//         ^^^^^^^^^^ meta.embedded.expression.qml
    width: 100
//  ^^^^^ entity.other.attribute-name.qml
//         ^^^ meta.embedded.expression.qml
    width: 100;
//  ^^^^^ entity.other.attribute-name.qml
//         ^^^ meta.embedded.expression.qml
//            ^ - meta.embedded.expression.qml
//            ^ punctuation.terminator.statement.qml
    width: 100; height: 200
//  ^^^^^ entity.other.attribute-name.qml
//         ^^^ meta.embedded.expression.qml
//            ^^ - meta.embedded.expression.qml
//            ^ punctuation.terminator.statement.qml
//              ^^^^^^ entity.other.attribute-name.qml - meta.embedded.expression.qml
//                      ^^^ meta.embedded.expression.qml
    width: 100; height: 200;
//  ^^^^^ entity.other.attribute-name.qml
//         ^^^ meta.embedded.expression.qml
//            ^^ - meta.embedded.expression.qml
//            ^ punctuation.terminator.statement.qml
//              ^^^^^^ entity.other.attribute-name.qml - meta.embedded.expression.qml
//                      ^^^ meta.embedded.expression.qml
//                         ^ - meta.embedded.expression.qml
//                         ^ punctuation.terminator.statement.qml
    height : 480
//  ^^^^^^ entity.other.attribute-name.qml
//        ^^^ - meta.embedded.expression.qml
//           ^^^ meta.embedded.expression.qml
    color: "red"
//  ^^^^^ entity.other.attribute-name.qml
//         ^^^^^ meta.embedded.expression.qml
    color: Qt.rgba(100, 100, 100, 100)
//  ^^^^^ entity.other.attribute-name.qml
//         ^^^^^^^^^^^^^^^^^^^^^^^^^^^ meta.embedded.expression.qml
    opacity: 1.2
//  ^^^^^^^ entity.other.attribute-name.qml
//           ^^^ meta.embedded.expression.qml
    visible: true
//  ^^^^^^^ entity.other.attribute-name.qml
//           ^^^^ meta.embedded.expression.qml
    visible: false
//  ^^^^^^^ entity.other.attribute-name.qml
//           ^^^^^ meta.embedded.expression.qml
}

//------------------------------------------------------------------------------
// id
//------------------------------------------------------------------------------
Rectangle {
    id: root
//  ^^ keyword.other.id.qml - entity.other.attribute-name.qml
//      ^^^^ entity.name.variable.id.qml - meta.embedded.expression.qml
    id: root; width: 10
//  ^^ keyword.other.id.qml
//      ^^^^ entity.name.variable.id.qml
//          ^ punctuation.terminator.statement.qml
//            ^^^^^ entity.other.attribute-name.qml
    id: root // comment
//  ^^ keyword.other.id.qml
//      ^^^^ entity.name.variable.id.qml
//           ^^^^^^^^^^ comment.line.qml
    idx: 1
//  ^^^ entity.other.attribute-name.qml - keyword.other.id.qml
}

//------------------------------------------------------------------------------
// group
//------------------------------------------------------------------------------
Rectangle {
    anchors.fill: parent
//  ^^^^^^^^^^^^ entity.other.attribute-name.qml
//                ^^^^^^ meta.embedded.expression.qml
    anchors {
//  ^^^^^^^ entity.other.attribute-name.qml - meta.embedded.expression.qml
//          ^ punctuation.definition.block.qml
        left: other.right // comment
//      ^^^^ entity.other.attribute-name.qml
//            ^^^^^^^^^^^ meta.embedded.expression.qml
        right: parent.right
//      ^^^^^ entity.other.attribute-name.qml
//             ^^^^^^^^^^^^ meta.embedded.expression.qml
        // comment
        top: parent.top
//      ^^^ entity.other.attribute-name.qml
//           ^^^^^^^^^^ meta.embedded.expression.qml
    }
//  ^ punctuation.definition.block.qml
    font { bold: true; pixelSize: 12 }
//  ^^^^ entity.other.attribute-name.qml
//       ^ punctuation.definition.block.qml
//         ^^^^ entity.other.attribute-name.qml
//               ^^^^ meta.embedded.expression.qml
//                   ^ punctuation.terminator.statement.qml
//                     ^^^^^^^^^ entity.other.attribute-name.qml
//                                ^^ meta.embedded.expression.qml
//                                   ^ punctuation.definition.block.qml
}

//------------------------------------------------------------------------------
// js block
//------------------------------------------------------------------------------
Rectangle {
    width: { return 100; }
//  ^^^^^ entity.other.attribute-name.qml - meta.embedded.block.qml
//           ^^^^^^^^^^^ meta.embedded.block.qml
//                       ^ - meta.embedded.block.qml
    width: {
//  ^^^^^ entity.other.attribute-name.qml - meta.embedded.block.qml
//         ^ - meta.embedded.block.qml
        const val = 3;
//      ^^^^^^^^^^^^^^ meta.embedded.block.qml
        const result = val * 2;
//      ^^^^^^^^^^^^^^^^^^^^^^^ meta.embedded.block.qml

        // comment
        return result / Math.PI;
//      ^^^^^^^^^^^^^^^^^^^^^^^^ meta.embedded.block.qml
    }
//  ^ - meta.embedded.block.qml
}

//------------------------------------------------------------------------------
// multi-line
//------------------------------------------------------------------------------
Rectangle {
    color: Qt.rgba(
//  ^^^^^ entity.other.attribute-name.qml
//         ^^^^^^^^ meta.embedded.expression.qml
        100,
//      ^^^^ meta.embedded.expression.qml
        100,
//      ^^^^ meta.embedded.expression.qml
        100,
//      ^^^^ meta.embedded.expression.qml
        Math.random()
//      ^^^^^^^^^^^^^ meta.embedded.expression.qml
    )
//  ^ meta.embedded.expression.qml
}
// <- - meta.embedded.expression.qml

//------------------------------------------------------------------------------
// list of js expressions
//------------------------------------------------------------------------------
Rectangle {
    values: [1, 2, 3, 4]
//  ^^^^^^ entity.other.attribute-name.qml
    values: [
//  ^^^^^^ entity.other.attribute-name.qml
        1, 2, 3, 4,
        2*20, Math.PI, calc(20)
    ]
}

//------------------------------------------------------------------------------
// list of objects
//------------------------------------------------------------------------------
Rectangle {
    children: [
//  ^^^^^^^^ entity.other.attribute-name.qml
        Item { value: 1 },
//             ^^^^^ entity.other.attribute-name.qml
//                  ^^ - meta.embedded.expression.qml
//                    ^ meta.embedded.expression.qml
//                      ^ - meta.embedded.expression.qml
        Item { value: 2 },
//             ^^^^^ entity.other.attribute-name.qml
//                  ^^ - meta.embedded.expression.qml
//                    ^ meta.embedded.expression.qml
//                      ^ - meta.embedded.expression.qml
        T.Item { value: 3 }
//               ^^^^^ entity.other.attribute-name.qml
//                    ^^ - meta.embedded.expression.qml
//                      ^ meta.embedded.expression.qml
//                        ^ - meta.embedded.expression.qml
    ]
}

//------------------------------------------------------------------------------
// object case
//------------------------------------------------------------------------------
Rectangle {
    gradient: Gradient {
//  ^^^^^^^^ entity.other.attribute-name.qml
//            ^^^^^^^^ entity.name.type.object.qml
//                     ^ - entity.name.type.object.qml
//                     ^ punctuation.definition.block.qml
        GradientStop { position: 0.0; color: "yellow" }
//                     ^^^^^^^^ entity.other.attribute-name.qml - meta.embedded.expression.qml
//                             ^^ - meta.embedded.expression.qml
//                               ^^^ meta.embedded.expression.qml
//                                  ^^ - meta.embedded.expression.qml
//                                  ^ punctuation.terminator.statement.qml
//                                    ^^^^^ entity.other.attribute-name.qml - meta.embedded.expression.qml
//                                         ^^ - meta.embedded.expression.qml
//                                           ^^^^^^^^ meta.embedded.expression.qml
//                                                    ^ - meta.embedded.expression.qml
        GradientStop { position: 1.0; color: "green" }
//                     ^^^^^^^^ entity.other.attribute-name.qml - meta.embedded.expression.qml
//                             ^^ - meta.embedded.expression.qml
//                               ^^^ meta.embedded.expression.qml
//                                  ^^ - meta.embedded.expression.qml
//                                  ^ punctuation.terminator.statement.qml
//                                    ^^^^^ entity.other.attribute-name.qml - meta.embedded.expression.qml
//                                         ^^ - meta.embedded.expression.qml
//                                           ^^^^^^^ meta.embedded.expression.qml
//                                                   ^ - meta.embedded.expression.qml
    }
//  ^ punctuation.definition.block.qml
    background: T.Rectangle {}
//  ^^^^^^^^^^ entity.other.attribute-name.qml
//              ^^^^^^^^^^^ entity.name.type.object.qml
//                          ^^ - entity.name.type.object.qml
//                          ^ punctuation.definition.block.qml
//                           ^ punctuation.definition.block.qml
}

//------------------------------------------------------------------------------
// attached prop
//------------------------------------------------------------------------------
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
//                  ^^^^^^ entity.other.attribute-name.qml - meta.embedded.expression.qml
//                          ^^ meta.embedded.expression.qml

        Rectangle {
            width: 100; height: 30
//          ^^^^^ entity.other.attribute-name.qml
//                 ^^^ meta.embedded.expression.qml
//                    ^^ - meta.embedded.expression.qml
//                    ^ punctuation.terminator.statement.qml
//                      ^^^^^^ entity.other.attribute-name.qml - meta.embedded.expression.qml
//                              ^^ meta.embedded.expression.qml
            color: _delegate.ListView.isCurrentItem ? "red" : "yellow" // correct
//          ^^^^^ entity.other.attribute-name.qml
//                 ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^ meta.embedded.expression.qml
        }
    }
//  ^ punctuation.definition.block.qml
}

//------------------------------------------------------------------------------
// delimiters inside JS
//------------------------------------------------------------------------------
Rectangle {
    text: "a;b"
//  ^^^^ entity.other.attribute-name.qml
//        ^^^^^ meta.embedded.expression.qml
    text: "a}b"
//  ^^^^ entity.other.attribute-name.qml
//        ^^^^^ meta.embedded.expression.qml
    value: ({ a: 1 })
//  ^^^^^ entity.other.attribute-name.qml
//         ^^^^^^^^^^ meta.embedded.expression.qml
    handler: () => { return 1 }
//  ^^^^^^^ entity.other.attribute-name.qml
//           ^^^^^^^^^^^^^^^^^^ meta.embedded.expression.qml
    width: { return "}"; }
//  ^^^^^ entity.other.attribute-name.qml
//           ^^^^^^^^^^^ meta.embedded.block.qml
//                       ^ - meta.embedded.block.qml
}

//------------------------------------------------------------------------------
// end of file: every object above is closed
//------------------------------------------------------------------------------
// end
// <------ - meta.object.qml
