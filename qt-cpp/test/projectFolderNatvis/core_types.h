// core_types.h
// Minimal QtCore sample types for NatVis coverage
#pragma once

#include <QtCore> // brings in all necessary QtCore headers

// Holds one instance of each QtCore-based type we want NatVis to handle
struct CoreTypes
{
    // text / bytes
    QByteArray   qByteArray;
    QChar        qChar;
    QString      qString;
    QStringView  qStringView;

    // date/time
    QDate        qDate;
    QDateTime    qDateTimeLocal;
    QDateTime    qDateTimeUtc;
    QDateTime    qDateTimeBrunei;
    QDateTime    qDateTimeSouthPole;
    QDateTime    qDateTimeYukon;
    QDateTime    qDateTimeMarquesas;
    QDateTime    qDateTimeShouldFail;
    QDateTime    qDateTimeSecOffset;
    QDateTime    qDateTimeDefault;
    QTime        qTime;

    // file/path
    QDir         qDir;
    QFile        qFile;
    QFileInfo    qFileInfo;

    // flags
    // SelectionFlags qFlags;

    // JSON document
    // QJsonDocument qJsonDocument;

    // geometry (QtCore types)
    QLine     qLine;
    QPoint    qPoint;
    QPointF   qPointF;
    QRect     qRect;
    QRectF    qRectF;
    QSize     qSize;
    QSizeF    qSizeF;

    // URL / UUID
    QUrl      qUrl;
    QUuid     qUuid;

    // Constructor
    CoreTypes();
};

inline CoreTypes::CoreTypes()
    : qByteArray("Hello World!")
    , qChar(u'c')
    , qString(QStringLiteral("Hello World! Again."))
    , qStringView(qString)
    , qDate(2024,06,15)
    // deterministic date-times built from a fixed base date/time
    , qDateTimeLocal(QDateTime(QDate(2024, 6, 15),
                               QTime(12, 34, 56),
                               QTimeZone::systemTimeZone()))
    , qDateTimeUtc(QDateTime(QDate(2024, 6, 15),
                             QTime(12, 34, 56),
                             Qt::UTC))
    , qDateTimeBrunei(QDateTime(QDate(2024, 6, 15),
                                QTime(12, 34, 56),
                                QTimeZone("Asia/Brunei")))
    , qDateTimeSouthPole(QDateTime(QDate(2024, 6, 15),
                                   QTime(12, 34, 56),
                                   QTimeZone("Antarctica/South_Pole")))
    , qDateTimeYukon(QDateTime(QDate(2024, 6, 15),
                               QTime(12, 34, 56),
                               QTimeZone("Canada/Yukon")))
    , qDateTimeMarquesas(QDateTime(QDate(2024, 6, 15),
                                   QTime(12, 34, 56),
                                   QTimeZone("Pacific/Marquesas")))
    // expected to be invalid timezone – useful for NatVis “error” behaviour
    , qDateTimeShouldFail(QDateTime(QDate(2024, 6, 15),
                                    QTime(12, 34, 56),
                                    QTimeZone("Antarctica/Troll")))
    // fixed offset timezone: +12:34:56
    , qDateTimeSecOffset(QDateTime(QDate(2024, 6, 15),
                                   QTime(12, 34, 56),
                                   QTimeZone(12 * 3600 + 34 * 60 + 56)))
    , qDateTimeDefault() // default-constructed
    , qTime(12, 34, 56)
    , qDir(QDir::currentPath())
    , qFile(QCoreApplication::applicationFilePath())
    , qFileInfo(QCoreApplication::applicationFilePath())
    // , qFlags(SelectionFlag::SelectCurrent)
    , qLine(0, 1, 42, 43)
    , qPoint(24, 48)
    , qPointF(24.5, 48.5)
    , qRect(5, 6, 41, 42)
    , qRectF(5.1, 5.5, 4.1, 4.2)
    , qSize(42, 43)
    , qSizeF(4.1, 4.2)
    , qUrl(QStringLiteral("https://github.com/narnaud/natvis4qt"))
    , qUuid("{12345678-1234-1234-1234-1234567890ab}")
{
    // // Load JSON resource (same as the example you shared)
    // QFile jsonFile(QStringLiteral(":/pass1.json"));
    // if (jsonFile.open(QIODevice::ReadOnly | QIODevice::Text)) {
    //     QJsonParseError error;
    //     qJsonDocument = QJsonDocument::fromJson(jsonFile.readAll(), &error);
    //     Q_UNUSED(error);
    // }
}
