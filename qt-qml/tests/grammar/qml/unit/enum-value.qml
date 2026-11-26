// SYNTAX TEST "source.qml" "enum values in expressions"
// Copyright (C) 2026 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

//------------------------------------------------------------------------------
// type and enum value
//------------------------------------------------------------------------------
Label {
    horizontalAlignment: Text.AlignHCenter
//                       ^^^^ entity.name.type.qml
//                       ^^^^ meta.doc.type.Text.qml
//                           ^ punctuation.accessor.qml
//                           ^ - meta.doc.type.Text.qml
//                            ^^^^^^^^^^^^ variable.other.enummember.qml
//                            ^^^^^^^^^^^^ meta.doc.type.Text.qml
//                            ^^^^^^^^^^^^ meta.doc.member.AlignHCenter.qml
    wrapMode: Text.Wrap | Image.PreserveAspectFit
//            ^^^^ entity.name.type.qml
//                 ^^^^ variable.other.enummember.qml
//                        ^^^^^ entity.name.type.qml
//                        ^^^^^ meta.doc.type.Image.qml
//                              ^^^^^^^^^^^^^^^^^ variable.other.enummember.qml
//                              ^^^^^^^^^^^^^^^^^ meta.doc.member.PreserveAspectFit.qml
}

//------------------------------------------------------------------------------
// nested blocks, methods and lists
//------------------------------------------------------------------------------
Item {
    onClicked: {
        if (status === Component.Ready) {
//                     ^^^^^^^^^ entity.name.type.qml
//                               ^^^^^ variable.other.enummember.qml
        }
    }
    function f() { return Text.AlignLeft }
//                        ^^^^ entity.name.type.qml
//                             ^^^^^^^^^ variable.other.enummember.qml
    items: [Text.AlignLeft, Text.AlignRight]
//          ^^^^ entity.name.type.qml
//               ^^^^^^^^^ variable.other.enummember.qml
//                          ^^^^ entity.name.type.qml
//                               ^^^^^^^^^^ variable.other.enummember.qml
    objects: [T.Item { }]
//            ^^^^^^ entity.name.type.object.qml
//              ^^^^ - variable.other.enummember.qml
}

//------------------------------------------------------------------------------
// Qt keeps its own scopes
//------------------------------------------------------------------------------
Item {
    horizontalAlignment: Qt.AlignLeft
//                       ^^ support.class.qt.qml
//                       ^^ - entity.name.type.qml
//                          ^^^^^^^^^ support.constant.qt.qml
//                          ^^^^^^^^^ - variable.other.enummember.qml
}

//------------------------------------------------------------------------------
// not enum values
//------------------------------------------------------------------------------
Item {
    x: foo.Text.AlignLeft
//         ^^^^ - entity.name.type.qml
//              ^^^^^^^^^ - variable.other.enummember.qml
    y: Math.PI + Number.MAX_VALUE
//     ^^^^ - entity.name.type.qml
//          ^^ - variable.other.enummember.qml
//               ^^^^^^ - entity.name.type.qml
//                      ^^^^^^^^^ - variable.other.enummember.qml
    z: Foo.Bar(1) + Foo.Bar.baz + Text.alignment
//     ^^^ - entity.name.type.qml
//         ^^^ - variable.other.enummember.qml
//                  ^^^ - entity.name.type.qml
//                      ^^^ - variable.other.enummember.qml
//                                ^^^^ - entity.name.type.qml
//                                     ^^^^^^^^^ - variable.other.enummember.qml
    text: "Text.AlignLeft" // Text.AlignLeft
//         ^^^^ - entity.name.type.qml
//                            ^^^^ - entity.name.type.qml
}

//------------------------------------------------------------------------------
// end of file: every object above is closed
//------------------------------------------------------------------------------
// end
// <------ - meta.object.qml
