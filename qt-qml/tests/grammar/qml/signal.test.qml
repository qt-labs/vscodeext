// SYNTAX TEST "source.qml" "signal declarations"
// Copyright (C) 2024 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

//------------------------------------------------------------------------------
// without parameters
//------------------------------------------------------------------------------
Rectangle {
    signal pressed
//  ^^^^^^ storage.type.signal.qml
//         ^^^^^^^ entity.name.function.signal.qml
//  ^^^^^^^^^^^^^^ meta.signal.qml
    signal pressed()
//  ^^^^^^ storage.type.signal.qml
//         ^^^^^^^ entity.name.function.signal.qml
//                ^ punctuation.definition.parameters.begin.qml
//                 ^ punctuation.definition.parameters.end.qml
//  ^^^^^^^^^^^^^^^^ meta.signal.qml
    signal pressed() // comment
//  ^^^^^^ storage.type.signal.qml
//         ^^^^^^^ entity.name.function.signal.qml
//                ^ punctuation.definition.parameters.begin.qml
//                 ^ punctuation.definition.parameters.end.qml
//                   ^^^^^^^^^^ comment.line.qml
//                   ^^^^^^^^^^ - meta.signal.qml
//  ^^^^^^^^^^^^^^^^ meta.signal.qml
}

//------------------------------------------------------------------------------
// signal with parameters
//------------------------------------------------------------------------------
Rectangle {
    signal clickedAt(x: real, y: real)
//  ^^^^^^ storage.type.signal.qml
//         ^^^^^^^^^ entity.name.function.signal.qml
//                  ^ punctuation.definition.parameters.begin.qml
//                   ^ variable.parameter.qml
//                      ^^^^ storage.type.primitive.qml
//                            ^ variable.parameter.qml
//                               ^^^^ storage.type.primitive.qml
//                                   ^ punctuation.definition.parameters.end.qml
//  ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^ meta.signal.qml
    signal clickedAt(x: list<int>, y: real)
//  ^^^^^^ storage.type.signal.qml
//         ^^^^^^^^^ entity.name.function.signal.qml
//                  ^ punctuation.definition.parameters.begin.qml
//                   ^ variable.parameter.qml
//                      ^^^^ storage.type.primitive.qml
//                          ^ punctuation.definition.typeparameters.begin.qml
//                           ^^^ storage.type.primitive.qml
//                              ^ punctuation.definition.typeparameters.end.qml
//                                 ^ variable.parameter.qml
//                                    ^^^^ storage.type.primitive.qml
//                                        ^ punctuation.definition.parameters.end.qml
//  ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^ meta.signal.qml
    signal itemAdded(item: T.Item, items: list<T.Item>)
//  ^^^^^^ storage.type.signal.qml
//         ^^^^^^^^^ entity.name.function.signal.qml
//                  ^ punctuation.definition.parameters.begin.qml
//                   ^^^^ variable.parameter.qml
//                         ^^^^^^ entity.name.type.qml
//                                 ^^^^^ variable.parameter.qml
//                                        ^^^^ storage.type.primitive.qml
//                                            ^ punctuation.definition.typeparameters.begin.qml
//                                             ^^^^^^ entity.name.type.qml
//                                                   ^ punctuation.definition.typeparameters.end.qml
//                                                    ^ punctuation.definition.parameters.end.qml
//  ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^ meta.signal.qml
}

//------------------------------------------------------------------------------
// signal with parameters, old style
//------------------------------------------------------------------------------
Rectangle {
    signal clickedAt(real x, real y) // old style
//  ^^^^^^ storage.type.signal.qml
//         ^^^^^^^^^ entity.name.function.signal.qml
//                  ^ punctuation.definition.parameters.begin.qml
//                   ^^^^ storage.type.primitive.qml
//                        ^ variable.parameter.qml
//                           ^^^^ storage.type.primitive.qml
//                                ^ variable.parameter.qml
//                                 ^ punctuation.definition.parameters.end.qml
//                                   ^^^^^^^^^^^^ comment.line.qml
//                                   ^^^^^^^^^^^^ - meta.signal.qml
//  ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^ meta.signal.qml
    signal itemAdded(list<int> x, T.Item item) // old style
//  ^^^^^^ storage.type.signal.qml
//         ^^^^^^^^^ entity.name.function.signal.qml
//                  ^ punctuation.definition.parameters.begin.qml
//                   ^^^^ storage.type.primitive.qml
//                       ^ punctuation.definition.typeparameters.begin.qml
//                        ^^^ storage.type.primitive.qml
//                           ^ punctuation.definition.typeparameters.end.qml
//                             ^ variable.parameter.qml
//                                ^^^^^^ entity.name.type.qml
//                                       ^^^^ variable.parameter.qml
//                                           ^ punctuation.definition.parameters.end.qml
//                                             ^^^^^^^^^^^^ comment.line.qml
//                                             ^^^^^^^^^^^^ - meta.signal.qml
//  ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^ meta.signal.qml
}

//------------------------------------------------------------------------------
// with semicolon
//------------------------------------------------------------------------------
Rectangle {
    signal pressed;
//  ^^^^^^ storage.type.signal.qml
//         ^^^^^^^ entity.name.function.signal.qml
//                ^ - meta.signal.qml
//                ^ punctuation.terminator.statement.qml
//  ^^^^^^^^^^^^^^ meta.signal.qml
    signal pressed();
//  ^^^^^^ storage.type.signal.qml
//         ^^^^^^^ entity.name.function.signal.qml
//                  ^ - meta.signal.qml
//                  ^ punctuation.terminator.statement.qml
//  ^^^^^^^^^^^^^^^^ meta.signal.qml
    signal clickedAt(x: real, y: real);
//  ^^^^^^ storage.type.signal.qml
//         ^^^^^^^^^ entity.name.function.signal.qml
//                                    ^ - meta.signal.qml
//                                    ^ punctuation.terminator.statement.qml
//  ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^ meta.signal.qml
    signal a; signal b()
//  ^^^^^^ storage.type.signal.qml
//         ^ entity.name.function.signal.qml
//          ^^ - meta.signal.qml
//          ^ punctuation.terminator.statement.qml
//            ^^^^^^ storage.type.signal.qml
//                   ^ entity.name.function.signal.qml
//  ^^^^^^^^ meta.signal.qml
//            ^^^^^^^^^^ meta.signal.qml
    signal c(); width: 10
//  ^^^^^^ storage.type.signal.qml
//         ^ entity.name.function.signal.qml
//            ^^ - meta.signal.qml
//            ^ punctuation.terminator.statement.qml
//              ^^^^^ entity.other.attribute-name.qml
//              ^^^^^ - meta.signal.qml
//  ^^^^^^^^^^ meta.signal.qml
    width: 10; signal d
//  ^^^^^ entity.other.attribute-name.qml
//  ^^^^^ - meta.signal.qml
//           ^^ - meta.signal.qml
//           ^ punctuation.terminator.statement.qml
//             ^^^^^^ storage.type.signal.qml
//                    ^ entity.name.function.signal.qml
//             ^^^^^^^^ meta.signal.qml
}

//------------------------------------------------------------------------------
// end of file: every object above is closed
//------------------------------------------------------------------------------
// end
// <------ - meta.object.qml
