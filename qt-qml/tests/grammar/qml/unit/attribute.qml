// SYNTAX TEST "source.qml" "attributes"
// Copyright (C) 2024 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

//------------------------------------------------------------------------------
// js expression
//------------------------------------------------------------------------------
Rectangle {
    width: 100 * 2;
//  ^^^^^ variable.parameter.attr-expr.qml - meta.embedded.expression.qml
//       ^^ - meta.embedded.expression.qml
//         ^^^^^^^ meta.embedded.expression.qml
//                ^ - meta.embedded.expression.qml
    width: height / 2
//  ^^^^^ variable.parameter.attr-expr.qml
//         ^^^^^^^^^^ meta.embedded.expression.qml
    width: 100
//  ^^^^^ variable.parameter.attr-expr.qml
//         ^^^ meta.embedded.expression.qml
    width: 100;
//  ^^^^^ variable.parameter.attr-expr.qml
//         ^^^ meta.embedded.expression.qml
//            ^ - meta.embedded.expression.qml
    width: 100; height: 200
//  ^^^^^ variable.parameter.attr-expr.qml
//         ^^^ meta.embedded.expression.qml
//            ^^ - meta.embedded.expression.qml
//              ^^^^^^ variable.parameter.attr-expr.qml - meta.embedded.expression.qml
//                      ^^^ meta.embedded.expression.qml
    width: 100; height: 200;
//  ^^^^^ variable.parameter.attr-expr.qml
//         ^^^ meta.embedded.expression.qml
//            ^^ - meta.embedded.expression.qml
//              ^^^^^^ variable.parameter.attr-expr.qml - meta.embedded.expression.qml
//                      ^^^ meta.embedded.expression.qml
//                         ^ - meta.embedded.expression.qml
    height : 480
//  ^^^^^^ variable.parameter.attr-expr.qml
//        ^^^ - meta.embedded.expression.qml
//           ^^^ meta.embedded.expression.qml
    color: "red"
//  ^^^^^ variable.parameter.attr-expr.qml
//         ^^^^^ meta.embedded.expression.qml
    color: Qt.rgba(100, 100, 100, 100)
//  ^^^^^ variable.parameter.attr-expr.qml
//         ^^^^^^^^^^^^^^^^^^^^^^^^^^^ meta.embedded.expression.qml
    opacity: 1.2
//  ^^^^^^^ variable.parameter.attr-expr.qml
//           ^^^ meta.embedded.expression.qml
    visible: true
//  ^^^^^^^ variable.parameter.attr-expr.qml
//           ^^^^ meta.embedded.expression.qml
    visible: false
//  ^^^^^^^ variable.parameter.attr-expr.qml
//           ^^^^^ meta.embedded.expression.qml
}

//------------------------------------------------------------------------------
// group
//------------------------------------------------------------------------------
Rectangle {
    anchors.fill: parent
//  ^^^^^^^^^^^^ variable.parameter.attr-expr.qml
//                ^^^^^^ meta.embedded.expression.qml
    anchors {
//  ^^^^^^^ variable.parameter.attr-group-notation.qml - meta.embedded.expression.qml
        left: other.right // comment
//      ^^^^ variable.parameter.attr-expr.qml
//            ^^^^^^^^^^^ meta.embedded.expression.qml
        right: parent.right
//      ^^^^^ variable.parameter.attr-expr.qml
//             ^^^^^^^^^^^^ meta.embedded.expression.qml
        // comment
        top: parent.top
//      ^^^ variable.parameter.attr-expr.qml
//           ^^^^^^^^^^ meta.embedded.expression.qml
    }
}

//------------------------------------------------------------------------------
// js block
//------------------------------------------------------------------------------
Rectangle {
    width: { return 100; }
//  ^^^^^ variable.parameter.attr-block.qml - meta.embedded.block.qml
//           ^^^^^^^^^^^ meta.embedded.block.qml
//                       ^ - meta.embedded.block.qml
    width: {
//  ^^^^^ variable.parameter.attr-block.qml - meta.embedded.block.qml
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
//  ^^^^^ variable.parameter.attr-expr.qml
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
//  ^^^^^^ variable.parameter.attr-list.qml
    values: [
//  ^^^^^^ variable.parameter.attr-list.qml
        1, 2, 3, 4,
        2*20, Math.PI, calc(20)
    ]
}

//------------------------------------------------------------------------------
// list of objects
//------------------------------------------------------------------------------
Rectangle {
    children: [
//  ^^^^^^^^ variable.parameter.attr-list.qml
        Item { value: 1 },
//             ^^^^^ variable.parameter.attr-expr.qml
//                  ^^ - meta.embedded.expression.qml
//                    ^ meta.embedded.expression.qml
//                      ^ - meta.embedded.expression.qml
        Item { value: 2 },
//             ^^^^^ variable.parameter.attr-expr.qml
//                  ^^ - meta.embedded.expression.qml
//                    ^ meta.embedded.expression.qml
//                      ^ - meta.embedded.expression.qml
        T.Item { value: 3 }
//               ^^^^^ variable.parameter.attr-expr.qml
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
//  ^^^^^^^^ variable.parameter.attr-object.qml
//            ^^^^^^^^ entity.name.type.object.qml
//                     ^ - entity.name.type.object.qml
        GradientStop { position: 0.0; color: "yellow" }
//                     ^^^^^^^^ variable.parameter.attr-expr.qml - meta.embedded.expression.qml
//                             ^^ - meta.embedded.expression.qml
//                               ^^^ meta.embedded.expression.qml
//                                  ^^ - meta.embedded.expression.qml
//                                    ^^^^^ variable.parameter.attr-expr.qml - meta.embedded.expression.qml
//                                         ^^ - meta.embedded.expression.qml
//                                           ^^^^^^^^ meta.embedded.expression.qml
//                                                    ^ - meta.embedded.expression.qml
        GradientStop { position: 1.0; color: "green" }
//                     ^^^^^^^^ variable.parameter.attr-expr.qml - meta.embedded.expression.qml
//                             ^^ - meta.embedded.expression.qml
//                               ^^^ meta.embedded.expression.qml
//                                  ^^ - meta.embedded.expression.qml
//                                    ^^^^^ variable.parameter.attr-expr.qml - meta.embedded.expression.qml
//                                         ^^ - meta.embedded.expression.qml
//                                           ^^^^^^^ meta.embedded.expression.qml
//                                                   ^ - meta.embedded.expression.qml
    }
    background: T.Rectangle {}
//  ^^^^^^^^^^ variable.parameter.attr-object.qml
//              ^^^^^^^^^^^ entity.name.type.object.qml
//                          ^^ - entity.name.type.object.qml
}

//------------------------------------------------------------------------------
// attached prop
//------------------------------------------------------------------------------
ListView {
    delegate: Item {
//  ^^^^^^^^ variable.parameter.attr-object.qml
//            ^^^^ entity.name.type.object.qml
//                 ^ - entity.name.type.object.qml
        id: _delegate
//      ^^ variable.parameter.attr-expr.qml
//          ^^^^^^^^^ meta.embedded.expression.qml
        width: 100; height: 30
//      ^^^^^ variable.parameter.attr-expr.qml
//             ^^^ meta.embedded.expression.qml
//                ^^ - meta.embedded.expression.qml
//                  ^^^^^^ variable.parameter.attr-expr.qml - meta.embedded.expression.qml
//                          ^^ meta.embedded.expression.qml

        Rectangle {
            width: 100; height: 30
//          ^^^^^ variable.parameter.attr-expr.qml
//                 ^^^ meta.embedded.expression.qml
//                    ^^ - meta.embedded.expression.qml
//                      ^^^^^^ variable.parameter.attr-expr.qml - meta.embedded.expression.qml
//                              ^^ meta.embedded.expression.qml
            color: _delegate.ListView.isCurrentItem ? "red" : "yellow" // correct
//          ^^^^^ variable.parameter.attr-expr.qml
//                 ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^ meta.embedded.expression.qml
        }
    }
}

//------------------------------------------------------------------------------
// delimiters inside JS
//------------------------------------------------------------------------------
Rectangle {
    text: "a;b"
//  ^^^^ variable.parameter.attr-expr.qml
//        ^^^^^ meta.embedded.expression.qml
    text: "a}b"
//  ^^^^ variable.parameter.attr-expr.qml
//        ^^^^^ meta.embedded.expression.qml
    value: ({ a: 1 })
//  ^^^^^ variable.parameter.attr-expr.qml
//         ^^^^^^^^^^ meta.embedded.expression.qml
    handler: () => { return 1 }
//  ^^^^^^^ variable.parameter.attr-expr.qml
//           ^^^^^^^^^^^^^^^^^^ meta.embedded.expression.qml
    width: { return "}"; }
//  ^^^^^ variable.parameter.attr-block.qml
//           ^^^^^^^^^^^ meta.embedded.block.qml
//                       ^ - meta.embedded.block.qml
}
