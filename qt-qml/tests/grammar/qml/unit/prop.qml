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
//  ^^^^^^^^ keyword.other.prop-custom.qml
//           ^^^ storage.type.prop-custom.type.qml
//               ^^^^^^ variable.parameter.attr-expr.qml
    property int height : 0
//  ^^^^^^^^ keyword.other.prop-custom.qml
//           ^^^ storage.type.prop-custom.type.qml
//               ^^^^^^ variable.parameter.attr-expr.qml
    property string name: "abcd"
//  ^^^^^^^^ keyword.other.prop-custom.qml
//           ^^^^^^ storage.type.prop-custom.type.qml
//                  ^^^^ variable.parameter.attr-expr.qml
    property color color: "#121212" // comment
//  ^^^^^^^^ keyword.other.prop-custom.qml
//           ^^^^^ storage.type.prop-custom.type.qml
//                 ^^^^^ variable.parameter.attr-expr.qml
    property point value: Qt.point(1, 2)
//  ^^^^^^^^ keyword.other.prop-custom.qml
//           ^^^^^ storage.type.prop-custom.type.qml
//                 ^^^^^ variable.parameter.attr-expr.qml
    property list<int> value: [1, 2, 3, 4]
//  ^^^^^^^^ keyword.other.prop-custom.qml
//           ^^^^^^^^^ storage.type.prop-custom.type.qml
//                     ^^^^^ variable.parameter.attr-list.qml
}

//------------------------------------------------------------------------------
// default
//------------------------------------------------------------------------------
Window {
    default property var someText
//  ^^^^^^^ storage.modifier.prop-custom.qml
//         ^ - storage.modifier.prop-custom.qml
//          ^^^^^^^^ keyword.other.prop-custom.qml
//                   ^^^ storage.type.prop-custom.type.qml
//                       ^^^^^^^^ variable.parameter.prop-custom.name.qml
}

//------------------------------------------------------------------------------
// required
//------------------------------------------------------------------------------
Window {
    Component {
        id: _delegate
//      ^^ variable.parameter.attr-expr.qml

        Item {
            required property int point
//          ^^^^^^^^ storage.modifier.prop-custom.qml
//                  ^ - storage.modifier.prop-custom.qml
//                   ^^^^^^^^ keyword.other.prop-custom.qml
//                            ^^^ storage.type.prop-custom.type.qml
//                                ^^^^^ variable.parameter.prop-custom.name.qml
            required property string name
//          ^^^^^^^^ storage.modifier.prop-custom.qml
//                  ^ - storage.modifier.prop-custom.qml
//                   ^^^^^^^^ keyword.other.prop-custom.qml
//                            ^^^^^^ storage.type.prop-custom.type.qml
//                                   ^^^^ variable.parameter.prop-custom.name.qml
            required property list<int> value
//          ^^^^^^^^ storage.modifier.prop-custom.qml
//                  ^ - storage.modifier.prop-custom.qml
//                   ^^^^^^^^ keyword.other.prop-custom.qml
//                            ^^^^^^^^^ storage.type.prop-custom.type.qml
//                                      ^^^^^ variable.parameter.prop-custom.name.qml
        }
    }
}

//------------------------------------------------------------------------------
// readonly
//------------------------------------------------------------------------------
Window {
    readonly property color myvalue: Qt.rgba(1, 1, 1, 1)
//  ^^^^^^^^ storage.modifier.prop-custom.qml
//          ^ - storage.modifier.prop-custom.qml
//           ^^^^^^^^ keyword.other.prop-custom.qml
//                    ^^^^^ storage.type.prop-custom.type.qml
//                          ^^^^^^^ variable.parameter.attr-expr.qml
    readonly property list<int> value: [1, 2, 3, 4]
//  ^^^^^^^^ storage.modifier.prop-custom.qml
//          ^ - storage.modifier.prop-custom.qml
//           ^^^^^^^^ keyword.other.prop-custom.qml
//                    ^^^^^^^^^ storage.type.prop-custom.type.qml
//                              ^^^^^ variable.parameter.attr-list.qml
}

//------------------------------------------------------------------------------
// alias
//------------------------------------------------------------------------------
Window {
    property alias text: _text.text
//  ^^^^^^^^ keyword.other.prop-custom.qml
//           ^^^^^ storage.type.prop-custom.type.qml
//                 ^^^^ variable.parameter.attr-expr.qml
}

//------------------------------------------------------------------------------
// without initial value
//------------------------------------------------------------------------------
Window {
    property color nextColor
//  ^^^^^^^^ keyword.other.prop-custom.qml
//           ^^^^^ storage.type.prop-custom.type.qml
//                 ^^^^^^^^^ variable.parameter.prop-custom.name.qml
    property list<int> value
//  ^^^^^^^^ keyword.other.prop-custom.qml
//           ^^^^^^^^^ storage.type.prop-custom.type.qml
//                     ^^^^^ variable.parameter.prop-custom.name.qml
}

//------------------------------------------------------------------------------
// props in child object
//------------------------------------------------------------------------------
Window {
    Rectangle {
        property int animatedHeight: 0
//      ^^^^^^^^ keyword.other.prop-custom.qml
//               ^^^ storage.type.prop-custom.type.qml
//                   ^^^^^^^^^^^^^^ variable.parameter.attr-expr.qml
        property string name: "abcd"
//      ^^^^^^^^ keyword.other.prop-custom.qml
//               ^^^^^^ storage.type.prop-custom.type.qml
//                      ^^^^ variable.parameter.attr-expr.qml
    }
}

//------------------------------------------------------------------------------
// make property to a required one
//------------------------------------------------------------------------------
Window {
    Rectangle {
        required color
//      ^^^^^^^^ storage.modifier.prop-force-required.qml
//               ^^^^^ variable.parameter.prop-force-required.name.qml
    }
}

//------------------------------------------------------------------------------
// others
//------------------------------------------------------------------------------
Window {
    property list<int> value: [
//  ^^^^^^^^ keyword.other.prop-custom.qml
//           ^^^^^^^^^ storage.type.prop-custom.type.qml
//                     ^^^^^ variable.parameter.attr-list.qml
        1, 2, 3, 4
    ]

    property Model value1: Model { }
//  ^^^^^^^^ keyword.other.prop-custom.qml
//           ^^^^^ storage.type.prop-custom.type.qml
//                 ^^^^^^ variable.parameter.attr-object.qml
    property Model value2: Model { }
//  ^^^^^^^^ keyword.other.prop-custom.qml
//           ^^^^^ storage.type.prop-custom.type.qml
//                 ^^^^^^ variable.parameter.attr-object.qml
}

//------------------------------------------------------------------------------
// qualified and generic types
//------------------------------------------------------------------------------
Item {
    property T.Button btn
//  ^^^^^^^^ keyword.other.prop-custom.qml
//           ^^^^^^^^ storage.type.prop-custom.type.qml
//                    ^^^ variable.parameter.prop-custom.name.qml
    property T.Button btn2: T.Button {}
//  ^^^^^^^^ keyword.other.prop-custom.qml
//           ^^^^^^^^ storage.type.prop-custom.type.qml
//                    ^^^^ variable.parameter.attr-object.qml
    property list<T.Item> items
//  ^^^^^^^^ keyword.other.prop-custom.qml
//           ^^^^^^^^^^^^ storage.type.prop-custom.type.qml
//                        ^^^^^ variable.parameter.prop-custom.name.qml
    readonly property list<T.Item> items2: []
//  ^^^^^^^^ storage.modifier.prop-custom.qml
//          ^ - storage.modifier.prop-custom.qml
//           ^^^^^^^^ keyword.other.prop-custom.qml
//                    ^^^^^^^^^^^^ storage.type.prop-custom.type.qml
//                                 ^^^^^^ variable.parameter.attr-list.qml
}

//------------------------------------------------------------------------------
// modifier combinations
//------------------------------------------------------------------------------
Item {
    default required property Item content
//  ^^^^^^^ storage.modifier.prop-custom.qml
//         ^ - storage.modifier.prop-custom.qml
//          ^^^^^^^^ storage.modifier.prop-custom.qml
//                  ^ - storage.modifier.prop-custom.qml
//                   ^^^^^^^^ keyword.other.prop-custom.qml
//                            ^^^^ storage.type.prop-custom.type.qml
//                                 ^^^^^^^ variable.parameter.prop-custom.name.qml
    required default property Item content2
//  ^^^^^^^^ storage.modifier.prop-custom.qml
//          ^ - storage.modifier.prop-custom.qml
//           ^^^^^^^ storage.modifier.prop-custom.qml
//                  ^ - storage.modifier.prop-custom.qml
//                   ^^^^^^^^ keyword.other.prop-custom.qml
//                            ^^^^ storage.type.prop-custom.type.qml
//                                 ^^^^^^^^ variable.parameter.prop-custom.name.qml
    final property int a: 1
//  ^^^^^ storage.modifier.prop-custom.qml
//       ^ - storage.modifier.prop-custom.qml
//        ^^^^^^^^ keyword.other.prop-custom.qml
//                 ^^^ storage.type.prop-custom.type.qml
//                     ^ variable.parameter.attr-expr.qml
    virtual property int b: 1
//  ^^^^^^^ storage.modifier.prop-custom.qml
//         ^ - storage.modifier.prop-custom.qml
//          ^^^^^^^^ keyword.other.prop-custom.qml
//                   ^^^ storage.type.prop-custom.type.qml
//                       ^ variable.parameter.attr-expr.qml
    override property int c: 1
//  ^^^^^^^^ storage.modifier.prop-custom.qml
//          ^ - storage.modifier.prop-custom.qml
//           ^^^^^^^^ keyword.other.prop-custom.qml
//                    ^^^ storage.type.prop-custom.type.qml
//                        ^ variable.parameter.attr-expr.qml
}

//------------------------------------------------------------------------------
// trailing semicolon and comment
//------------------------------------------------------------------------------
Item {
    property int x // comment
//  ^^^^^^^^ keyword.other.prop-custom.qml
//           ^^^ storage.type.prop-custom.type.qml
//               ^ variable.parameter.prop-custom.name.qml
//                 ^^^^^^^^^^ comment.line.qml
    property int y;
//  ^^^^^^^^ keyword.other.prop-custom.qml
//           ^^^ storage.type.prop-custom.type.qml
//               ^ variable.parameter.prop-custom.name.qml
    required color;
//  ^^^^^^^^ storage.modifier.prop-force-required.qml
//           ^^^^^ variable.parameter.prop-force-required.name.qml
    width: 10
//  ^^^^^ variable.parameter.attr-expr.qml
}

//------------------------------------------------------------------------------
// object literal and arrow function values
//------------------------------------------------------------------------------
Item {
    property var obj: ({ a: 1 })
//  ^^^^^^^^ keyword.other.prop-custom.qml
//           ^^^ storage.type.prop-custom.type.qml
//               ^^^ variable.parameter.attr-expr.qml
    property var f: () => 1
//  ^^^^^^^^ keyword.other.prop-custom.qml
//           ^^^ storage.type.prop-custom.type.qml
//               ^ variable.parameter.attr-expr.qml
    width: 10
//  ^^^^^ variable.parameter.attr-expr.qml
}

//------------------------------------------------------------------------------
// end of file: every object above is closed
//------------------------------------------------------------------------------
// end
// <------ - meta.object.qml
