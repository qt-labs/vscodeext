// core_types.h
// Minimal QtCore sample types for NatVis coverage
#pragma once

//#include <QtCore> // brings in all necessary QtCore headers
#include <QtCore/QCoreApplication>
#include <QtCore/QString>
#include <QtCore/QRect>

// Holds one instance of each QtCore-based type we want NatVis to handle
struct CoreTypes
{
    // text / bytes
    QByteArray   qByteArray;
    //QChar        qChar;
    QString      qString;
    //QStringView  qStringView;

    // date/time
    // QDate        qDate;
    // QDateTime    qDateTimeLocal;
    // QDateTime    qDateTimeUtc;
    // QDateTime    qDateTimeBrunei;
    // QDateTime    qDateTimeSouthPole;
    // QDateTime    qDateTimeYukon;
    // QDateTime    qDateTimeMarquesas;
    // QDateTime    qDateTimeShouldFail;
    // QDateTime    qDateTimeSecOffset;
    // QDateTime    qDateTimeDefault;
    // QTime        qTime;

    // file/path
    // QDir         qDir;
    // QFile        qFile;
    // QFileInfo    qFileInfo;

    // flags
    // SelectionFlags qFlags;

    // JSON document
    // QJsonDocument qJsonDocument;

    // geometry (QtCore types)
    // QLine     qLine;
    // QPoint    qPoint;
    // QPointF   qPointF;
    QRect     qRect;
    // QRectF    qRectF;
    // QSize     qSize;
    // QSizeF    qSizeF;

    // URL / UUID
    // QUrl      qUrl;
    // QUuid     qUuid;

    // Constructor
    CoreTypes();
};

inline CoreTypes::CoreTypes()
    : qByteArray("Hello World!")
    //, qChar(u'c')
    , qString(QStringLiteral("Hello World!"))
    //, qStringView(qString)
    // , qDate(QDate::currentDate())
    // , qDateTimeLocal(QDateTime::currentDateTime())
    // , qDateTimeUtc(QDateTime::currentDateTimeUtc())
    // , qDateTimeBrunei(QDateTime::currentDateTimeUtc().toTimeZone(QTimeZone("Asia/Brunei")))
    // , qDateTimeSouthPole(QDateTime::currentDateTimeUtc().toTimeZone(QTimeZone("Antarctica/South_Pole")))
    // , qDateTimeYukon(QDateTime::currentDateTimeUtc().toTimeZone(QTimeZone("Canada/Yukon")))
    // , qDateTimeMarquesas(QDateTime::currentDateTimeUtc().toTimeTimeZone(QTimeZone("Pacific/Marquesas")))
    // , qDateTimeShouldFail(QDateTime::currentDateTimeUtc().toTimeZone(QTimeZone("Antarctica/Troll")))
    // , qDateTimeSecOffset(QDateTime::currentDateTimeUtc().toTimeZone(QTimeZone(12 * 3600 + 34 * 60 + 56)))
    // , qDateTimeDefault()
    // , qTime(QTime::currentTime())
    // , qDir(QDir::currentPath())
    // , qFile(QCoreApplication::applicationFilePath())
    // , qFileInfo(QCoreApplication::applicationFilePath())
    // , qFlags(SelectionFlag::SelectCurrent)
    // , qLine(0, 0, 42, 42)
    // , qPoint(24, 48)
    // , qPointF(24.5, 48.5)
    , qRect(5, 5, 42, 42)
    // , qRectF(5.5, 5.5, 4.2, 4.2)
    // , qSize(42, 42)
    // , qSizeF(4.2, 4.2)
    // , qUrl(QStringLiteral("https://github.com/narnaud/natvis4qt"))
    // , qUuid(QUuid::createUuid())
{
    // // Load JSON resource (same as the example you shared)
    // QFile jsonFile(QStringLiteral(":/pass1.json"));
    // if (jsonFile.open(QIODevice::ReadOnly | QIODevice::Text)) {
    //     QJsonParseError error;
    //     qJsonDocument = QJsonDocument::fromJson(jsonFile.readAll(), &error);
    //     Q_UNUSED(error);
    // }
}
