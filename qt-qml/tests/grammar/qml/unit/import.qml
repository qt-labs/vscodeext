// SYNTAX TEST "source.qml" "import statements"
// Copyright (C) 2024 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

//------------------------------------------------------------------------------
// with version number
//------------------------------------------------------------------------------
import QtQuick 2.0
// <------ keyword.control.import.qml
//     ^^^^^^^ entity.name.section.import.module.qml
//             ^^^ constant.numeric.import.version.qml
// <------------------ meta.import.qml
import QtQuick.LocalStorage 2.0
// <------ keyword.control.import.qml
//     ^^^^^^^^^^^^^^^^^^^^ entity.name.section.import.module.qml
//                          ^^^ constant.numeric.import.version.qml
// <------------------------------- meta.import.qml
import QtQuick.LocalStorage 2.0 as Database
// <------ keyword.control.import.qml
//     ^^^^^^^^^^^^^^^^^^^^ entity.name.section.import.module.qml
//                          ^^^ constant.numeric.import.version.qml
//                              ^^ keyword.control.import.as.qml
//                                 ^^^^^^^^ entity.name.type.import.type.qml
// <------------------------------------------- meta.import.qml

//------------------------------------------------------------------------------
// without version
//------------------------------------------------------------------------------
import QtQuick
// <------ keyword.control.import.qml
//     ^^^^^^^ entity.name.section.import.module.qml
// <-------------- meta.import.qml
import QtQuick.LocalStorage
// <------ keyword.control.import.qml
//     ^^^^^^^^^^^^^^^^^^^^ entity.name.section.import.module.qml
// <--------------------------- meta.import.qml
import QtQuick.LocalStorage as Database
// <------ keyword.control.import.qml
//     ^^^^^^^^^^^^^^^^^^^^ entity.name.section.import.module.qml
//                          ^^ keyword.control.import.as.qml
//                             ^^^^^^^^ entity.name.type.import.type.qml
// <--------------------------------------- meta.import.qml

//------------------------------------------------------------------------------
// folders, files
//------------------------------------------------------------------------------
import "../textwidgets"
// <------ keyword.control.import.qml
//     ^^^^^^^^^^^^^^^^ string.quoted.double.qml
// <----------------------- meta.import.qml
import "../textwidgets" as MyModule
// <------ keyword.control.import.qml
//     ^^^^^^^^^^^^^^^^ string.quoted.double.qml
//                      ^^ keyword.control.import.as.qml
//                         ^^^^^^^^ entity.name.type.import.type.qml
// <----------------------------------- meta.import.qml
import "somefile.js" as Script
// <------ keyword.control.import.qml
//     ^^^^^^^^^^^^^ string.quoted.double.qml
//                   ^^ keyword.control.import.as.qml
//                      ^^^^^^ entity.name.type.import.type.qml
// <------------------------------ meta.import.qml

//------------------------------------------------------------------------------
// others
//------------------------------------------------------------------------------
import QtQuick 2.0 // comment
// <------ keyword.control.import.qml
//     ^^^^^^^ entity.name.section.import.module.qml
//             ^^^ constant.numeric.import.version.qml
//                 ^^^^^^^^^^ comment.line.qml
// <----------------------------- meta.import.qml
import QtQuick.LocalStorage 2.0 as Database // comment
// <------ keyword.control.import.qml
//     ^^^^^^^^^^^^^^^^^^^^ entity.name.section.import.module.qml
//                          ^^^ constant.numeric.import.version.qml
//                              ^^ keyword.control.import.as.qml
//                                 ^^^^^^^^ entity.name.type.import.type.qml
//                                          ^^^^^^^^^^ comment.line.qml
// <------------------------------------------------------ meta.import.qml

//------------------------------------------------------------------------------
// meta scope ends at the end of the statement
//------------------------------------------------------------------------------
import QtQuick
Item {}
// <------- - meta.import.qml
