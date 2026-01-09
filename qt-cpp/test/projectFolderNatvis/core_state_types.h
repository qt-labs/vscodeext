// Copyright (C) 2025 The Qt Company Ltd.
// SPDX-License-Identifier: LicenseRef-Qt-Commercial OR LGPL-3.0-only

#pragma once

// -----------------------------------------------------------------------------
// core_state_types
//
// QtCore types that represent dynamic, indirect, or state-carrying concepts,
// rather than plain value types or containers.
//
// This group exists for NatVis coverage and includes:
// - QVariant          : type-erased runtime values
// - QObject           : object identity and runtime state
// - QFlags<*>         : configuration / option state
// - QBasicAtomic*     : shared / atomic state
//
// The grouping is taxonomy-based (semantic role), not value-based.
// -----------------------------------------------------------------------------

#include <QtCore/QObject>
#include <QtCore/QString>
#include <QtCore/QVariant>
#include <QtCore/QFlags>
#include <QtCore/qbasicatomic.h>

// Simple enum to force a real QFlags<Enum> instantiation
enum class CoreStateFlag : unsigned int {
  None    = 0x0,
  Read    = 0x1,
  Write   = 0x2,
  Execute = 0x4
};

Q_DECLARE_FLAGS(CoreStateFlags, CoreStateFlag)
Q_DECLARE_OPERATORS_FOR_FLAGS(CoreStateFlags)

class CoreStateTypes
{
public:
  CoreStateTypes()
  {
    // QObject
    qObject.setObjectName(QStringLiteral("core_state_types.qObject"));

    // QVariant (type-erased values)
    qVariantNull   = QVariant(); // NatVis: (null)
    qVariantInt    = QVariant::fromValue(42);
    qVariantString = QVariant::fromValue(QStringLiteral("variant-string"));
    qVariantBool   = QVariant::fromValue(true);

    // QFlags
    qFlagsNone = CoreStateFlags(); // 0
    qFlags     = CoreStateFlag::Read | CoreStateFlag::Write;

    // Atomics
    qAtomicInt.storeRelaxed(7);

    // Non-null pointers
    qAtomicPtr.storeRelaxed(&support_atomicTarget);
    qAtomicVoidPtr.storeRelaxed(static_cast<void*>(&support_atomicTarget));

    // Null pointers (NatVis: empty)
    qAtomicPtrNull.storeRelaxed(nullptr);
    qAtomicVoidPtrNull.storeRelaxed(nullptr);
  }

  // QObject (object identity / runtime state)
  QObject qObject;

  // QVariant
  QVariant qVariantNull;
  QVariant qVariantInt;
  QVariant qVariantString;
  QVariant qVariantBool;

  // QFlags
  CoreStateFlags qFlagsNone;
  CoreStateFlags qFlags;

  // Atomics
  QBasicAtomicInteger<int> qAtomicInt;

  // Support-only backing storage for atomic pointers (skip in snapshot/summary)
  int support_atomicTarget = 123;

  // Non-null atomic pointers
  QBasicAtomicPointer<int> qAtomicPtr;
  QBasicAtomicPointer<void> qAtomicVoidPtr;

  // Null atomic pointers (NatVis: empty)
  QBasicAtomicPointer<int> qAtomicPtrNull;
  QBasicAtomicPointer<void> qAtomicVoidPtrNull;
};