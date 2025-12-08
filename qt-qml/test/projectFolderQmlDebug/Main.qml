import QtQuick
import QtQuick.Window

Window {
    width: 640
    height: 480
    visible: true
    title: qsTr("QML Debug Test")

    property int counter: 0
    property string message: "Hello QML"
    property var items: ["apple", "banana", "cherry"]
    property bool isActive: true

    Component.onCompleted: {
        // BREAK_HERE
        counter = 42;
        message = "Debug test running";
        // BREAK_HERE
        for (var i = 0; i < items.length; i++) {
            console.log("Item:", items[i]);
        }
    }

    Rectangle {
        anchors.fill: parent
        color: isActive ? "lightblue" : "lightgray"

        Text {
            anchors.centerIn: parent
            text: message + " (" + counter + ")"
            font.pixelSize: 24
        }

        MouseArea {
            anchors.fill: parent
            onClicked: {
                // BREAK_HERE
                counter++;
                message = "Clicked " + counter + " times";
            }
        }
    }

    Timer {
        interval: 1000
        running: true
        repeat: true
        onTriggered: {
            // BREAK_HERE
            counter++;
        }
    }
}
