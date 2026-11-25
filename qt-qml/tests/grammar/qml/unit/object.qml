// SYNTAX TEST "source.qml" "object declarations"
// Copyright (C) 2024 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

//------------------------------------------------------------------------------
// single line
//------------------------------------------------------------------------------
Window {
// <------ entity.name.type.object.qml
//     ^ punctuation.definition.block.qml
// <-------- meta.object.qml
    Rectangle { width: 100; height: 100 }
//  ^^^^^^^^^ entity.name.type.object.qml
//            ^ punctuation.definition.block.qml
//                        ^ punctuation.terminator.statement.qml
//                                      ^ punctuation.definition.block.qml
//  ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^ meta.object.qml
}
// <- punctuation.definition.block.qml
// <- meta.object.qml

//------------------------------------------------------------------------------
// brace on the next line
//------------------------------------------------------------------------------
Window {
// <------ entity.name.type.object.qml
//     ^ punctuation.definition.block.qml
// <-------- meta.object.qml
    Rectangle
//  ^^^^^^^^^ entity.name.type.object.qml
//  ^^^^^^^^^ meta.object.qml
    {
//  ^ punctuation.definition.block.qml
//  ^ meta.object.qml
        width: 100
//      ^^^^^ entity.other.attribute-name.qml
//             ^^^ - entity.name.type.object.qml
//      ^^^^^^^^^^ meta.object.qml
        height: 100
//      ^^^^^^ entity.other.attribute-name.qml
//              ^^^ - entity.name.type.object.qml
//      ^^^^^^^^^^^ meta.object.qml
    }
//  ^ punctuation.definition.block.qml
//  ^ meta.object.qml
}
// <- punctuation.definition.block.qml
// <- meta.object.qml

//------------------------------------------------------------------------------
// nesting
//------------------------------------------------------------------------------
Window {
// <------ entity.name.type.object.qml
//     ^ punctuation.definition.block.qml
// <-------- meta.object.qml
    Rectangle {
//  ^^^^^^^^^ entity.name.type.object.qml
//            ^ punctuation.definition.block.qml
//  ^^^^^^^^^^^ meta.object.qml
        width: 100
//      ^^^^^ entity.other.attribute-name.qml
//             ^^^ - entity.name.type.object.qml
//      ^^^^^^^^^^ meta.object.qml
        height: 100
//      ^^^^^^ entity.other.attribute-name.qml
//              ^^^ - entity.name.type.object.qml
//      ^^^^^^^^^^^ meta.object.qml

        Text {
//      ^^^^ entity.name.type.object.qml
//           ^ punctuation.definition.block.qml
//      ^^^^^^ meta.object.qml
            width: 100
//          ^^^^^ entity.other.attribute-name.qml
//                 ^^^ - entity.name.type.object.qml
//          ^^^^^^^^^^ meta.object.qml
            height: 100
//          ^^^^^^ entity.other.attribute-name.qml
//                  ^^^ - entity.name.type.object.qml
//          ^^^^^^^^^^^ meta.object.qml
        }
//      ^ punctuation.definition.block.qml
//      ^ meta.object.qml
    }
//  ^ punctuation.definition.block.qml
//  ^ meta.object.qml
}
// <- punctuation.definition.block.qml
// <- meta.object.qml

//------------------------------------------------------------------------------
// object within namespace
//------------------------------------------------------------------------------
Window {
// <------ entity.name.type.object.qml
//     ^ punctuation.definition.block.qml
// <-------- meta.object.qml
    MyModule.Text {
//  ^^^^^^^^^^^^^ entity.name.type.object.qml
//                ^ punctuation.definition.block.qml
//  ^^^^^^^^^^^^^^^ meta.object.qml
        text: "Hello from my custom text item!"
//      ^^^^ entity.other.attribute-name.qml
//            ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^ - entity.name.type.object.qml
//      ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^ meta.object.qml
    }
//  ^ punctuation.definition.block.qml
//  ^ meta.object.qml
}
// <- punctuation.definition.block.qml
// <- meta.object.qml

//------------------------------------------------------------------------------
// empty object and no space before brace
//------------------------------------------------------------------------------
Item {
// <---- entity.name.type.object.qml
//   ^ punctuation.definition.block.qml
// <------ meta.object.qml
    Item {}
//  ^^^^ entity.name.type.object.qml
//       ^ punctuation.definition.block.qml
//        ^ punctuation.definition.block.qml
//  ^^^^^^^ meta.object.qml
    Item{ width: 1 }
//  ^^^^ entity.name.type.object.qml
//      ^ punctuation.definition.block.qml
//                 ^ punctuation.definition.block.qml
//  ^^^^^^^^^^^^^^^^ meta.object.qml
}
// <- punctuation.definition.block.qml
// <- meta.object.qml

//------------------------------------------------------------------------------
// attribute value ending with a type name
//------------------------------------------------------------------------------
Item {
// <---- entity.name.type.object.qml
//   ^ punctuation.definition.block.qml
// <------ meta.object.qml
    x: Foo
//  ^ entity.other.attribute-name.qml
//     ^^^ - entity.name.type.object.qml
//  ^^^^^^ meta.object.qml
    y: Qt.AlignLeft
//  ^ entity.other.attribute-name.qml
//     ^^^^^^^^^^^^ - entity.name.type.object.qml
//  ^^^^^^^^^^^^^^^ meta.object.qml
    width: 10
//  ^^^^^ entity.other.attribute-name.qml
//         ^^ - entity.name.type.object.qml
//  ^^^^^^^^^ meta.object.qml
}
// <- punctuation.definition.block.qml
// <- meta.object.qml

//------------------------------------------------------------------------------
// invalid import and pragma inside an object
//------------------------------------------------------------------------------
Item {
    import QtQuick
//         ^^^^^^^ - entity.name.type.object.qml
    pragma Singleton
//         ^^^^^^^^^ - entity.name.type.object.qml
    width: 10
//  ^^^^^ entity.other.attribute-name.qml
}

//------------------------------------------------------------------------------
// type name alone, as while typing
//------------------------------------------------------------------------------
Item {
    Rectangle
//  ^^^^^^^^^ entity.name.type.object.qml
    width: 10
//  ^^^^^ entity.other.attribute-name.qml
}

//------------------------------------------------------------------------------
// type name in the object scope
//------------------------------------------------------------------------------
Window {
// <-------- meta.object.type.Window.qml
    Rectangle { width: 100 }
//              ^^^^^ meta.object.type.Rectangle.qml
//              ^^^^^ meta.object.type.Window.qml
    width: 100
//  ^^^^^ meta.object.type.Window.qml
//  ^^^^^ - meta.object.type.Rectangle.qml
    T.Button { }
//  ^^^^^^^^^^^^ meta.object.type.T.Button.qml
    Behavior on x { }
//  ^^^^^^^^^^^^^^^^^ meta.object.type.Behavior.qml
}

// the brace on the next line
Window
// <------ meta.object.type.Window.qml
{
// <- meta.object.type.Window.qml
    Rectangle // comment
//  ^^^^^^^^^^^^^^^^^^^^ meta.object.type.Rectangle.qml
    // comment
//  ^^^^^^^^^^ meta.object.type.Rectangle.qml
    {
//  ^ meta.object.type.Rectangle.qml
        width: 100
//      ^^^^^ meta.object.type.Rectangle.qml
//      ^^^^^ meta.object.type.Window.qml
    }
//  ^ meta.object.type.Rectangle.qml
    height: 100
//  ^^^^^^ meta.object.type.Window.qml
//  ^^^^^^ - meta.object.type.Rectangle.qml
    Behavior on x
//  ^^^^^^^^^^^^^ meta.object.type.Behavior.qml
    {
        enabled: true
//      ^^^^^^^ meta.object.type.Behavior.qml
    }
    opacity: 1
//  ^^^^^^^ - meta.object.type.Behavior.qml
}
// <- meta.object.type.Window.qml

// the type name alone: the scope ends before the next attribute
Item {
    Rectangle
//  ^^^^^^^^^ meta.object.type.Rectangle.qml
    width: 10
//  ^^^^^ - meta.object.type.Rectangle.qml
//  ^^^^^ meta.object.type.Item.qml
}

//------------------------------------------------------------------------------
// end of file: every object above is closed
//------------------------------------------------------------------------------
// end
// <----- - meta.object.qml
