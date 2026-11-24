// SYNTAX TEST "source.qml" "strings"
// Copyright (C) 2024 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

//------------------------------------------------------------------------------
// attribute values
//------------------------------------------------------------------------------
Item {
    prop1: "value1"
    prop2: 'value2'
    prop3: `${prop1} abcd` + `this is a ${prop2} value.`
}

//------------------------------------------------------------------------------
// single line, in js block
//------------------------------------------------------------------------------
Item {
    Component.onCompleted: {
        console.log("string text line ");
        console.log('string text line ');
        console.log(`string text line with ${a+b} and ${prop1}.`);
    }
}

//------------------------------------------------------------------------------
// multiple lines, in js block
//------------------------------------------------------------------------------
Item {
    Component.onCompleted: {
        console.log(`string text line with ${a+b} and ${prop1}.
            the second line`);
    }
}
