#include <QtCore/QCoreApplication>
#include <QtCore/QString>
#include <QtCore/QRect>
#include <iostream>

//#include "core_types.h"

int main(int argc, char** argv) {
  QCoreApplication app(argc, argv);

  //auto coreTypes = CoreTypes();
  // QPoint qPoint = QPoint(24, 48);
  QRect qRect = QRect(5, 5, 42, 42);
  QByteArray qByteArray = QByteArray("Hello World!");
  QString qString = QString("Hello World!");
  std::cout << QString("Hello Qt World").toStdString() << std::endl;
  // BREAK_HERE
  return 0;
}
