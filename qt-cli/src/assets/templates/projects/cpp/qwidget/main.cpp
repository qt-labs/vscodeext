#include <QApplication>
{{- if .useTranslation }}
#include <QLocale>
#include <QTranslator>
{{- end }}
#include "mainwindow.h"

int main(int argc, char *argv[])
{
    QApplication a(argc, argv);

    {{ .className }} w;
    w.show();

    return a.exec();
}
