import QtQuick
import QtQuick.Controls
{{ if .SampleCode }}
import QtQuick.Layouts
{{ end }}

ApplicationWindow {
    id: win
    visible: true
    title: "Qt Bridge for C#"
{{ if .SampleCode }}
    width: 365; height: 510
    color: "#121212"
{{ else }}
    width: 640; height: 480
{{ end }}
{{ if .SampleCode }}

    ColumnLayout {
        anchors.fill: parent
        anchors.margins: 24
        spacing: 20

        Label {
            text: "Hello, World!"
            font.pixelSize: 40
            color: "white"
            horizontalAlignment: Text.AlignHCenter
            Layout.alignment: Qt.AlignHCenter
        }

        ColumnLayout {
            Layout.fillWidth: true
            spacing: 6
            Label {
                text: "Welcome to Qt Bridge for C#"
                Layout.fillWidth: true
                horizontalAlignment: Text.AlignHCenter
                font.pixelSize: 24
                color: "#cfcfcf"
            }

            Label {
                text: "QML Multi-language App UI"
                Layout.fillWidth: true
                horizontalAlignment: Text.AlignHCenter
                font.pixelSize: 24
                color: "white"
                wrapMode: Text.WordWrap
            }
        }

        Button {
            id: counterBtn
            text: Counter.clicks === 0 ? "Click me" : "Clicked " + Counter.clicks + " times"

            Layout.fillWidth: true
            Layout.preferredHeight: 48
            font.pixelSize: 16

            hoverEnabled: false
            focusPolicy: Qt.NoFocus

            readonly property color brandGreen: "#41cd52"

            background: Rectangle {
                radius: 12
                border.width: 0
                color: counterBtn.down
                    ? Qt.darker(counterBtn.brandGreen, 1.2)
                    : counterBtn.brandGreen
            }

            contentItem: Text {
                text: counterBtn.text
                color: "white"
                font: counterBtn.font
                horizontalAlignment: Text.AlignHCenter
                verticalAlignment: Text.AlignVCenter
                elide: Text.ElideRight
            }

            onClicked: Counter.clicks += 1
        }
    }
{{ end }}
}
