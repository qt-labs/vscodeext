# This Python file uses the following encoding: utf-8
import sys
from PySide6.QtWidgets import QApplication, {{ .baseClass }}

{{- if .useForm }}
# Important:
# You need to run the following command to generate the ui_form.py file
#     pyside6-uic form.ui -o ui_form.py
from ui_form import Ui_Widget
{{- end }}


class {{ .className }}({{ .baseClass }}):
    def __init__(self, parent=None):
        super().__init__(parent)

{{- if .useForm }}
        self.ui = Ui_Widget()
        self.ui.setupUi(self)
{{- end }}


if __name__ == "__main__":
    app = QApplication(sys.argv)
    widget = Widget()
    widget.show()
    sys.exit(app.exec())
