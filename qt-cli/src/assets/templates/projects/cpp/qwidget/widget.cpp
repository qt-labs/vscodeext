#include "widget.h"
{{- if and .useForm (eq .uiUsage "pointer") }}
#include "{{ .uiHeaderFile }}"
{{- end }}

{{ .className }}::{{ .className }}(QWidget *parent)
    : {{ .baseClass }}(parent)
{{- if and .useForm (eq .uiUsage "pointer") }}
    , ui(new Ui::{{ .className }})
{{- end }}
{
{{- if .useForm }}
{{- if eq .uiUsage "pointer" }}
    ui->setupUi(this);
{{- else if eq .uiUsage "member" }}
    ui.setupUi(this);
{{- else }}
    setupUi(this);
{{- end }}
{{- end }}
}

{{ .className }}::~{{ .className }}()
{
{{- if and .useForm (eq .uiUsage "pointer") }}
    delete ui;
{{- end }}
}
