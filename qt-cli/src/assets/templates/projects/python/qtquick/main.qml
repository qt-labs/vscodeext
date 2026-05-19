import QtQuick
import QtQuick.Layouts
import QtQuick.Controls.Basic

ApplicationWindow {
    width: 640
    height: 480
    minimumWidth: 150
    minimumHeight: 250
    visible: true
    title: qsTr("Hello World")

    GridLayout {
        id: grid
        columns: width < 300 ? 1 : 2
        anchors.fill: parent

        Rectangle {
            id: rectangle1
            color: "#00414A" // Qt Pine
            Layout.fillHeight: true
            Layout.fillWidth: true

            ColumnLayout {
                anchors.fill: parent
                Layout.alignment: Qt.AlignHCenter | Qt.AlignTop

                Text {
                    id: text1
                    color: "#cdb0ff" // Qt Violet
                    text: qsTr("Hello")
                    Layout.alignment: Qt.AlignHCenter | Qt.AlignTop
                    Layout.topMargin: 16
                    font.pixelSize: 48
                    horizontalAlignment: Text.AlignHCenter
                    verticalAlignment: Text.AlignVCenter
                }

                Button {
                    id: button1
                    text: qsTr("Toggle")
                    Layout.bottomMargin: 16
                    Layout.alignment: Qt.AlignHCenter | Qt.AlignBottom
                    onClicked: {
                        var tmpColor = text1.color.toString()
                        text1.color = text2.color
                        text2.color = tmpColor
                        switch2.checked = !(switch2.checked)
                    }
                }
            }
        }

        Rectangle {
            id: rectangle2
            color: "#2CDE85" // Qt Neon
            Layout.fillHeight: true
            Layout.fillWidth: true

            ColumnLayout {
                anchors.fill: parent
                Layout.alignment: Qt.AlignHCenter | Qt.AlignTop

                Text {
                    id: text2
                    color: "#d9f721" // Qt Lemon
                    text: qsTr("World")
                    Layout.alignment: Qt.AlignHCenter
                    font.pixelSize: 48
                    horizontalAlignment: Text.AlignHCenter
                    verticalAlignment: Text.AlignVCenter
                }

                Switch {
                    id: switch2
                    text: qsTr("Selected")
                    checkable: true
                    checked: false
                    Layout.alignment: Qt.AlignHCenter
                }
            }
        }
    }
}
