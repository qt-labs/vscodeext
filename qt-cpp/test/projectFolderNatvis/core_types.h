// Minimal QtCore sample types for NatVis coverage
#pragma once

#include <QtCore> // brings in all necessary QtCore headers

enum class SelectionFlag {
    None          = 0x0,
    SelectCurrent = 0x1,
    SelectAll     = 0x2,
};
Q_DECLARE_FLAGS(SelectionFlags, SelectionFlag)
Q_DECLARE_OPERATORS_FOR_FLAGS(SelectionFlags)

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
    //QDateTime    qDateTimeLocal;
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
    SelectionFlags qFlags;

    // JSON document
    QJsonDocument qJsonDocument;
    QJsonDocument qJsonDocumentEmpty;

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
    //, qDateTimeLocal(QDateTime(QDate(2024, 6, 15),
    //                           QTime(12, 34, 56),
    //                           QTimeZone::systemTimeZone()))
    // deterministic date-times built from a fixed base date/time
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
    , qFlags(SelectionFlag::SelectCurrent | SelectionFlag::SelectAll)
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
    // Load JSON sample from pass1.json (expected next to the executable).
    // CMake should copy pass1.json from the source tree (next to core_types.h)
    // into the runtime directory.
    const QString jsonPath =
        QCoreApplication::applicationDirPath() + QLatin1String("/pass1.json");
    QFile jsonFile(jsonPath);
    if (jsonFile.open(QIODevice::ReadOnly | QIODevice::Text)) {
        QJsonParseError error;
        qJsonDocument = QJsonDocument::fromJson(jsonFile.readAll(), &error);
        Q_UNUSED(error);
    }
}
