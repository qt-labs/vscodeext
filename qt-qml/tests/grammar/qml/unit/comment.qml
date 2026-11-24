// SYNTAX TEST "source.qml" "comments"
// Copyright (C) 2024 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

//------------------------------------------------------------------------------
// line comment
//------------------------------------------------------------------------------
// This is a line comment
// <-- comment.line.qml punctuation.definition.comment.qml
//^^^^^^^^^^^^^^^^^^^^^^^ comment.line.qml - punctuation.definition.comment.qml

Item { // This is a comment
// <------ - comment.line.qml
//     ^^ comment.line.qml punctuation.definition.comment.qml
//       ^^^^^^^^^^^^^^^^^^ comment.line.qml - punctuation.definition.comment.qml
}
// <- - comment.line.qml

//------------------------------------------------------------------------------
// block comment
//------------------------------------------------------------------------------
/*
// <-- comment.block.qml punctuation.definition.comment.qml
    This is a block comment
//  ^^^^^^^^^^^^^^^^^^^^^^^ comment.block.qml - punctuation.definition.comment.qml
*/
// <-- comment.block.qml punctuation.definition.comment.qml

/*!
// <-- comment.block.qml punctuation.definition.comment.qml
//^ comment.block.qml - punctuation.definition.comment.qml
    This is a block comment
//  ^^^^^^^^^^^^^^^^^^^^^^^ comment.block.qml - punctuation.definition.comment.qml
*/
// <-- comment.block.qml punctuation.definition.comment.qml

//------------------------------------------------------------------------------
// some helpers for user convenience
//------------------------------------------------------------------------------
Item {
    // NOTE note entry
//  ^^ comment.line.qml punctuation.definition.comment.qml
//     ^^^^ comment.line.qml keyword.other.todo.qml
//         ^^^^^^^^^^^ comment.line.qml - keyword.other.todo.qml
    // TODO todo entry
//  ^^ comment.line.qml punctuation.definition.comment.qml
//     ^^^^ comment.line.qml keyword.other.todo.qml
//         ^^^^^^^^^^^ comment.line.qml - keyword.other.todo.qml
    // DEBUG debug entry
//  ^^ comment.line.qml punctuation.definition.comment.qml
//     ^^^^^ comment.line.qml keyword.other.todo.qml
//          ^^^^^^^^^^^^ comment.line.qml - keyword.other.todo.qml
    // XXX xxx entry
//  ^^ comment.line.qml punctuation.definition.comment.qml
//     ^^^ comment.line.qml keyword.other.todo.qml
//        ^^^^^^^^^^ comment.line.qml - keyword.other.todo.qml
    // BUG bug entry
//  ^^ comment.line.qml punctuation.definition.comment.qml
//     ^^^ comment.line.qml invalid.illegal.todo.qml
//        ^^^^^^^^^^ comment.line.qml - invalid.illegal.todo.qml
    // FIXME fixme entry
//  ^^ comment.line.qml punctuation.definition.comment.qml
//     ^^^^^ comment.line.qml invalid.illegal.todo.qml
//          ^^^^^^^^^^^^ comment.line.qml - invalid.illegal.todo.qml
    // WARNING warning entry
//  ^^ comment.line.qml punctuation.definition.comment.qml
//     ^^^^^^^ comment.line.qml invalid.illegal.todo.qml
//            ^^^^^^^^^^^^^^ comment.line.qml - invalid.illegal.todo.qml
}

//------------------------------------------------------------------------------
// inline block comment
//------------------------------------------------------------------------------
Item {
    /* c */ width: 100
//  ^^^^^^^ comment.block.qml - meta.embedded.expression.qml
//          ^^^^^ variable.parameter.attr-expr.qml
    width: 100 /* c */
//  ^^^^^ variable.parameter.attr-expr.qml
//             ^^^^^^^ meta.embedded.expression.qml - comment.block.qml
    width: 100; /* c */ height: 200
//  ^^^^^ variable.parameter.attr-expr.qml
//            ^ punctuation.terminator.statement.qml
//              ^^^^^^^ comment.block.qml - meta.embedded.expression.qml
//                      ^^^^^^ variable.parameter.attr-expr.qml
}

//------------------------------------------------------------------------------
// end of file: every object above is closed
//------------------------------------------------------------------------------
// end
// <------ - meta.object.qml
