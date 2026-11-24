// SYNTAX TEST "source.qml" "signal handlers"
// Copyright (C) 2024 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

//------------------------------------------------------------------------------
// prop. changed signal handler
//------------------------------------------------------------------------------
Rectangle {
    onWidthChanged: _rect.pressed()
//  ^^^^^^^^^^^^^^ variable.parameter.attr-expr.qml - meta.embedded.expression.qml
//                  ^^^^^^^^^^^^^^^ meta.embedded.expression.qml
    onWidthChanged: {
//  ^^^^^^^^^^^^^^ variable.parameter.attr-block.qml - meta.embedded.block.qml
        console.log(`width changed to ${_rect.width}`)
//      ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^ meta.embedded.block.qml
    }
//  ^ - meta.embedded.block.qml
}

//------------------------------------------------------------------------------
// item specific signal handler
//------------------------------------------------------------------------------
Rectangle {
    MouseArea {
        onClicked: (mouse) => {
//      ^^^^^^^^^ variable.parameter.attr-expr.qml - meta.embedded.expression.qml
//                 ^^^^^^^^^^^^ meta.embedded.expression.qml
            console.log("clicked")
//          ^^^^^^^^^^^^^^^^^^^^^^ meta.embedded.expression.qml
            _rect.clickedAt(mouse.x, mouse.y)
//          ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^ meta.embedded.expression.qml
        }
//      ^ meta.embedded.expression.qml
    }
}

//------------------------------------------------------------------------------
// attached signal handler
//------------------------------------------------------------------------------
Rectangle {
    Keys.onLeftPressed: console.log("move left")
//  ^^^^^^^^^^^^^^^^^^ variable.parameter.attr-expr.qml - meta.embedded.expression.qml
//                      ^^^^^^^^^^^^^^^^^^^^^^^^ meta.embedded.expression.qml

    Keys.onPressed: (event) => {
//  ^^^^^^^^^^^^^^ variable.parameter.attr-expr.qml - meta.embedded.expression.qml
//                  ^^^^^^^^^^^^ meta.embedded.expression.qml
        if (event.key == Qt.Key_Left) {
//      ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^ meta.embedded.expression.qml
            console.log("move left");
//          ^^^^^^^^^^^^^^^^^^^^^^^^^ meta.embedded.expression.qml
            event.accepted = true;
//          ^^^^^^^^^^^^^^^^^^^^^^ meta.embedded.expression.qml
        }
//      ^ meta.embedded.expression.qml
    }
//  ^ meta.embedded.expression.qml

    Component.onCompleted: {
//  ^^^^^^^^^^^^^^^^^^^^^ variable.parameter.attr-block.qml - meta.embedded.block.qml
        console.log("onCompleted")
//      ^^^^^^^^^^^^^^^^^^^^^^^^^^ meta.embedded.block.qml
    }
//  ^ - meta.embedded.block.qml
}

//------------------------------------------------------------------------------
// arrow function without parameters
//------------------------------------------------------------------------------
Rectangle {
    Component.onCompleted: () => {
//  ^^^^^^^^^^^^^^^^^^^^^ variable.parameter.attr-expr.qml - meta.embedded.expression.qml
//                         ^^^^^^^ meta.embedded.expression.qml
        console.log("aaa");
//      ^^^^^^^^^^^^^^^^^^^ meta.embedded.expression.qml
    }
//  ^ meta.embedded.expression.qml
}

//------------------------------------------------------------------------------
// arrow function without (), {}
//------------------------------------------------------------------------------
Rectangle {
    MouseArea {
        onPressed: mouse => root.activated(mouse.x, mouse.y)
//      ^^^^^^^^^ variable.parameter.attr-expr.qml - meta.embedded.expression.qml
//                 ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^ meta.embedded.expression.qml
    }
}

//------------------------------------------------------------------------------
// function expression
//------------------------------------------------------------------------------
Rectangle {
    onClicked: function(mouse) {
//  ^^^^^^^^^ variable.parameter.attr-expr.qml - meta.embedded.expression.qml
//             ^^^^^^^^^^^^^^^^^ meta.embedded.expression.qml
        console.log(mouse)
//      ^^^^^^^^^^^^^^^^^^ meta.embedded.expression.qml
    }
//  ^ meta.embedded.expression.qml
    width: 10
//  ^^^^^ variable.parameter.attr-expr.qml - meta.embedded.expression.qml
//         ^^ meta.embedded.expression.qml
}

//------------------------------------------------------------------------------
// single line arrow function and attached property
//------------------------------------------------------------------------------
Rectangle {
    Layout.fillWidth: true
//  ^^^^^^^^^^^^^^^^ variable.parameter.attr-expr.qml - meta.embedded.expression.qml
//                    ^^^^ meta.embedded.expression.qml
    Keys.onPressed: (event) => { event.accepted = true }
//  ^^^^^^^^^^^^^^ variable.parameter.attr-expr.qml - meta.embedded.expression.qml
//                  ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^ meta.embedded.expression.qml
    height: 20
//  ^^^^^^ variable.parameter.attr-expr.qml - meta.embedded.expression.qml
//          ^^ meta.embedded.expression.qml
}

//------------------------------------------------------------------------------
// function declaration in Connections
//------------------------------------------------------------------------------
Rectangle {
    Connections {
        target: _rect
//      ^^^^^^ variable.parameter.attr-expr.qml - meta.embedded.expression.qml
//              ^^^^^ meta.embedded.expression.qml
        function onClicked(mouse) { }
//      ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^ meta.embedded.function.qml
    }
    width: 10
//  ^^^^^ variable.parameter.attr-expr.qml - meta.embedded.expression.qml
//         ^^ meta.embedded.expression.qml
}

//------------------------------------------------------------------------------
// end of file: every object above is closed
//------------------------------------------------------------------------------
// end
// <------ - meta.object.qml
