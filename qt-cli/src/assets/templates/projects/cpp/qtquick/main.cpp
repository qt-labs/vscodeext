{{- $mininumQtVersionFloat := (.minimumQtVersion | qParseFloat) }}
#include <QGuiApplication>
#include <QQmlApplicationEngine>

int main(int argc, char *argv[])
{
{{- if .useVirtualKeyboard }}
    qputenv("QT_IM_MODULE", QByteArray("qtvirtualkeyboard"));
{{ end }}
    QGuiApplication app(argc, argv);

    QQmlApplicationEngine engine;
{{- if lt $mininumQtVersionFloat 6.5 }}
    const QUrl url(QStringLiteral("qrc:/{{ .name }}/Main.qml"));
{{- end }}
{{- if ge $mininumQtVersionFloat 6.4 }}
    QObject::connect(
        &engine,
        &QQmlApplicationEngine::objectCreationFailed,
        &app,
        []() { QCoreApplication::exit(-1); },
        Qt::QueuedConnection);
{{- else }}
    QObject::connect(
        &engine,
        &QQmlApplicationEngine::objectCreated,
        &app,
        [url](QObject *obj, const QUrl &objUrl) {
            if (!obj && url == objUrl)
                QCoreApplication::exit(-1);
        },
        Qt::QueuedConnection);
{{- end }}
{{- if ge $mininumQtVersionFloat 6.5 }}
    engine.loadFromModule("{{ .name }}", "Main");
{{- else }}
    engine.load(url);
{{- end }}

    return app.exec();
}
