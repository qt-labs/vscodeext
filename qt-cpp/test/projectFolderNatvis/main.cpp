#include <QtCore/QCoreApplication>
#include <QtCore/QString>
#include <iostream>

//#include "core_types.h"

int main(int argc, char** argv) {
  QCoreApplication app(argc, argv);

  //auto coreTypes = CoreTypes();
  // BREAK_HERE
  std::cout << QString("Hello Qt World").toStdString() << std::endl;
  return 0;
}
