#include "{{ .fileNameBase }}.h"
{{- if .useForm }}
#include "ui_{{ .fileNameBase }}.h"
{{- end }}

{{ .className }}::{{ .className }}(QWidget *parent)
    : {{ .baseClass }}(parent)
{{- if .useForm }}
    , ui(new Ui::{{ .className }})
{{- end }}
{
{{- if .useForm }}
    ui->setupUi(this);
{{- end }}
}

{{ .className }}::~{{ .className }}()
{
{{- if .useForm }}
    delete ui;
{{- end }}
}
