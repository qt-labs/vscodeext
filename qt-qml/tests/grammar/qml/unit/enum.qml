// SYNTAX TEST "source.qml" "enum declarations"
// Copyright (C) 2024 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

Text {
    enum TextType {
        Normal,
        Heading = 2,
        Contents
    }

    property int textType: MyText.TextType.Normal

    font.bold: textType === MyText.TextType.Heading
    font.pixelSize: textType === MyText.TextType.Heading ? 24 : 12
}
