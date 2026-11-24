// SYNTAX TEST "source.qml" "method declarations"
// Copyright (C) 2024 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

import QtQuick

//------------------------------------------------------------------------------
// single line
//------------------------------------------------------------------------------
Item {
    function myfunc() { return 3; } // comment
}

//------------------------------------------------------------------------------
// multiple lines
//------------------------------------------------------------------------------
Item {
    function myfunc() { // comment
        // comment
        return 3;
    }
}

//------------------------------------------------------------------------------
// return type
//------------------------------------------------------------------------------
Item {
    function myfunc(): int {
        return 3;
    }
}

//------------------------------------------------------------------------------
// typed parameters
//------------------------------------------------------------------------------
Item {
    function myfunc(a: int, b: date, c: Item): int {
        return a + b + c.prop;
    }
}

//------------------------------------------------------------------------------
// inside child item
//------------------------------------------------------------------------------
Item {
    MouseArea {
        function insideItem(a: int, b: date): int {
            return a + b;
        }
    }
}
