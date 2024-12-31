#include <QApplication>
{{- if .useTranslation }}
#include <QLocale>
#include <QTranslator>
{{- end }}
#include "widget.h"

int main(int argc, char *argv[])
{
    QApplication a(argc, argv);
{{- if .useTranslation }}

    QTranslator translator;
    const QStringList uiLanguages = QLocale::system().uiLanguages();

    for (const QString &locale : uiLanguages) {
        const QString baseName = "{{ .name }}_" + QLocale(locale).name();
        if (translator.load(":/i18n/" + baseName)) {
            a.installTranslator(&translator);
            break;
        }
    }
{{- end }}

    {{ .className }} w;
    w.show();

    return a.exec();
}
