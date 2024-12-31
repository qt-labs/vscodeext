import QtQuick
{{- if .useVirtualKeyboard }}
import QtQuick.VirtualKeyboard
{{- end }}

Window {
{{- if .useVirtualKeyboard }}
    id: window
{{- end }}
    width: 640
    height: 480
    visible: true
    title: qsTr("Hello World")
{{- if .useVirtualKeyboard }}

    InputPanel {
        id: inputPanel
        z: 99
        x: 0
        y: window.height
        width: window.width

        states: State {
            name: "visible"
            when: inputPanel.active
            PropertyChanges {
                target: inputPanel
                y: window.height - inputPanel.height
            }
        }
        transitions: Transition {
            from: ""
            to: "visible"
            reversible: true
            ParallelAnimation {
                NumberAnimation {
                    properties: "y"
                    duration: 250
                    easing.type: Easing.InOutQuad
                }
            }
        }
    }
{{- end }}
}
