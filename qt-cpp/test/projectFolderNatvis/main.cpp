#include <QtCore/QCoreApplication>
#include <QtCore/QString>
#include <QtCore/QRect>
#include <iostream>

#include "core_types.h"

int main(int argc, char** argv) {
  QCoreApplication app(argc, argv);

  auto coreTypes = CoreTypes();
  // BREAK_HERE
  return 0;
}
