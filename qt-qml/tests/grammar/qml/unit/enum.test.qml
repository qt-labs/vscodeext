// SYNTAX TEST "source.qml" "enum declarations"
// Copyright (C) 2024 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

//------------------------------------------------------------------------------
// multiple lines
//------------------------------------------------------------------------------
Text {
    enum TextType {
//  ^^^^ storage.type.enum.qml
//       ^^^^^^^^ entity.name.type.enum.qml
//       ^^^^^^^^ - entity.name.type.object.qml
//                ^ punctuation.definition.block.qml
//  ^^^^^^^^^^^^^^^ meta.enum.qml
        Normal,
//      ^^^^^^ variable.other.enummember.qml
//            ^ punctuation.separator.comma.qml
//      ^^^^^^^ meta.enum.qml
        Heading = 2,
//      ^^^^^^^ variable.other.enummember.qml
//              ^ keyword.operator.assignment.qml
//                ^ constant.numeric.qml
//                 ^ punctuation.separator.comma.qml
        Contents
//      ^^^^^^^^ variable.other.enummember.qml
//      ^^^^^^^^ - entity.name.type.object.qml
//      ^^^^^^^^ meta.enum.qml
    }
//  ^ punctuation.definition.block.qml
//  ^ meta.enum.qml
}

//------------------------------------------------------------------------------
// single line
//------------------------------------------------------------------------------
Item {
    enum Color { Red, Green, Blue }
//  ^^^^ storage.type.enum.qml
//       ^^^^^ entity.name.type.enum.qml
//             ^ punctuation.definition.block.qml
//               ^^^ variable.other.enummember.qml
//                  ^ punctuation.separator.comma.qml
//                    ^^^^^ variable.other.enummember.qml
//                         ^ punctuation.separator.comma.qml
//                           ^^^^ variable.other.enummember.qml
//                                ^ punctuation.definition.block.qml
//  ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^ meta.enum.qml
}

//------------------------------------------------------------------------------
// negative value and comments
//------------------------------------------------------------------------------
Item {
    enum Level {
//  ^^^^ storage.type.enum.qml
//       ^^^^^ entity.name.type.enum.qml
//             ^ punctuation.definition.block.qml
        Low = -1, // comment
//      ^^^ variable.other.enummember.qml
//          ^ keyword.operator.assignment.qml
//            ^^ constant.numeric.qml
//              ^ punctuation.separator.comma.qml
//                ^^^^^^^^^^ comment.line.qml
        /* comment */ High = 10
//      ^^^^^^^^^^^^^ comment.block.qml
//                    ^^^^ variable.other.enummember.qml
//                         ^ keyword.operator.assignment.qml
//                           ^^ constant.numeric.qml
    }
}

//------------------------------------------------------------------------------
// members after enum
//------------------------------------------------------------------------------
Item {
    enum Mode {
//  ^^^^ storage.type.enum.qml
//       ^^^^ entity.name.type.enum.qml
//            ^ punctuation.definition.block.qml
        First,
//      ^^^^^ variable.other.enummember.qml
        Last
//      ^^^^ variable.other.enummember.qml
//      ^^^^ - entity.name.type.object.qml
    }
    property int mode: 0
//  ^^^^^^^^ storage.type.property.qml
//  ^^^^^^^^ - meta.enum.qml
    width: 10
//  ^^^^^ entity.other.attribute-name.qml
//  ^^^^^ - meta.enum.qml
}

//------------------------------------------------------------------------------
// brace on the next line
//------------------------------------------------------------------------------
Item {
    enum Size
//  ^^^^ storage.type.enum.qml
//       ^^^^ entity.name.type.enum.qml
//       ^^^^ - entity.name.type.object.qml
    {
//  ^ punctuation.definition.block.qml
        Small,
        Large
    }
//  ^ punctuation.definition.block.qml
    width: 10
//  ^^^^^ entity.other.attribute-name.qml
}

//------------------------------------------------------------------------------
// end of file: every object above is closed
//------------------------------------------------------------------------------
// end
// <------ - meta.object.qml
