import QtQuick

{{- if (eq .qmlRoot "ApplicationWindow") }}
import QtQuick.Controls
{{- end }}

{{ .qmlRoot }} {
    width: 640
    height: 480
    visible: true
    title: qsTr("Hello World")
}
