// Deliberately not called main.cpp. Every Qt platform plugin is built from a
// main.cpp of its own, and the debuggee loads one now that it is a
// QGuiApplication. cpptools resolves breakpoints by file base name, so a
// breakpoint in a file called main.cpp is ambiguous: gdb placed it on main's
// prologue, before any fixture was constructed, and every value read as
// uninitialized memory.
#include <QtGui/QGuiApplication>
#include <QtCore/QString>
#include <QtCore/QRect>
#include <iostream>

#include "core_types.h"
#include "container_types.h"
#include "core_state_types.h"
#include "gui_types.h"
#ifdef HAVE_QT_QUICK
#include "quick_types.h"
#endif

int main(int argc, char** argv) {
  // QGuiApplication, not QCoreApplication: QPixmap needs one.
  QGuiApplication app(argc, argv);

  auto coreTypes = CoreTypes();
  auto containerTypes = ContainerTypes();
  auto coreStateTypes = CoreStateTypes();
  auto guiTypes = GuiTypes();
#ifdef HAVE_QT_QUICK
  auto quickTypes = QuickTypes();
#endif

  // BREAK_HERE
  return 0;
}
