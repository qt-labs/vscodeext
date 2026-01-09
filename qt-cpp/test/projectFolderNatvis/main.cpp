#include <QtCore/QCoreApplication>
#include <QtCore/QString>
#include <QtCore/QRect>
#include <iostream>

#include "core_types.h"
#include "container_types.h"
#include "core_state_types.h"

int main(int argc, char** argv) {
  QCoreApplication app(argc, argv);

  auto coreTypes = CoreTypes();
  auto containerTypes = ContainerTypes();
  auto coreStateTypes = CoreStateTypes();

  // BREAK_HERE
  return 0;
}
