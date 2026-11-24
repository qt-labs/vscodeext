// SYNTAX TEST "source.qml" "import statements"
// Copyright (C) 2024 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

//------------------------------------------------------------------------------
// with version number
//------------------------------------------------------------------------------
import QtQuick 2.0
import QtQuick.LocalStorage 2.0
import QtQuick.LocalStorage 2.0 as Database

//------------------------------------------------------------------------------
// without version
//------------------------------------------------------------------------------
import QtQuick
import QtQuick.LocalStorage
import QtQuick.LocalStorage as Database

//------------------------------------------------------------------------------
// folders, files
//------------------------------------------------------------------------------
import "../textwidgets"
import "../textwidgets" as MyModule
import "somefile.js" as Script

//------------------------------------------------------------------------------
// others
//------------------------------------------------------------------------------
import QtQuick 2.0 // comment
import QtQuick.LocalStorage 2.0 as Database // comment
