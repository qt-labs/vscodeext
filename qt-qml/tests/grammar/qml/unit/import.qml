// SYNTAX TEST "source.qml" "import statements"
// Copyright (C) 2024 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

//------------------------------------------------------------------------------
// with version number
//------------------------------------------------------------------------------
import QtQuick 2.0
// <------ keyword.control.import.qml
//     ^^^^^^^ entity.name.namespace.qml
//             ^^^ constant.numeric.version.qml
// <------------------ meta.import.qml
import QtQuick.LocalStorage 2.0
// <------ keyword.control.import.qml
//     ^^^^^^^^^^^^^^^^^^^^ entity.name.namespace.qml
//                          ^^^ constant.numeric.version.qml
// <------------------------------- meta.import.qml
import QtQuick.LocalStorage 2.0 as Database
// <------ keyword.control.import.qml
//     ^^^^^^^^^^^^^^^^^^^^ entity.name.namespace.qml
//                          ^^^ constant.numeric.version.qml
//                              ^^ keyword.control.as.qml
//                                 ^^^^^^^^ entity.name.namespace.qml
// <------------------------------------------- meta.import.qml

//------------------------------------------------------------------------------
// major version only
//------------------------------------------------------------------------------
import QtQuick 6
// <------ keyword.control.import.qml
//     ^^^^^^^ entity.name.namespace.qml
//             ^ constant.numeric.version.qml
// <---------------- meta.import.qml
import QtQuick 6 as Q
// <------ keyword.control.import.qml
//     ^^^^^^^ entity.name.namespace.qml
//             ^ constant.numeric.version.qml
//               ^^ keyword.control.as.qml
//                  ^ entity.name.namespace.qml
// <--------------------- meta.import.qml

//------------------------------------------------------------------------------
// without version
//------------------------------------------------------------------------------
import QtQuick
// <------ keyword.control.import.qml
//     ^^^^^^^ entity.name.namespace.qml
// <-------------- meta.import.qml
import QtQuick.LocalStorage
// <------ keyword.control.import.qml
//     ^^^^^^^^^^^^^^^^^^^^ entity.name.namespace.qml
// <--------------------------- meta.import.qml
import QtQuick.LocalStorage as Database
// <------ keyword.control.import.qml
//     ^^^^^^^^^^^^^^^^^^^^ entity.name.namespace.qml
//                          ^^ keyword.control.as.qml
//                             ^^^^^^^^ entity.name.namespace.qml
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
//                      ^^ keyword.control.as.qml
//                         ^^^^^^^^ entity.name.namespace.qml
// <----------------------------------- meta.import.qml
import "somefile.js" as Script
// <------ keyword.control.import.qml
//     ^^^^^^^^^^^^^ string.quoted.double.qml
//                   ^^ keyword.control.as.qml
//                      ^^^^^^ entity.name.namespace.qml
// <------------------------------ meta.import.qml

//------------------------------------------------------------------------------
// others
//------------------------------------------------------------------------------
import QtQuick 2.0 // comment
// <------ keyword.control.import.qml
//     ^^^^^^^ entity.name.namespace.qml
//             ^^^ constant.numeric.version.qml
//                 ^^^^^^^^^^ comment.line.qml
// <----------------------------- meta.import.qml
import QtQuick.LocalStorage 2.0 as Database // comment
// <------ keyword.control.import.qml
//     ^^^^^^^^^^^^^^^^^^^^ entity.name.namespace.qml
//                          ^^^ constant.numeric.version.qml
//                              ^^ keyword.control.as.qml
//                                 ^^^^^^^^ entity.name.namespace.qml
//                                          ^^^^^^^^^^ comment.line.qml
// <------------------------------------------------------ meta.import.qml

//------------------------------------------------------------------------------
// trailing semicolon
//------------------------------------------------------------------------------
import QtQuick;
//     ^^^^^^^ entity.name.namespace.qml
//            ^ punctuation.terminator.statement.qml
import QtQuick 2.0;
//                ^ punctuation.terminator.statement.qml
import "../textwidgets" as MyModule;
//                                 ^ punctuation.terminator.statement.qml

//------------------------------------------------------------------------------
// meta scope ends at the end of the statement
//------------------------------------------------------------------------------
import QtQuick
Item {}
// <------- - meta.import.qml
