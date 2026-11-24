// SYNTAX TEST "source.qml" "property declarations"
// Copyright (C) 2024 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

// [default] [required] [readonly] property <propertyType> <propertyName>
// https://doc.qt.io/qt-6/qtqml-syntax-objectattributes.html

//------------------------------------------------------------------------------
// qml types
//------------------------------------------------------------------------------
Window {
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
//  ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^ meta.property.qml
    property point value: Qt.point(1, 2)
//  ^^^^^^^^ storage.type.property.qml
//           ^^^^^ storage.type.primitive.qml
//                 ^^^^^ entity.other.attribute-name.qml
//  ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^ meta.property.qml
    property list<int> value: [1, 2, 3, 4]
//  ^^^^^^^^ storage.type.property.qml
//           ^^^^ storage.type.primitive.qml
//               ^ punctuation.definition.typeparameters.begin.qml
//                ^^^ storage.type.primitive.qml
//                   ^ punctuation.definition.typeparameters.end.qml
//                     ^^^^^ entity.other.attribute-name.qml
//  ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^ meta.property.qml
}

//------------------------------------------------------------------------------
// default
//------------------------------------------------------------------------------
Window {
    default property var someText
//  ^^^^^^^ storage.modifier.qml
//         ^ - storage.modifier.qml
//          ^^^^^^^^ storage.type.property.qml
//                   ^^^ storage.type.primitive.qml
//                       ^^^^^^^^ entity.other.attribute-name.qml
//  ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^ meta.property.qml
}

//------------------------------------------------------------------------------
// required
//------------------------------------------------------------------------------
Window {
    Component {
        id: _delegate
//      ^^ keyword.other.id.qml

        Item {
            required property int point
//          ^^^^^^^^ storage.modifier.qml
//                  ^ - storage.modifier.qml
//                   ^^^^^^^^ storage.type.property.qml
//                            ^^^ storage.type.primitive.qml
//                                ^^^^^ entity.other.attribute-name.qml
//          ^^^^^^^^^^^^^^^^^^^^^^^^^^^ meta.property.qml
            required property string name
//          ^^^^^^^^ storage.modifier.qml
//                  ^ - storage.modifier.qml
//                   ^^^^^^^^ storage.type.property.qml
//                            ^^^^^^ storage.type.primitive.qml
//                                   ^^^^ entity.other.attribute-name.qml
//          ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^ meta.property.qml
            required property list<int> value
//          ^^^^^^^^ storage.modifier.qml
//                  ^ - storage.modifier.qml
//                   ^^^^^^^^ storage.type.property.qml
//                            ^^^^ storage.type.primitive.qml
//                                ^ punctuation.definition.typeparameters.begin.qml
//                                 ^^^ storage.type.primitive.qml
//                                    ^ punctuation.definition.typeparameters.end.qml
//                                      ^^^^^ entity.other.attribute-name.qml
//          ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^ meta.property.qml
        }
    }
}

//------------------------------------------------------------------------------
// readonly
//------------------------------------------------------------------------------
Window {
    readonly property color myvalue: Qt.rgba(1, 1, 1, 1)
//  ^^^^^^^^ storage.modifier.qml
//          ^ - storage.modifier.qml
//           ^^^^^^^^ storage.type.property.qml
//                    ^^^^^ storage.type.primitive.qml
//                          ^^^^^^^ entity.other.attribute-name.qml
//  ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^ meta.property.qml
    readonly property list<int> value: [1, 2, 3, 4]
//  ^^^^^^^^ storage.modifier.qml
//          ^ - storage.modifier.qml
//           ^^^^^^^^ storage.type.property.qml
//                    ^^^^ storage.type.primitive.qml
//                        ^ punctuation.definition.typeparameters.begin.qml
//                         ^^^ storage.type.primitive.qml
//                            ^ punctuation.definition.typeparameters.end.qml
//                              ^^^^^ entity.other.attribute-name.qml
//  ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^ meta.property.qml
}

//------------------------------------------------------------------------------
// alias
//------------------------------------------------------------------------------
Window {
    property alias text: _text.text
//  ^^^^^^^^ storage.type.property.qml
//           ^^^^^ keyword.other.alias.qml
//                 ^^^^ entity.other.attribute-name.qml
//  ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^ meta.property.qml
}

//------------------------------------------------------------------------------
// without initial value
//------------------------------------------------------------------------------
Window {
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
}

//------------------------------------------------------------------------------
// props in child object
//------------------------------------------------------------------------------
Window {
    Rectangle {
        property int animatedHeight: 0
//      ^^^^^^^^ storage.type.property.qml
//               ^^^ storage.type.primitive.qml
//                   ^^^^^^^^^^^^^^ entity.other.attribute-name.qml
//      ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^ meta.property.qml
        property string name: "abcd"
//      ^^^^^^^^ storage.type.property.qml
//               ^^^^^^ storage.type.primitive.qml
//                      ^^^^ entity.other.attribute-name.qml
//      ^^^^^^^^^^^^^^^^^^^^^^^^^^^^ meta.property.qml
    }
}

//------------------------------------------------------------------------------
// make property to a required one
//------------------------------------------------------------------------------
Window {
    Rectangle {
        required color
//      ^^^^^^^^ storage.modifier.qml
//               ^^^^^ entity.other.attribute-name.qml
    }
}

//------------------------------------------------------------------------------
// others
//------------------------------------------------------------------------------
Window {
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

    property Model value1: Model { }
//  ^^^^^^^^ storage.type.property.qml
//           ^^^^^ entity.name.type.qml
//                 ^^^^^^ entity.other.attribute-name.qml
//  ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^ meta.property.qml
    property Model value2: Model { }
//  ^^^^^^^^ storage.type.property.qml
//           ^^^^^ entity.name.type.qml
//                 ^^^^^^ entity.other.attribute-name.qml
//  ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^ meta.property.qml
}

//------------------------------------------------------------------------------
// qualified and generic types
//------------------------------------------------------------------------------
Item {
    property T.Button btn
//  ^^^^^^^^ storage.type.property.qml
//           ^^^^^^^^ entity.name.type.qml
//                    ^^^ entity.other.attribute-name.qml
//  ^^^^^^^^^^^^^^^^^^^^^ meta.property.qml
    property T.Button btn2: T.Button {}
//  ^^^^^^^^ storage.type.property.qml
//           ^^^^^^^^ entity.name.type.qml
//                    ^^^^ entity.other.attribute-name.qml
//  ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^ meta.property.qml
    property list<T.Item> items
//  ^^^^^^^^ storage.type.property.qml
//           ^^^^ storage.type.primitive.qml
//               ^ punctuation.definition.typeparameters.begin.qml
//                ^^^^^^ entity.name.type.qml
//                      ^ punctuation.definition.typeparameters.end.qml
//                        ^^^^^ entity.other.attribute-name.qml
//  ^^^^^^^^^^^^^^^^^^^^^^^^^^^ meta.property.qml
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
}

//------------------------------------------------------------------------------
// modifier combinations
//------------------------------------------------------------------------------
Item {
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
}

//------------------------------------------------------------------------------
// trailing semicolon and comment
//------------------------------------------------------------------------------
Item {
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
    required color;
//  ^^^^^^^^ storage.modifier.qml
//           ^^^^^ entity.other.attribute-name.qml
//                ^ punctuation.terminator.statement.qml
    width: 10
//  ^^^^^ entity.other.attribute-name.qml
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
// end of file: every object above is closed
//------------------------------------------------------------------------------
// end
// <------ - meta.object.qml
