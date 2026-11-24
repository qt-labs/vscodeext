// SYNTAX TEST "source.qml" "comments"
// Copyright (C) 2024 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

//------------------------------------------------------------------------------
// line comment
//------------------------------------------------------------------------------
// This is a line comment

Item { // This is a comment
}

//------------------------------------------------------------------------------
// block comment
//------------------------------------------------------------------------------
/*
    This is a block comment
*/

/*!
    This is a block comment
*/

//------------------------------------------------------------------------------
// some helpers for user convenience
//------------------------------------------------------------------------------
Item {
    // NOTE note entry
    // TODO todo entry
    // DEBUG debug entry
    // XXX xxx entry
    // BUG bug entry
    // FIXME fixme entry
    // WARNING warning entry
}
