// SYNTAX TEST "source.qml" "property declarations"
// Copyright (C) 2024 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

// [default] [required] [readonly] property <propertyType> <propertyName>
// https://doc.qt.io/qt-6/qtqml-syntax-objectattributes.html

//------------------------------------------------------------------------------
// types
//------------------------------------------------------------------------------
Item {
    property int height: 0
//  ^^^^^^^^ storage.type.property.qml
//           ^^^ storage.type.primitive.qml
//               ^^^^^^ entity.other.attribute-name.qml
//  ^^^^^^^^^^^^^^^^^^^^^^ meta.property.qml
    property int height : 0
//  ^^^^^^^^ storage.type.property.qml
//           ^^^ storage.type.primitive.qml
//               ^^^^^^ entity.other.attribute-name.qml
//  ^^^^^^^^^^^^^^^^^^^^^^^ meta.property.qml
    property string name: "abcd"
//  ^^^^^^^^ storage.type.property.qml
//           ^^^^^^ storage.type.primitive.qml
//                  ^^^^ entity.other.attribute-name.qml
//  ^^^^^^^^^^^^^^^^^^^^^^^^^^^^ meta.property.qml
    property color color: "#121212" // comment
//  ^^^^^^^^ storage.type.property.qml
//           ^^^^^ storage.type.primitive.qml
//                 ^^^^^ entity.other.attribute-name.qml
//                                  ^^^^^^^^^^ comment.line.qml - meta.property.qml
//  ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^ meta.property.qml
    property point value: Qt.point(1, 2)
//  ^^^^^^^^ storage.type.property.qml
//           ^^^^^ storage.type.primitive.qml
//                 ^^^^^ entity.other.attribute-name.qml
//  ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^ meta.property.qml
    property alias text: _text.text
//  ^^^^^^^^ storage.type.property.qml
//           ^^^^^ keyword.other.alias.qml
//                 ^^^^ entity.other.attribute-name.qml
//  ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^ meta.property.qml
    property T.Button btn
//  ^^^^^^^^ storage.type.property.qml
//           ^^^^^^^^ entity.name.type.qml
//                    ^^^ entity.other.attribute-name.qml
//  ^^^^^^^^^^^^^^^^^^^^^ meta.property.qml
    property list<T.Item> items
//  ^^^^^^^^ storage.type.property.qml
//           ^^^^ storage.type.primitive.qml
//               ^ punctuation.definition.typeparameters.begin.qml
//                ^^^^^^ entity.name.type.qml
//                      ^ punctuation.definition.typeparameters.end.qml
//                        ^^^^^ entity.other.attribute-name.qml
//  ^^^^^^^^^^^^^^^^^^^^^^^^^^^ meta.property.qml
}

//------------------------------------------------------------------------------
// modifiers
//------------------------------------------------------------------------------
Item {
    default property var someText
//  ^^^^^^^ storage.modifier.qml
//         ^ - storage.modifier.qml
//          ^^^^^^^^ storage.type.property.qml
//                   ^^^ storage.type.primitive.qml
//                       ^^^^^^^^ entity.other.attribute-name.qml
//  ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^ meta.property.qml
    required property int point
//  ^^^^^^^^ storage.modifier.qml
//          ^ - storage.modifier.qml
//           ^^^^^^^^ storage.type.property.qml
//                    ^^^ storage.type.primitive.qml
//                        ^^^^^ entity.other.attribute-name.qml
//  ^^^^^^^^^^^^^^^^^^^^^^^^^^^ meta.property.qml
    readonly property color myvalue: Qt.rgba(1, 1, 1, 1)
//  ^^^^^^^^ storage.modifier.qml
//          ^ - storage.modifier.qml
//           ^^^^^^^^ storage.type.property.qml
//                    ^^^^^ storage.type.primitive.qml
//                          ^^^^^^^ entity.other.attribute-name.qml
//  ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^ meta.property.qml
    final property int a: 1
//  ^^^^^ storage.modifier.qml
//       ^ - storage.modifier.qml
//        ^^^^^^^^ storage.type.property.qml
//                 ^^^ storage.type.primitive.qml
//                     ^ entity.other.attribute-name.qml
//  ^^^^^^^^^^^^^^^^^^^^^^^ meta.property.qml
    virtual property int b: 1
//  ^^^^^^^ storage.modifier.qml
//         ^ - storage.modifier.qml
//          ^^^^^^^^ storage.type.property.qml
//                   ^^^ storage.type.primitive.qml
//                       ^ entity.other.attribute-name.qml
//  ^^^^^^^^^^^^^^^^^^^^^^^^^ meta.property.qml
    override property int c: 1
//  ^^^^^^^^ storage.modifier.qml
//          ^ - storage.modifier.qml
//           ^^^^^^^^ storage.type.property.qml
//                    ^^^ storage.type.primitive.qml
//                        ^ entity.other.attribute-name.qml
//  ^^^^^^^^^^^^^^^^^^^^^^^^^^ meta.property.qml
    default required property Item content
//  ^^^^^^^ storage.modifier.qml
//         ^ - storage.modifier.qml
//          ^^^^^^^^ storage.modifier.qml
//                  ^ - storage.modifier.qml
//                   ^^^^^^^^ storage.type.property.qml
//                            ^^^^ entity.name.type.qml
//                                 ^^^^^^^ entity.other.attribute-name.qml
//  ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^ meta.property.qml
    required default property Item content2
//  ^^^^^^^^ storage.modifier.qml
//          ^ - storage.modifier.qml
//           ^^^^^^^ storage.modifier.qml
//                  ^ - storage.modifier.qml
//                   ^^^^^^^^ storage.type.property.qml
//                            ^^^^ entity.name.type.qml
//                                 ^^^^^^^^ entity.other.attribute-name.qml
//  ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^ meta.property.qml
}

//------------------------------------------------------------------------------
// without initial value
//------------------------------------------------------------------------------
Item {
    property color nextColor
//  ^^^^^^^^ storage.type.property.qml
//           ^^^^^ storage.type.primitive.qml
//                 ^^^^^^^^^ entity.other.attribute-name.qml
//  ^^^^^^^^^^^^^^^^^^^^^^^^ meta.property.qml
    property list<int> value
//  ^^^^^^^^ storage.type.property.qml
//           ^^^^ storage.type.primitive.qml
//               ^ punctuation.definition.typeparameters.begin.qml
//                ^^^ storage.type.primitive.qml
//                   ^ punctuation.definition.typeparameters.end.qml
//                     ^^^^^ entity.other.attribute-name.qml
//  ^^^^^^^^^^^^^^^^^^^^^^^^ meta.property.qml
    property int x // comment
//  ^^^^^^^^ storage.type.property.qml
//           ^^^ storage.type.primitive.qml
//               ^ entity.other.attribute-name.qml
//                 ^^^^^^^^^^ comment.line.qml
//                 ^^^^^^^^^^ - meta.property.qml
//  ^^^^^^^^^^^^^^ meta.property.qml
    property int y;
//  ^^^^^^^^ storage.type.property.qml
//           ^^^ storage.type.primitive.qml
//               ^ entity.other.attribute-name.qml
//                ^ punctuation.terminator.statement.qml
//  ^^^^^^^^^^^^^^^ meta.property.qml
    property int z: 1; width: 10
//  ^^^^^^^^ storage.type.property.qml
//           ^^^ storage.type.primitive.qml
//               ^ entity.other.attribute-name.qml
//                   ^ punctuation.terminator.statement.qml
//                     ^^^^^^^^^ - meta.property.qml
//                     ^^^^^ entity.other.attribute-name.qml
//  ^^^^^^^^^^^^^^^^^^ meta.property.qml
}

//------------------------------------------------------------------------------
// list values
//------------------------------------------------------------------------------
Item {
    property list<int> value: [1, 2, 3, 4]
//  ^^^^^^^^ storage.type.property.qml
//           ^^^^ storage.type.primitive.qml
//               ^ punctuation.definition.typeparameters.begin.qml
//                ^^^ storage.type.primitive.qml
//                   ^ punctuation.definition.typeparameters.end.qml
//                     ^^^^^ entity.other.attribute-name.qml
//  ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^ meta.property.qml
    readonly property list<T.Item> items2: []
//  ^^^^^^^^ storage.modifier.qml
//          ^ - storage.modifier.qml
//           ^^^^^^^^ storage.type.property.qml
//                    ^^^^ storage.type.primitive.qml
//                        ^ punctuation.definition.typeparameters.begin.qml
//                         ^^^^^^ entity.name.type.qml
//                               ^ punctuation.definition.typeparameters.end.qml
//                                 ^^^^^^ entity.other.attribute-name.qml
//  ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^ meta.property.qml
    property list<int> value: [
//  ^^^^^^^^ storage.type.property.qml
//           ^^^^ storage.type.primitive.qml
//               ^ punctuation.definition.typeparameters.begin.qml
//                ^^^ storage.type.primitive.qml
//                   ^ punctuation.definition.typeparameters.end.qml
//                     ^^^^^ entity.other.attribute-name.qml
//  ^^^^^^^^^^^^^^^^^^^^^^^^^^^ meta.property.qml
        1, 2, 3, 4
//      ^^^^^^^^^^ meta.property.qml
    ]
//  ^ meta.property.qml
}

//------------------------------------------------------------------------------
// object literal and arrow function values
//------------------------------------------------------------------------------
Item {
    property var obj: ({ a: 1 })
//  ^^^^^^^^ storage.type.property.qml
//           ^^^ storage.type.primitive.qml
//               ^^^ entity.other.attribute-name.qml
//  ^^^^^^^^^^^^^^^^^^^^^^^^^^^^ meta.property.qml
    property var f: () => 1
//  ^^^^^^^^ storage.type.property.qml
//           ^^^ storage.type.primitive.qml
//               ^ entity.other.attribute-name.qml
//  ^^^^^^^^^^^^^^^^^^^^^^^ meta.property.qml
    width: 10
//  ^^^^^ entity.other.attribute-name.qml
}

//------------------------------------------------------------------------------
// object values
//------------------------------------------------------------------------------
Item {
    property Item obj: Item {
//  ^^^^^^^^ storage.type.property.qml
//           ^^^^ entity.name.type.qml
//                ^^^ entity.other.attribute-name.qml
//                     ^^^^ entity.name.type.object.qml
//                          ^ punctuation.definition.block.qml
//  ^^^^^^^^^^^^^^^^^^^^^^^^^ meta.property.qml
        width: 100
//      ^^^^^ entity.other.attribute-name.qml
//      ^^^^^^^^^^ meta.property.qml
    }
//  ^ punctuation.definition.block.qml
//  ^ meta.property.qml
    height: 1
//  ^^^^^^ entity.other.attribute-name.qml - meta.property.qml
    readonly property T.Button btn: T.Button { text: "a" }; z: 2
//  ^^^^^^^^ storage.modifier.qml
//           ^^^^^^^^ storage.type.property.qml
//                    ^^^^^^^^ entity.name.type.qml
//                             ^^^ entity.other.attribute-name.qml
//                                  ^^^^^^^^ entity.name.type.object.qml
//                                           ^ punctuation.definition.block.qml
//                                                       ^ punctuation.definition.block.qml
//                                                        ^ punctuation.terminator.statement.qml - meta.property.qml
//                                                          ^ entity.other.attribute-name.qml - meta.property.qml
//  ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^ meta.property.qml

    // the brace is on the next line: the type is taken as a JS expression,
    // and the object body is not part of the declaration
    property Item obj2: Item
//  ^^^^^^^^ storage.type.property.qml
//           ^^^^ entity.name.type.qml
//                ^^^^ entity.other.attribute-name.qml
//  ^^^^^^^^^^^^^^^^^^^^^^^^ meta.property.qml
    {
//  ^ punctuation.definition.block.qml - meta.property.qml
        width: 1
//      ^^^^^ entity.other.attribute-name.qml - meta.property.qml
    }
//  ^ punctuation.definition.block.qml - meta.property.qml
    x: 3
//  ^ entity.other.attribute-name.qml
}

//------------------------------------------------------------------------------
// required without property
//------------------------------------------------------------------------------
Item {
    required color
//  ^^^^^^^^ storage.modifier.qml
//           ^^^^^ entity.other.attribute-name.qml
    required color;
//  ^^^^^^^^ storage.modifier.qml
//           ^^^^^ entity.other.attribute-name.qml
//                ^ punctuation.terminator.statement.qml
    width: 10
//  ^^^^^ entity.other.attribute-name.qml
}

//------------------------------------------------------------------------------
// attribute named property, not a declaration
//------------------------------------------------------------------------------
PropertyAnimation {
    property: "opacity"; to: 1
//                       ^^ entity.other.attribute-name.qml - meta.property.qml
//  ^^^^^^^^ entity.other.attribute-name.qml - storage.type.property.qml meta.property.qml
    properties: "x,y"
//  ^^^^^^^^^^ entity.other.attribute-name.qml - meta.property.qml
}

//------------------------------------------------------------------------------
// end of file: every object above is closed
//------------------------------------------------------------------------------
// end
// <------ - meta.object.qml
