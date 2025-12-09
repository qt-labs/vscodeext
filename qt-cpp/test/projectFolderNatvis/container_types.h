// Qt container sample types for NatVis coverage (no overlap with CoreTypes)
#pragma once

#include <QtCore>

struct ContainerTypes
{
    // sequence containers
    QList<int>              qIntList;
    //QList<QString>          qStringList;
    //QList<QVariant>         qVariantList;
    QByteArrayList          qByteArrayList; //Keep, e.g: Only on Windows
    QStringList             qQStringList; // Keep, e.g: Only show [0] and [1] missing [2]. Flattening problem
    //QVector<int>            qVectorInt;
    //QSpan<int>              qSpanInt;
    //QVector<QPoint>         qVectorPoint;
    //QVarLengthArray<int, 4> qVarLengthArrayInt;

    // associative containers
    //QMap<QString, int>       qMapStringInt;
    //QMultiMap<QString, int>  qMultiMapStringInt;
    //QHash<QString, int>      qHashStringInt;
    //QMultiHash<QString, int> qMultiHashStringInt;
    //QSet<QString>            qSetString;

    // pair
    QPair<QString, int>      qPairStringInt; // Keep, e.g: Dysplay string not present in the golden. Only first is shown

    // QVariant-based containers
    //QVariantMap   qVariantMap;
    //QVariantList  qVariantListContainer;
    //QVariantHash  qVariantHash;

    // JSON containers (QJsonDocument itself is already in CoreTypes)
    //QJsonArray    qJsonArray;
    //QJsonObject   qJsonObject;
    //QJsonValue    qJsonValueNull;
    //QJsonValue    qJsonValueInt;
    //QJsonValue    qJsonValueString;

    // CBOR containers
    QCborArray    qCborArray; //Keep, e.g: "{...}"" "" "d{...}"
    //QCborMap      qCborMap;
    //QCborValue    qCborValueNull;
    QCborValue    qCborValueInt; // Keep, e.g: Known problem for windows, linux 42 is correct, mac {...} is a known problem
    //QCborValue    qCborValueString;

    // Constructor
    ContainerTypes();
};

inline ContainerTypes::ContainerTypes()
    : qIntList{1, 2, 3}
    //, qStringList{QStringLiteral("alpha"), QStringLiteral("beta")}
    //, qVariantList{QVariant(123), QVariant(QStringLiteral("hello"))}
    , qByteArrayList{QByteArray("one"), QByteArray("two")}
    , qQStringList{QStringLiteral("red"),
                   QStringLiteral("green"),
                   QStringLiteral("blue")}
//     , qVectorInt{10, 20, 30}
//     , qSpanInt() // will be set below once qVectorInt is constructed
//     , qVectorPoint{QPoint(1, 2), QPoint(3, 4)}
//     , qVarLengthArrayInt()
//     , qMapStringInt({{QStringLiteral("one"), 1},
//                      {QStringLiteral("two"), 2}})
//     , qMultiMapStringInt()
//     , qHashStringInt()
//     , qMultiHashStringInt()
//     , qSetString()
       , qPairStringInt(QStringLiteral("pair-key"), 42)
//     , qVariantMap()
//     , qVariantListContainer()
//     , qVariantHash()
//     , qJsonArray(QJsonArray::fromVariantList(
//           QVariantList{1, QStringLiteral("two"), 3}))
//     , qJsonObject(QJsonObject{
//           {QStringLiteral("a"), 1},
//           {QStringLiteral("b"), 2},
//       })
//     , qJsonValueNull(QJsonValue::Null)
//     , qJsonValueInt(42)
//     , qJsonValueString(QStringLiteral("forty-two"))
       , qCborArray()
//     , qCborMap()
//     , qCborValueNull(QCborValue()) // Null
     , qCborValueInt(QCborValue(42))
//     , qCborValueString(QCborValue(QStringLiteral("forty-two")))
{
//     // QVarLengthArray can't easily be filled in the member initializer list
//     qVarLengthArrayInt.reserve(4);
//     qVarLengthArrayInt.append(7);
//     qVarLengthArrayInt.append(8);
//     qVarLengthArrayInt.append(9);

//     qMultiMapStringInt.insert(QStringLiteral("key"), 1);
//     qMultiMapStringInt.insert(QStringLiteral("key"), 2);

//     qHashStringInt.insert(QStringLiteral("one"), 1);
//     qHashStringInt.insert(QStringLiteral("two"), 2);

//     qMultiHashStringInt.insert(QStringLiteral("k"), 100);
//     qMultiHashStringInt.insert(QStringLiteral("k"), 200);

//     qSetString.insert(QStringLiteral("apple"));
//     qSetString.insert(QStringLiteral("banana"));

//     qVariantMap.insert(QStringLiteral("answer"), 42);
//     qVariantMap.insert(QStringLiteral("question"),
//                        QStringLiteral("life"));

//     qVariantListContainer.append(123);
//     qVariantListContainer.append(QStringLiteral("abc"));
//     qVariantListContainer.append(true);

//     qVariantHash.insert(QStringLiteral("x"), 1);
//     qVariantHash.insert(QStringLiteral("y"), 2);

//     qCborArray.append(1);
//     qCborArray.append(QStringLiteral("two"));
//     qCborArray.append(true);

//     qCborMap.insert(QStringLiteral("k1"), 1);
//     qCborMap.insert(QStringLiteral("k2"), QStringLiteral("two"));

//     // QSpan is a view, so bind it to the QVector storage
//     qSpanInt = QSpan<int>(qVectorInt.data(),
//                           qVectorInt.size());
}