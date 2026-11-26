// SYNTAX TEST "source.qml" "Qt global object and translation functions"
// Copyright (C) 2026 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

//------------------------------------------------------------------------------
// Qt functions, constants and properties
//------------------------------------------------------------------------------
Item {
    color: Qt.rgba(1, 0, 0, 1)
//         ^^ support.class.qt.qml
//            ^^^^ support.function.qt.qml
    horizontalAlignment: Qt.AlignLeft
//                       ^^ support.class.qt.qml
//                          ^^^^^^^^^ support.constant.qt.qml
    visible: Qt.platform.os === "linux"
//           ^^ support.class.qt.qml
//              ^^^^^^^^ support.variable.property.qt.qml
}

//------------------------------------------------------------------------------
// nested calls, blocks and methods
//------------------------------------------------------------------------------
Item {
    color: Qt.darker(Qt.rgba(1, 0, 0, 1), 1.5)
//         ^^ support.class.qt.qml
//            ^^^^^^ support.function.qt.qml
//                   ^^ support.class.qt.qml
//                      ^^^^ support.function.qt.qml
    onClicked: {
        console.log(Qt.formatDate(new Date(), "yyyy"))
//                  ^^ support.class.qt.qml
//                     ^^^^^^^^^^ support.function.qt.qml
    }
    function f() { return Qt.point(1, 2) }
//                        ^^ support.class.qt.qml
//                           ^^^^^ support.function.qt.qml
}

//------------------------------------------------------------------------------
// list values
//------------------------------------------------------------------------------
Item {
    points: [Qt.point(1, 2), Qt.point(3, 4)]
//           ^^ meta.embedded.list.qml
//           ^^ support.class.qt.qml
//              ^^^^^ support.function.qt.qml
//                           ^^ support.class.qt.qml
//                              ^^^^^ support.function.qt.qml
    children: [
        Item { x: Qt.size(1, 2).width }
//                ^^ support.class.qt.qml
//                   ^^^^ support.function.qt.qml
    ]
}

//------------------------------------------------------------------------------
// translation functions
//------------------------------------------------------------------------------
Item {
    text: qsTr("Hello")
//        ^^^^ support.function.translation.qml
    title: qsTranslate("Context", "Title")
//         ^^^^^^^^^^^ support.function.translation.qml
    label: qsTrId("id-label")
//         ^^^^^^ support.function.translation.qml
    names: [QT_TR_NOOP("a"), QT_TRID_NOOP("b")]
//          ^^^^^^^^^^ support.function.translation.qml
//                           ^^^^^^^^^^^^ support.function.translation.qml
    onClicked: console.log(qsTr("clicked"))
//                         ^^^^ support.function.translation.qml
}

//------------------------------------------------------------------------------
// not the Qt global object
//------------------------------------------------------------------------------
Item {
    text: "Qt.rgba(1, 0, 0, 1) qsTr()" // Qt.rgba() qsTr()
//         ^^ - support.class.qt.qml
//         ^^ - support.function.qt.qml
//         ^^ - support.function.translation.qml
//            ^^^^ - support.class.qt.qml
//            ^^^^ - support.function.qt.qml
//            ^^^^ - support.function.translation.qml
//                             ^^^^ - support.class.qt.qml
//                             ^^^^ - support.function.qt.qml
//                             ^^^^ - support.function.translation.qml
//                                        ^^ - support.class.qt.qml
//                                        ^^ - support.function.qt.qml
//                                        ^^ - support.function.translation.qml
//                                           ^^^^ - support.class.qt.qml
//                                           ^^^^ - support.function.qt.qml
//                                           ^^^^ - support.function.translation.qml
//                                                  ^^^^ - support.class.qt.qml
//                                                  ^^^^ - support.function.qt.qml
//                                                  ^^^^ - support.function.translation.qml
    other: myQt.rgba(1)
//         ^^^^ - support.class.qt.qml
//         ^^^^ - support.function.qt.qml
//         ^^^^ - support.function.translation.qml
//              ^^^^ - support.class.qt.qml
//              ^^^^ - support.function.qt.qml
//              ^^^^ - support.function.translation.qml
    member: foo.Qt.rgba
//              ^^ - support.class.qt.qml
//              ^^ - support.function.qt.qml
//              ^^ - support.function.translation.qml
//                 ^^^^ - support.class.qt.qml
//                 ^^^^ - support.function.qt.qml
//                 ^^^^ - support.function.translation.qml
}

//------------------------------------------------------------------------------
// end of file: every object above is closed
//------------------------------------------------------------------------------
// end
// <------ - meta.object.qml
