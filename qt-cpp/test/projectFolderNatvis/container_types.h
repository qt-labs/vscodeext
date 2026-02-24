// Qt container sample types for NatVis coverage (no overlap with CoreTypes)
#pragma once

#include <QtCore>

struct ContainerTypes
{
    // sequence containers
    QList<int>              qIntList;
    QList<QString>          qStringListExplicit;
    QList<QVariant>         qVariantList;
    QByteArrayList          qByteArrayList;
    QStringList             qStringList;
    QVector<int>            qVectorInt;
    QSpan<int>              qSpanInt;
    QVector<QPointF>         qVectorPointF;
    QVarLengthArray<int, 4> qVarLengthArrayInt;

    // associative containers
    QMap<QString, int>       qMapStringInt;
    QMultiMap<QString, int>  qMultiMapStringInt;
    QHash<QString, int>      qHashStringInt;
    QMultiHash<QString, int> qMultiHashStringInt;
    QSet<QString>            qSetString;

    // pair
    QPair<QString, int>      qPairStringInt;

    // QVariant-based containers
    QVariantMap   qVariantMap;
    QVariantList  qVariantListContainer;
    QVariantHash  qVariantHash;

    // JSON containers (QJsonDocument itself is already in CoreTypes)
    QJsonArray    qJsonArray;
    QJsonObject   qJsonObject;
    QJsonValue    qJsonValueNull;
    QJsonValue    qJsonValueInt;
    QJsonValue    qJsonValueString;

    // CBOR containers
    QCborArray    qCborArray;
    QCborMap      qCborMap;
    QCborMap      qCborMapEmpty;
    QCborValue    qCborValueNull;
    QCborValue    qCborValueInt;
    QCborValue    qCborValueString;

    // Constructor
    ContainerTypes();
};

inline ContainerTypes::ContainerTypes()
    : qIntList{1, 2, 3}
    , qStringListExplicit{QStringLiteral("alpha"), QStringLiteral("beta")}
    , qVariantList{QVariant(123), QVariant(QStringLiteral("hello"))}
    , qByteArrayList{QByteArray("one"), QByteArray("two")}
    , qStringList{QStringLiteral("red"),
                   QStringLiteral("green"),
                   QStringLiteral("blue")}
     , qVectorInt{10, 20, 30}
     , qSpanInt() // will be set below once qVectorInt is constructed
     , qVectorPointF{QPointF(1, 2), QPointF(3, 4)}
     , qVarLengthArrayInt()
     , qMapStringInt({{QStringLiteral("one"), 1},
                      {QStringLiteral("two"), 2}})
     , qMultiMapStringInt()
     , qHashStringInt()
     , qMultiHashStringInt()
     , qSetString()
     , qPairStringInt(QStringLiteral("pair-key"), 42)
     , qVariantMap()
     , qVariantListContainer()
     , qVariantHash()
     , qJsonArray(QJsonArray::fromVariantList(
           QVariantList{1, QStringLiteral("two"), 3}))
     , qJsonObject(QJsonObject{
           {QStringLiteral("a"), 1},
           {QStringLiteral("b"), 2},
       })
     , qJsonValueNull(QJsonValue::Null)
     , qJsonValueInt(42)
     , qJsonValueString(QStringLiteral("forty-two"))
     , qCborArray()
     , qCborMap()
     , qCborValueNull(QCborValue()) // Null
     , qCborValueInt(QCborValue(42))
     , qCborValueString(QCborValue(QStringLiteral("forty-two")))
{
//     // QVarLengthArray can't easily be filled in the member initializer list
       // It doesn't have a simple, reliable initializer-list constructor that sets up its internal state
       // the way we want for debugging, so we explicitly build it step-by-step.”
     qVarLengthArrayInt.reserve(4);
     qVarLengthArrayInt.append(7);
     qVarLengthArrayInt.append(8);
     qVarLengthArrayInt.append(9);

     qMultiMapStringInt.insert(QStringLiteral("first_key"), 1);
     qMultiMapStringInt.insert(QStringLiteral("second_key"), 2);

     qHashStringInt.insert(QStringLiteral("one"), 1);
     qHashStringInt.insert(QStringLiteral("two"), 2);

     qMultiHashStringInt.insert(QStringLiteral("k"), 100);
     qMultiHashStringInt.insert(QStringLiteral("k"), 200);

     qSetString.insert(QStringLiteral("apple"));
     qSetString.insert(QStringLiteral("banana"));

     qVariantMap.insert(QStringLiteral("answer"), 42);
     qVariantMap.insert(QStringLiteral("question"),
                        QStringLiteral("life"));

     qVariantListContainer.append(123);
     qVariantListContainer.append(QStringLiteral("abc"));
     qVariantListContainer.append(true);

     qVariantHash.insert(QStringLiteral("x"), 1);
     qVariantHash.insert(QStringLiteral("y"), 2);

     qCborArray.append(1);
     qCborArray.append(QStringLiteral("two"));
     qCborArray.append(true);

     qCborMap.insert(QStringLiteral("k1"), 1);
     qCborMap.insert(QStringLiteral("k2"), QStringLiteral("two"));

     // QSpan is a view, so bind it to the QVector storage
     qSpanInt = QSpan<int>(qVectorInt.data(),
                           qVectorInt.size());
}