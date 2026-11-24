// SYNTAX TEST "source.qml" "pragma statements"
// Copyright (C) 2024 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

pragma Singleton
pragma ListPropertyAssignBehavior: ReplaceIfNotDefault // Append, Replace,
pragma ComponentBehavior: Bound // Unbound
pragma FunctionSignatureBehavior: Ignored // Enforced
pragma NativeMethodBehavior: AcceptThisObject // RejectThisObject
pragma ValueTypeBehavior: Addressable // Inaddressable, Copy, Reference
pragma Translator: myContext
pragma Translator: "myContext"
