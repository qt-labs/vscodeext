// Minimal QtQuick sample types for NatVis coverage (root DisplayString only).

#pragma once

#include <QtQuick/QQuickItem>

struct QuickTypes
{
    QQuickItem qQuickItem;

    QuickTypes();
};

inline QuickTypes::QuickTypes()
    : qQuickItem()
{
    // Set deterministic geometry so QQuickItemPrivate DisplayString has meaningful numbers.
    // (NatVis for QQuickItemPrivate prints x/y/width/height, and optionally z when extra data exists.)
    qQuickItem.setX(1.25);
    qQuickItem.setY(2.5);
    qQuickItem.setWidth(320.0);
    qQuickItem.setHeight(200.0);

}
