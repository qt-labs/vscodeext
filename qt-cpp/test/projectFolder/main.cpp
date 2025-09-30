#include <QtCore/QCoreApplication>
#include <QtCore/QString>
#include <iostream>
int main(int argc, char** argv) {
  QCoreApplication app(argc, argv);
  std::cout << QString("Hello Qt World").toStdString() << std::endl;
  return 0;
}
