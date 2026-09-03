// Minimal QtGui sample types for NatVis coverage
#pragma once

#include <QtGui> // QImage, QPixmap, QMatrix4x4, QGenericMatrix aliases, QVector*, QPolygon*

struct GuiTypes
{
    // images / pixmaps
    QImage  qImageArgb32;
    QPixmap qPixmap;

    // polygons
    QPolygon  qPolygon;
    QPolygonF qPolygonF;

    // matrices
    QMatrix4x4 qMatrix4x4;

    // // QGenericMatrix common aliases
    QMatrix2x2 qMatrix2x2;
    // QMatrix2x3 qMatrix2x3;
    // QMatrix2x4 qMatrix2x4;

    // QMatrix3x2 qMatrix3x2;
    // QMatrix3x3 qMatrix3x3;
    // QMatrix3x4 qMatrix3x4;

    // QMatrix4x2 qMatrix4x2;
    // QMatrix4x3 qMatrix4x3;

    // vectors
    QVector2D qVector2D;
    QVector3D qVector3D;
    QVector4D qVector4D;

    // colors
    QColor qColorRgb;
    QColor qColorRgba;

    GuiTypes();
};

inline GuiTypes::GuiTypes()
    : qImageArgb32(4, 3, QImage::Format_ARGB32)
    , qPixmap() // will be assigned below
    , qPolygon()
    , qPolygonF()
    , qMatrix4x4()
    , qMatrix2x2()
    // , qMatrix2x3()
    // , qMatrix2x4()
    // , qMatrix3x2()
    // , qMatrix3x3()
    // , qMatrix3x4()
    // , qMatrix4x2()
    // , qMatrix4x3()
    , qVector2D(1.0f, 2.0f)
    , qVector3D(1.0f, 2.0f, 3.0f)
    , qVector4D(1.0f, 2.0f, 3.0f, 4.0f)
    , qColorRgb(255, 0, 0)
    , qColorRgba(10, 20, 30, 128)
{
    // Image: make it non-trivial.
    qImageArgb32.fill(qRgba(10, 20, 30, 255));
    qImageArgb32.setPixelColor(0, 0, QColor(255, 0, 0, 255));
    qImageArgb32.setPixelColor(1, 0, QColor(0, 255, 0, 255));

    // Pixmap: requires the QGuiApplication in main.cpp.
    qPixmap = QPixmap::fromImage(qImageArgb32);

    // Polygons.
    qPolygon << QPoint(0, 0) << QPoint(10, 0) << QPoint(10, 10) << QPoint(0, 10);
    qPolygonF << QPointF(0.5, 0.5) << QPointF(10.5, 0.5) << QPointF(10.5, 10.5) << QPointF(0.5, 10.5);

    // QMatrix4x4: deterministic non-identity.
    qMatrix4x4.setToIdentity();
    qMatrix4x4.translate(1.0f, 2.0f, 3.0f);
    qMatrix4x4.scale(2.0f, 3.0f, 4.0f);

    // QGenericMatrix aliases: fill via operator()(row, col).
    // (row, col) is available; don't rely on non-existent Rows/Columns constants.

    // 2x2
    qMatrix2x2(0, 0) = 1.0f; qMatrix2x2(0, 1) = 2.0f;
    qMatrix2x2(1, 0) = 3.0f; qMatrix2x2(1, 1) = 4.0f;

    // // 2x3
    // qMatrix2x3(0, 0) = 1.0f; qMatrix2x3(0, 1) = 2.0f; qMatrix2x3(0, 2) = 3.0f;
    // qMatrix2x3(1, 0) = 4.0f; qMatrix2x3(1, 1) = 5.0f; qMatrix2x3(1, 2) = 6.0f;

    // // 2x4
    // qMatrix2x4(0, 0) = 1.0f; qMatrix2x4(0, 1) = 2.0f; qMatrix2x4(0, 2) = 3.0f; qMatrix2x4(0, 3) = 4.0f;
    // qMatrix2x4(1, 0) = 5.0f; qMatrix2x4(1, 1) = 6.0f; qMatrix2x4(1, 2) = 7.0f; qMatrix2x4(1, 3) = 8.0f;

    // // 3x2
    // qMatrix3x2(0, 0) = 1.0f; qMatrix3x2(0, 1) = 2.0f;
    // qMatrix3x2(1, 0) = 3.0f; qMatrix3x2(1, 1) = 4.0f;
    // qMatrix3x2(2, 0) = 5.0f; qMatrix3x2(2, 1) = 6.0f;

    // // 3x3
    // qMatrix3x3(0, 0) = 1.0f; qMatrix3x3(0, 1) = 2.0f; qMatrix3x3(0, 2) = 3.0f;
    // qMatrix3x3(1, 0) = 4.0f; qMatrix3x3(1, 1) = 5.0f; qMatrix3x3(1, 2) = 6.0f;
    // qMatrix3x3(2, 0) = 7.0f; qMatrix3x3(2, 1) = 8.0f; qMatrix3x3(2, 2) = 9.0f;

    // // 3x4
    // qMatrix3x4(0, 0) =  1.0f; qMatrix3x4(0, 1) =  2.0f; qMatrix3x4(0, 2) =  3.0f; qMatrix3x4(0, 3) =  4.0f;
    // qMatrix3x4(1, 0) =  5.0f; qMatrix3x4(1, 1) =  6.0f; qMatrix3x4(1, 2) =  7.0f; qMatrix3x4(1, 3) =  8.0f;
    // qMatrix3x4(2, 0) =  9.0f; qMatrix3x4(2, 1) = 10.0f; qMatrix3x4(2, 2) = 11.0f; qMatrix3x4(2, 3) = 12.0f;

    // // 4x2
    // qMatrix4x2(0, 0) = 1.0f; qMatrix4x2(0, 1) = 2.0f;
    // qMatrix4x2(1, 0) = 3.0f; qMatrix4x2(1, 1) = 4.0f;
    // qMatrix4x2(2, 0) = 5.0f; qMatrix4x2(2, 1) = 6.0f;
    // qMatrix4x2(3, 0) = 7.0f; qMatrix4x2(3, 1) = 8.0f;

    // // 4x3
    // qMatrix4x3(0, 0) =  1.0f; qMatrix4x3(0, 1) =  2.0f; qMatrix4x3(0, 2) =  3.0f;
    // qMatrix4x3(1, 0) =  4.0f; qMatrix4x3(1, 1) =  5.0f; qMatrix4x3(1, 2) =  6.0f;
    // qMatrix4x3(2, 0) =  7.0f; qMatrix4x3(2, 1) =  8.0f; qMatrix4x3(2, 2) =  9.0f;
    // qMatrix4x3(3, 0) = 10.0f; qMatrix4x3(3, 1) = 11.0f; qMatrix4x3(3, 2) = 12.0f;
}