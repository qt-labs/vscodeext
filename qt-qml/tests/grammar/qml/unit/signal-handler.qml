// SYNTAX TEST "source.qml" "signal handlers"
// Copyright (C) 2024 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

//------------------------------------------------------------------------------
// expression and block handlers
//------------------------------------------------------------------------------
Rectangle {
    onWidthChanged: _rect.pressed()
//  ^^^^^^^^^^^^^^ entity.other.attribute-name.qml
//  ^^^^^^^^^^^^^^ - meta.embedded.expression.qml
//  ^^^^^^^^^^^^^^ entity.name.function.handler.qml
//  ^^^^^^^^^^^^^^ meta.doc.member.widthChanged.qml
//                  ^^^^^^^^^^^^^^^ meta.embedded.expression.qml
    onWidthChanged: {
//  ^^^^^^^^^^^^^^ entity.other.attribute-name.qml
//  ^^^^^^^^^^^^^^ - meta.embedded.block.qml
//  ^^^^^^^^^^^^^^ entity.name.function.handler.qml
        console.log(`width changed to ${_rect.width}`)
//      ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^ meta.embedded.block.qml
    }
//  ^ - meta.embedded.block.qml
}

//------------------------------------------------------------------------------
// multi-line arrow function
//------------------------------------------------------------------------------
Rectangle {
    MouseArea {
        onClicked: (mouse) => {
//      ^^^^^^^^^ entity.other.attribute-name.qml
//      ^^^^^^^^^ - meta.embedded.expression.qml
//      ^^^^^^^^^ meta.doc.member.clicked.qml
//      ^^^^^^^^^ entity.name.function.handler.qml
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
// function expression
//------------------------------------------------------------------------------
Rectangle {
    onClicked: function(mouse) {
//  ^^^^^^^^^ entity.other.attribute-name.qml
//  ^^^^^^^^^ - meta.embedded.expression.qml
//  ^^^^^^^^^ entity.name.function.handler.qml
//             ^^^^^^^^^^^^^^^^^ meta.embedded.expression.qml
        console.log(mouse)
//      ^^^^^^^^^^^^^^^^^^ meta.embedded.expression.qml
    }
//  ^ meta.embedded.expression.qml
    width: 10
//  ^^^^^ entity.other.attribute-name.qml
//  ^^^^^ - meta.embedded.expression.qml
//         ^^ meta.embedded.expression.qml
}

//------------------------------------------------------------------------------
// attached signal handler
//------------------------------------------------------------------------------
Rectangle {
    Keys.onLeftPressed: console.log("move left")
//  ^^^^^^^^^^^^^^^^^^ entity.other.attribute-name.qml
//  ^^^^^^^^^^^^^^^^^^ - meta.embedded.expression.qml
//       ^^^^^^^^^^^^^ entity.name.function.handler.qml
//                      ^^^^^^^^^^^^^^^^^^^^^^^^ meta.embedded.expression.qml

    Keys.onPressed: (event) => {
//  ^^^^^^^^^^^^^^ entity.other.attribute-name.qml
//  ^^^^^^^^^^^^^^ - meta.embedded.expression.qml
//       ^^^^^^^^^ entity.name.function.handler.qml
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
//  ^^^^^^^^^^^^^^^^^^^^^ entity.other.attribute-name.qml
//  ^^^^^^^^^^^^^^^^^^^^^ - meta.embedded.block.qml
//            ^^^^^^^^^^^ entity.name.function.handler.qml
        console.log("onCompleted")
//      ^^^^^^^^^^^^^^^^^^^^^^^^^^ meta.embedded.block.qml
    }
//  ^ - meta.embedded.block.qml
}

//------------------------------------------------------------------------------
// single line arrow function and attached property
//------------------------------------------------------------------------------
Rectangle {
    Layout.fillWidth: true
//  ^^^^^^^^^^^^^^^^ entity.other.attribute-name.qml
//  ^^^^^^^^^^^^^^^^ - meta.embedded.expression.qml
//                    ^^^^ meta.embedded.expression.qml
    Keys.onPressed: (event) => { event.accepted = true }
//  ^^^^^^^^^^^^^^ entity.other.attribute-name.qml
//  ^^^^^^^^^^^^^^ - meta.embedded.expression.qml
//       ^^^^^^^^^ entity.name.function.handler.qml
//                  ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^ meta.embedded.expression.qml
    height: 20
//  ^^^^^^ entity.other.attribute-name.qml
//  ^^^^^^ - meta.embedded.expression.qml
//          ^^ meta.embedded.expression.qml
}

//------------------------------------------------------------------------------
// function declaration in Connections
//------------------------------------------------------------------------------
Rectangle {
    Connections {
        target: _rect
//      ^^^^^^ entity.other.attribute-name.qml
//      ^^^^^^ - meta.embedded.expression.qml
//              ^^^^^ meta.embedded.expression.qml
        function onClicked(mouse) { }
//      ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^ meta.embedded.function.qml
    }
    width: 10
//  ^^^^^ entity.other.attribute-name.qml
//  ^^^^^ - meta.embedded.expression.qml
//         ^^ meta.embedded.expression.qml
}

//------------------------------------------------------------------------------
// names that are not handlers
//------------------------------------------------------------------------------
Rectangle {
    onlyOne: 1
//  ^^^^^^^ entity.other.attribute-name.qml
//  ^^^^^^^ - entity.name.function.handler.qml
    buttonOnClick: 1
//  ^^^^^^^^^^^^^ entity.other.attribute-name.qml
//  ^^^^^^^^^^^^^ - entity.name.function.handler.qml
}

//------------------------------------------------------------------------------
// end of file: every object above is closed
//------------------------------------------------------------------------------
// end
// <------ - meta.object.qml
