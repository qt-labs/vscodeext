// SYNTAX TEST "source.qml" "method declarations"
// Copyright (C) 2024 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

//------------------------------------------------------------------------------
// multiple lines
//------------------------------------------------------------------------------
Item {
    function myfunc() { // comment
//  ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^ meta.embedded.function.qml
        // comment
//      ^^^^^^^^^^ meta.embedded.function.qml
        return 3;
//      ^^^^^^^^^ meta.embedded.function.qml
    }
//  ^ meta.embedded.function.qml
}

//------------------------------------------------------------------------------
// single line
//------------------------------------------------------------------------------
Item {
    function myfunc() { return 3; } // comment
//  ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^ meta.embedded.function.qml
//                                  ^^^^^^^^^^ comment.line.qml - meta.embedded.function.qml
}

//------------------------------------------------------------------------------
// return type
//------------------------------------------------------------------------------
Item {
    function myfunc(): int {
//  ^^^^^^^^^^^^^^^^^^^^^^^^ meta.embedded.function.qml
        return 3;
//      ^^^^^^^^^ meta.embedded.function.qml
    }
//  ^ meta.embedded.function.qml
}

//------------------------------------------------------------------------------
// typed parameters
//------------------------------------------------------------------------------
Item {
    function myfunc(a: int, b: date, c: Item): int {
//  ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^ meta.embedded.function.qml
        return a + b + c.prop;
//      ^^^^^^^^^^^^^^^^^^^^^^ meta.embedded.function.qml
    }
//  ^ meta.embedded.function.qml
}

//------------------------------------------------------------------------------
// generic and qualified types
//------------------------------------------------------------------------------
Item {
    function f(a: list<int>, b: T.Item): list<T.Item> {
//  ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^ meta.embedded.function.qml
        return [b]
//      ^^^^^^^^^^ meta.embedded.function.qml
    }
//  ^ meta.embedded.function.qml
    width: 10
//  ^^^^^ entity.other.attribute-name.qml - meta.embedded.function.qml
}

//------------------------------------------------------------------------------
// inside child item
//------------------------------------------------------------------------------
Item {
    MouseArea {
        function insideItem(a: int, b: date): int {
//      ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^ meta.embedded.function.qml
            return a + b;
//          ^^^^^^^^^^^^^ meta.embedded.function.qml
        }
//      ^ meta.embedded.function.qml
    }
//  ^ - meta.embedded.function.qml
}

//------------------------------------------------------------------------------
// brace on the next line
//------------------------------------------------------------------------------
Item {
    function f()
//  ^^^^^^^^^^^^ meta.embedded.function.qml
    {
//  ^ meta.embedded.function.qml
        return 1
//      ^^^^^^^^ meta.embedded.function.qml
    }
//  ^ meta.embedded.function.qml
    width: 10
//  ^^^^^ entity.other.attribute-name.qml - meta.embedded.function.qml
    function g(a: int): int
//  ^^^^^^^^^^^^^^^^^^^^^^^ meta.embedded.function.qml
    {
//  ^ meta.embedded.function.qml
        return a
//      ^^^^^^^^ meta.embedded.function.qml
    }
//  ^ meta.embedded.function.qml
    height: 20
//  ^^^^^^ entity.other.attribute-name.qml - meta.embedded.function.qml
}

//------------------------------------------------------------------------------
// members after
//------------------------------------------------------------------------------
Item {
    function f(a: int): int {
//  ^^^^^^^^^^^^^^^^^^^^^^^^^ meta.embedded.function.qml
        if (a) { return 1 }
//      ^^^^^^^^^^^^^^^^^^^ meta.embedded.function.qml
        return 2
//      ^^^^^^^^ meta.embedded.function.qml
    }
//  ^ meta.embedded.function.qml
    width: 10
//  ^^^^^ entity.other.attribute-name.qml - meta.embedded.function.qml
    function g() {}
//  ^^^^^^^^^^^^^^^ meta.embedded.function.qml
    height: 20
//  ^^^^^^ entity.other.attribute-name.qml - meta.embedded.function.qml
}

//------------------------------------------------------------------------------
// attribute name starting with function
//------------------------------------------------------------------------------
Item {
    functionName: 1
//  ^^^^^^^^^^^^ entity.other.attribute-name.qml - meta.embedded.function.qml
    width: 10
//  ^^^^^ entity.other.attribute-name.qml - meta.embedded.function.qml
}

//------------------------------------------------------------------------------
// end of file: every object above is closed
//------------------------------------------------------------------------------
// end
// <------ - meta.object.qml
