// SYNTAX TEST "source.qml" "pragma statements"
// Copyright (C) 2024 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

//------------------------------------------------------------------------------
// without value
//------------------------------------------------------------------------------
pragma Singleton
// <------ keyword.control.pragma.qml
//     ^^^^^^^^^ variable.parameter.pragma.qml
// <---------------- meta.pragma.qml

//------------------------------------------------------------------------------
// single value
//------------------------------------------------------------------------------
pragma ListPropertyAssignBehavior: ReplaceIfNotDefault // Append, Replace,
// <------ keyword.control.pragma.qml
//     ^^^^^^^^^^^^^^^^^^^^^^^^^^ variable.parameter.pragma.qml
//                               ^^ - entity.name.pragma.qml
//                                 ^^^^^^^^^^^^^^^^^^^ entity.name.pragma.qml
//                                                     ^^^^^^^^^^^^^^^^^^^ comment.line.qml
// <-------------------------------------------------------------------------- meta.pragma.qml
pragma ComponentBehavior: Bound // Unbound
// <------ keyword.control.pragma.qml
//     ^^^^^^^^^^^^^^^^^ variable.parameter.pragma.qml
//                      ^^ - entity.name.pragma.qml
//                        ^^^^^ entity.name.pragma.qml
//                              ^^^^^^^^^^ comment.line.qml
// <------------------------------------------ meta.pragma.qml
pragma FunctionSignatureBehavior: Ignored // Enforced
// <------ keyword.control.pragma.qml
//     ^^^^^^^^^^^^^^^^^^^^^^^^^ variable.parameter.pragma.qml
//                              ^^ - entity.name.pragma.qml
//                                ^^^^^^^ entity.name.pragma.qml
//                                        ^^^^^^^^^^^ comment.line.qml
// <----------------------------------------------------- meta.pragma.qml
pragma NativeMethodBehavior: AcceptThisObject // RejectThisObject
// <------ keyword.control.pragma.qml
//     ^^^^^^^^^^^^^^^^^^^^ variable.parameter.pragma.qml
//                         ^^ - entity.name.pragma.qml
//                           ^^^^^^^^^^^^^^^^ entity.name.pragma.qml
//                                            ^^^^^^^^^^^^^^^^^^^ comment.line.qml
// <----------------------------------------------------------------- meta.pragma.qml
pragma ValueTypeBehavior: Addressable // Inaddressable, Copy, Reference
// <------ keyword.control.pragma.qml
//     ^^^^^^^^^^^^^^^^^ variable.parameter.pragma.qml
//                      ^^ - entity.name.pragma.qml
//                        ^^^^^^^^^^^ entity.name.pragma.qml
//                                    ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^ comment.line.qml
// <----------------------------------------------------------------------- meta.pragma.qml

//------------------------------------------------------------------------------
// translator context
//------------------------------------------------------------------------------
pragma Translator: myContext
// <------ keyword.control.pragma.qml
//     ^^^^^^^^^^ variable.parameter.pragma.qml
//               ^^ - entity.name.pragma.qml
//                 ^^^^^^^^^ entity.name.pragma.qml
// <---------------------------- meta.pragma.qml
pragma Translator: "myContext"
// <------ keyword.control.pragma.qml
//     ^^^^^^^^^^ variable.parameter.pragma.qml
//               ^^ - entity.name.pragma.qml
//                 ^^^^^^^^^^^ string.quoted.double.qml
// <------------------------------ meta.pragma.qml

//------------------------------------------------------------------------------
// multiple values
//------------------------------------------------------------------------------
pragma ValueTypeBehavior: Copy, Addressable
// <------ keyword.control.pragma.qml
//     ^^^^^^^^^^^^^^^^^ variable.parameter.pragma.qml
//                      ^^ - entity.name.pragma.qml
//                        ^^^^ entity.name.pragma.qml
//                            ^^ - entity.name.pragma.qml
//                              ^^^^^^^^^^^ entity.name.pragma.qml
// <------------------------------------------- meta.pragma.qml
pragma ValueTypeBehavior: Copy, Addressable, Inaddressable // comment
// <------ keyword.control.pragma.qml
//     ^^^^^^^^^^^^^^^^^ variable.parameter.pragma.qml
//                      ^^ - entity.name.pragma.qml
//                        ^^^^ entity.name.pragma.qml
//                            ^^ - entity.name.pragma.qml
//                              ^^^^^^^^^^^ entity.name.pragma.qml
//                                         ^^ - entity.name.pragma.qml
//                                           ^^^^^^^^^^^^^ entity.name.pragma.qml
//                                                         ^^^^^^^^^^ comment.line.qml
// <--------------------------------------------------------------------- meta.pragma.qml

//------------------------------------------------------------------------------
// meta scope ends at the end of the statement
//------------------------------------------------------------------------------
pragma Singleton
Item {}
// <------- - meta.pragma.qml
